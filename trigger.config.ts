import { defineConfig } from "@trigger.dev/sdk/v3";
import { playwright } from "@trigger.dev/build/extensions/playwright";

export default defineConfig({
    project: "rivaleye",
    runtime: "node",
    logLevel: "log",
    // Maximum run time for each task
    maxDuration: 300, // 5 minutes
    retries: {
        enabledInDev: true,
        default: {
            maxAttempts: 3,
            minTimeoutInMs: 1000,
            maxTimeoutInMs: 10000,
            factor: 2,
        },
    },
    dirs: ["./src/trigger"],
    // Build extensions for Playwright support
    build: {
        extensions: [
            playwright(), // Installs Playwright and browsers in the container
        ],
    },
});

