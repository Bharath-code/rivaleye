import { defineConfig } from "@trigger.dev/sdk/v3";

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
});

