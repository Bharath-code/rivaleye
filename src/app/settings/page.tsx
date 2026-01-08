"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import {
    ArrowLeft,
    Bell,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Slack,
    Mail
} from "lucide-react";
import Link from "next/link";
import type { UserSettings } from "@/lib/types";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function SettingsPage() {
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
    const [error, setError] = useState<string | null>(null);

    // Slack webhook state
    const [slackUrl, setSlackUrl] = useState("");
    const [originalSlackUrl, setOriginalSlackUrl] = useState("");
    const [isTestingSlack, setIsTestingSlack] = useState(false);
    const [slackTestResult, setSlackTestResult] = useState<"success" | "error" | null>(null);
    const [slackSaveStatus, setSlackSaveStatus] = useState<"idle" | "success" | "error">("idle");

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch("/api/settings");
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to fetch settings");
            }

            setSettings(data.settings);
            const webhookValue = data.settings.slack_webhook_url || "";
            setSlackUrl(webhookValue);
            setOriginalSlackUrl(webhookValue);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load settings");
        } finally {
            setIsLoading(false);
        }
    };

    const updateSettings = async (updates: Partial<UserSettings>) => {
        setIsSaving(true);
        setSaveStatus("idle");

        try {
            const res = await fetch("/api/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to update settings");
            }

            setSettings(data.settings);
            setSaveStatus("success");
            setTimeout(() => setSaveStatus("idle"), 2000);
        } catch (err) {
            setSaveStatus("error");
            setError(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSlackSave = async () => {
        setSlackSaveStatus("idle");
        try {
            const res = await fetch("/api/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slack_webhook_url: slackUrl || null }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setSettings(data.settings);
            setOriginalSlackUrl(slackUrl); // Update baseline
            setSlackTestResult(null); // Clear test result
            setSlackSaveStatus("success");
            setTimeout(() => setSlackSaveStatus("idle"), 3000);
        } catch {
            setSlackSaveStatus("error");
        }
    };

    // Check if URL is a full valid webhook (not masked)
    const isValidWebhookUrl = slackUrl.startsWith("https://hooks.slack.com/");

    const testSlackWebhook = async () => {
        if (!slackUrl || !isValidWebhookUrl) return;

        setIsTestingSlack(true);
        setSlackTestResult(null);

        try {
            const res = await fetch("/api/alerts/slack", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    test: true,
                    webhookUrl: slackUrl,
                }),
            });

            if (res.ok) {
                setSlackTestResult("success");
            } else {
                setSlackTestResult("error");
            }
        } catch {
            setSlackTestResult("error");
        } finally {
            setIsTestingSlack(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                </main>
                <Footer />
            </div>
        );
    }

    if (error && !settings) {
        return (
            <div className="flex-1 flex flex-col min-h-screen">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                        <p className="text-muted-foreground">{error}</p>
                    </div>
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 pt-24 pb-12 px-6">
                <div className="container max-w-2xl mx-auto px-4 py-8">
                    {/* Header */}
                    <div className="mb-8">
                        <Link
                            href="/dashboard"
                            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Dashboard
                        </Link>
                        <h1 className="font-display text-3xl text-foreground">Settings</h1>
                        <p className="text-muted-foreground mt-1">
                            Manage your notification preferences
                        </p>
                    </div>

                    {/* Save status indicator */}
                    {saveStatus !== "idle" && (
                        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${saveStatus === "success"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-red-500/10 text-red-400"
                            }`}>
                            {saveStatus === "success" ? (
                                <CheckCircle2 className="w-4 h-4" />
                            ) : (
                                <AlertCircle className="w-4 h-4" />
                            )}
                            {saveStatus === "success" ? "Settings saved" : error}
                        </div>
                    )}

                    <div className="space-y-6">
                        {/* Email Preferences */}
                        <Card className="glass-card">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                        <Mail className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">Email Notifications</CardTitle>
                                        <CardDescription>
                                            Configure how you receive email alerts
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Toggle */}
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label htmlFor="email-enabled" className="text-foreground">
                                            Enable Email Alerts
                                        </Label>
                                        <p className="text-sm text-muted-foreground">
                                            Receive email when competitors make changes
                                        </p>
                                    </div>
                                    <Switch
                                        id="email-enabled"
                                        checked={settings?.email_enabled ?? true}
                                        onCheckedChange={(checked) =>
                                            updateSettings({ email_enabled: checked })
                                        }
                                        disabled={isSaving}
                                    />
                                </div>

                                {/* Frequency */}
                                <div className="space-y-2">
                                    <Label htmlFor="digest-frequency">Alert Frequency</Label>
                                    <Select
                                        value={settings?.digest_frequency ?? "instant"}
                                        onValueChange={(value) =>
                                            updateSettings({
                                                digest_frequency: value as "instant" | "daily" | "weekly"
                                            })
                                        }
                                        disabled={isSaving || !settings?.email_enabled}
                                    >
                                        <SelectTrigger id="digest-frequency">
                                            <SelectValue placeholder="Select frequency" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="instant">
                                                Instant — Send immediately
                                            </SelectItem>
                                            <SelectItem value="daily">
                                                Daily Digest — Once per day
                                            </SelectItem>
                                            <SelectItem value="weekly">
                                                Weekly Digest — Once per week
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        {settings?.digest_frequency === "instant"
                                            ? "You'll receive an email immediately when we detect a change."
                                            : settings?.digest_frequency === "daily"
                                                ? "You'll receive a summary of all changes at 9 AM UTC."
                                                : "You'll receive a weekly summary every Monday at 9 AM UTC."}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Slack Integration */}
                        <Card className="glass-card">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                        <Slack className="w-5 h-5 text-purple-400" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">Slack Integration</CardTitle>
                                        <CardDescription>
                                            Send alerts to your Slack channel
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="slack-webhook">Webhook URL</Label>
                                    <Input
                                        id="slack-webhook"
                                        type="url"
                                        placeholder="https://hooks.slack.com/services/..."
                                        value={slackUrl}
                                        onChange={(e) => setSlackUrl(e.target.value)}
                                        className="font-mono text-sm"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Create an{" "}
                                        <a
                                            href="https://api.slack.com/messaging/webhooks"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-emerald-400 hover:underline"
                                        >
                                            Incoming Webhook
                                        </a>{" "}
                                        in your Slack workspace to get started.
                                    </p>
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={testSlackWebhook}
                                        disabled={!isValidWebhookUrl || isTestingSlack}
                                        className="gap-2"
                                    >
                                        {isTestingSlack ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : slackTestResult === "success" ? (
                                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                        ) : slackTestResult === "error" ? (
                                            <AlertCircle className="w-4 h-4 text-red-400" />
                                        ) : (
                                            <Bell className="w-4 h-4" />
                                        )}
                                        Test Webhook
                                    </Button>
                                    <Button
                                        onClick={handleSlackSave}
                                        disabled={isSaving || slackUrl === originalSlackUrl}
                                        className="glow-emerald gap-2"
                                    >
                                        {isSaving ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : slackSaveStatus === "success" ? (
                                            <><CheckCircle2 className="w-4 h-4" /> Saved!</>
                                        ) : (
                                            "Save"
                                        )}
                                    </Button>
                                </div>

                                {slackSaveStatus === "error" && (
                                    <p className="text-sm text-red-400">Failed to save. Please try again.</p>
                                )}

                                {slackUrl && !isValidWebhookUrl && (
                                    <p className="text-sm text-muted-foreground">
                                        ℹ️ Re-enter your full webhook URL to test the connection.
                                    </p>
                                )}

                                {slackTestResult && (
                                    <p className={`text-sm ${slackTestResult === "success" ? "text-emerald-400" : "text-red-400"
                                        }`}>
                                        {slackTestResult === "success"
                                            ? "✓ Test message sent! Check your Slack channel."
                                            : "✗ Failed to send test message. Check your webhook URL."}
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
