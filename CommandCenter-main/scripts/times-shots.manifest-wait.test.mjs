/**
 * Run with: node CommandCenter-main/scripts/times-shots.manifest-wait.test.mjs
 * The shoot job's decision to keep waiting, send the flat A1, or fall back.
 */
import assert from "node:assert/strict";
import { MANIFEST_POLL_MS, MANIFEST_WAIT_MS, manifestWaitDecision } from "./times-shots.mjs";

assert.equal(MANIFEST_WAIT_MS, 30 * 60 * 1000);
assert.equal(MANIFEST_POLL_MS, 30 * 1000);

assert.equal(manifestWaitDecision(0, false), "wait");
assert.equal(manifestWaitDecision(MANIFEST_WAIT_MS - 1, false), "wait");
assert.equal(manifestWaitDecision(15 * 60 * 1000, false), "wait");

assert.equal(manifestWaitDecision(0, true), "flat");
assert.equal(manifestWaitDecision(MANIFEST_WAIT_MS, true), "flat", "a manifest on the last poll still sends the flat A1");

assert.equal(manifestWaitDecision(MANIFEST_WAIT_MS, false), "fallback");
assert.equal(manifestWaitDecision(MANIFEST_WAIT_MS + 30_000, false), "fallback");

console.log("times-shots.manifest-wait ok");
