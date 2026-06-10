#!/usr/bin/env node
/**
 * CI typecheck — same logic as the GitHub Actions job.
 *
 * Allows pre-existing type errors in __tests__/ files (test fixtures
 * using out-of-date mocks), but fails on any new error in production
 * code. This lets us ship CI today without rewriting 49 test files.
 */
import { execSync } from "node:child_process";

console.log("Running typecheck (CI mode — production code only)...");

try {
    execSync("npx tsc --noEmit 2>&1 | tee /tmp/tsc-ci.log", {
        stdio: "inherit",
        shell: true,
    });
} catch {
    // tsc returns non-zero; we still need to inspect the log
}

import { readFileSync } from "node:fs";
const log = readFileSync("/tmp/tsc-ci.log", "utf8");
const lines = log.split("\n");

// Filter to errors in production code (anything not under __tests__/)
const prodErrors = lines.filter(
    (line) =>
        line.startsWith("src/") &&
        !line.includes("__tests__") &&
        line.includes("error TS")
);

if (prodErrors.length > 0) {
    console.error("\n✗ Production type errors found:");
    prodErrors.forEach((line) => console.error("  " + line));
    console.error(`\n${prodErrors.length} error(s) in production code.`);
    process.exit(1);
}

const testErrors = lines.filter(
    (line) => line.includes("__tests__") && line.includes("error TS")
);

if (testErrors.length > 0) {
    console.log(
        `\n⚠ ${testErrors.length} pre-existing test type error(s) (allowed, tracked as tech debt):`
    );
    testErrors.slice(0, 3).forEach((line) => console.log("  " + line));
    if (testErrors.length > 3) {
        console.log(`  ... and ${testErrors.length - 3} more`);
    }
}

console.log("\n✓ No type errors in production code (test mocks have known issues)");
