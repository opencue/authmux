import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { copyProfileToSession } from "../commands/parallel";

function makeProfile(): string {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "authmux-profile-"));
  fs.writeFileSync(path.join(profileDir, ".credentials.json"), "{}\n");
  fs.mkdirSync(path.join(profileDir, "projects", "-home-user-repo"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(profileDir, "projects", "-home-user-repo", "past.jsonl"),
    '{"turn":1}\n',
  );
  return profileDir;
}

const sessionPath = (): string =>
  path.join(fs.mkdtempSync(path.join(os.tmpdir(), "authmux-session-")), "s1");

test("session dir copies auth state but links projects", () => {
  const profileDir = makeProfile();
  const sessionDir = sessionPath();

  copyProfileToSession(profileDir, sessionDir);

  assert.equal(
    fs.readFileSync(path.join(sessionDir, ".credentials.json"), "utf8"),
    "{}\n",
  );
  assert.ok(
    fs.lstatSync(path.join(sessionDir, "projects")).isSymbolicLink(),
    "projects must be linked, not copied",
  );
  assert.equal(
    fs.realpathSync(path.join(sessionDir, "projects")),
    fs.realpathSync(path.join(profileDir, "projects")),
  );
  assert.equal(
    fs.readFileSync(
      path.join(sessionDir, "projects", "-home-user-repo", "past.jsonl"),
      "utf8",
    ),
    '{"turn":1}\n',
  );
});

test("transcripts written during a session survive its teardown", () => {
  const profileDir = makeProfile();
  const sessionDir = sessionPath();
  copyProfileToSession(profileDir, sessionDir);

  // What Claude Code does while running against CLAUDE_CONFIG_DIR=sessionDir.
  fs.writeFileSync(
    path.join(sessionDir, "projects", "-home-user-repo", "live.jsonl"),
    '{"turn":2}\n',
  );

  // What the launch's `finally` does on exit.
  fs.rmSync(sessionDir, { recursive: true, force: true });

  assert.equal(
    fs.readFileSync(
      path.join(profileDir, "projects", "-home-user-repo", "live.jsonl"),
      "utf8",
    ),
    '{"turn":2}\n',
    "the transcript must outlive the session dir",
  );
});

test("a profile with no projects/ still gets a durable link", () => {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "authmux-empty-"));
  const sessionDir = sessionPath();

  copyProfileToSession(profileDir, sessionDir);

  assert.ok(fs.lstatSync(path.join(sessionDir, "projects")).isSymbolicLink());
  fs.writeFileSync(path.join(sessionDir, "projects", "new.jsonl"), '{"t":3}\n');
  fs.rmSync(sessionDir, { recursive: true, force: true });
  assert.equal(
    fs.readFileSync(path.join(profileDir, "projects", "new.jsonl"), "utf8"),
    '{"t":3}\n',
  );
});
