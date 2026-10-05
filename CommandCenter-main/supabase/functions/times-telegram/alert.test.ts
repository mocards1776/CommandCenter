/**
 * Run with:
 *   node --experimental-strip-types supabase/functions/times-telegram/alert.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  IMAGE_WAIT_MS,
  SHOTS_WORKFLOW_FILE,
  SHOTS_WORKFLOW_REF,
  SHOTS_WORKFLOW_REPO,
  imageAlertDecision,
  kickedIssueFromDetail,
  shotsDispatchAccepted,
  shotsDispatchBody,
  shotsDispatchUrl,
} from "./alert.ts";

test("image wait is twelve minutes, matching the workflow timeout", () => {
  assert.equal(IMAGE_WAIT_MS, 12 * 60_000);
});

test("dispatch URL and body stay on this public repo's main workflow", () => {
  assert.equal(
    shotsDispatchUrl(),
    `https://api.github.com/repos/${SHOTS_WORKFLOW_REPO}/actions/workflows/${SHOTS_WORKFLOW_FILE}/dispatches`,
  );
  assert.deepEqual(shotsDispatchBody("2026-10-05-morning"), {
    ref: SHOTS_WORKFLOW_REF,
    inputs: { issue_id: "2026-10-05-morning" },
  });
  assert.equal(SHOTS_WORKFLOW_REF, "main");
  assert.equal(SHOTS_WORKFLOW_FILE, "times-telegram-shots.yml");
});

test("GitHub 204 or an already-running 422 counts as a successful kick", () => {
  assert.equal(shotsDispatchAccepted(204), true);
  assert.equal(shotsDispatchAccepted(200), true);
  assert.equal(shotsDispatchAccepted(422, "Workflow is already running"), true);
  assert.equal(shotsDispatchAccepted(422, '{"message":"Workflow does not have workflow_dispatch"}'), false);
  assert.equal(shotsDispatchAccepted(401, "Bad credentials"), false);
  assert.equal(shotsDispatchAccepted(403), false);
  assert.equal(shotsDispatchAccepted(404), false);
});

test("kickedIssueFromDetail reads only a non-empty kicked_issue string", () => {
  assert.equal(kickedIssueFromDetail(null), null);
  assert.equal(kickedIssueFromDetail({}), null);
  assert.equal(kickedIssueFromDetail({ kicked_issue: "" }), null);
  assert.equal(kickedIssueFromDetail({ kicked_issue: 1 }), null);
  assert.equal(kickedIssueFromDetail({ kicked_issue: "2026-10-05-morning" }), "2026-10-05-morning");
});

test("already-sent or max-attempt editions are skipped", () => {
  assert.equal(
    imageAlertDecision({
      alreadyFinished: true,
      alreadyClaimed: true,
      printedAgeMs: 0,
      kickedIssue: null,
      issueId: "2026-10-05-morning",
    }),
    "skip",
  );
});

test("a claimed row is handed to the text path (claim() retries only when stale)", () => {
  assert.equal(
    imageAlertDecision({
      alreadyFinished: false,
      alreadyClaimed: true,
      printedAgeMs: 30_000,
      kickedIssue: "2026-10-05-morning",
      issueId: "2026-10-05-morning",
    }),
    "send_text",
  );
});

test("this morning's miss: no kick recorded → dispatch, do not send text yet", () => {
  assert.equal(
    imageAlertDecision({
      alreadyFinished: false,
      alreadyClaimed: false,
      printedAgeMs: 7_000,
      kickedIssue: null,
      issueId: "2026-10-05-morning",
    }),
    "kick",
  );
});

test("a schedule peek for another edition does not suppress the kick", () => {
  assert.equal(
    imageAlertDecision({
      alreadyFinished: false,
      alreadyClaimed: false,
      printedAgeMs: 60_000,
      kickedIssue: "2026-10-04-evening",
      issueId: "2026-10-05-morning",
    }),
    "kick",
  );
});

test("after a successful kick, later cron sweeps wait inside the window", () => {
  assert.equal(
    imageAlertDecision({
      alreadyFinished: false,
      alreadyClaimed: false,
      printedAgeMs: 8 * 60_000,
      kickedIssue: "2026-10-05-morning",
      issueId: "2026-10-05-morning",
    }),
    "wait",
  );
});

test("when the wait expires, text goes even if a kick was recorded", () => {
  assert.equal(
    imageAlertDecision({
      alreadyFinished: false,
      alreadyClaimed: false,
      printedAgeMs: IMAGE_WAIT_MS,
      kickedIssue: "2026-10-05-morning",
      issueId: "2026-10-05-morning",
    }),
    "send_text",
  );
  assert.equal(
    imageAlertDecision({
      alreadyFinished: false,
      alreadyClaimed: false,
      printedAgeMs: IMAGE_WAIT_MS + 1,
      kickedIssue: null,
      issueId: "2026-10-05-morning",
    }),
    "send_text",
  );
});
