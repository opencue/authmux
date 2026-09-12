import test from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { findRealClaudeBinary } from "../lib/claude-binary";

const CUE_SHIM = [
  "#!/usr/bin/env bash",
  "set -euo pipefail",
  'exec cue launch claude "$@"',
  "",
].join("\n");

async function makeBinDir(root: string, name: string, content: string): Promise<string> {
  const dir = path.join(root, name);
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(path.join(dir, "claude"), content, { mode: 0o755 });
  return dir;
}

test("findRealClaudeBinary skips cue's shim and returns the next claude on PATH", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "authmux-claude-bin-"));
  try {
    const shims = await makeBinDir(root, "shims", CUE_SHIM);
    const real = await makeBinDir(root, "bin", "#!/bin/sh\necho real\n");
    const found = findRealClaudeBinary({ pathValue: [shims, real].join(":"), platform: "linux" });
    assert.equal(found, path.join(real, "claude"));
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
});

test("findRealClaudeBinary returns undefined when only the cue shim is on PATH", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "authmux-claude-bin-"));
  try {
    const shims = await makeBinDir(root, "shims", CUE_SHIM);
    const empty = path.join(root, "empty");
    await fsp.mkdir(empty);
    const found = findRealClaudeBinary({ pathValue: [shims, empty].join(":"), platform: "linux" });
    assert.equal(found, undefined);
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
});

test("findRealClaudeBinary ignores missing PATH entries and directories named claude", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "authmux-claude-bin-"));
  try {
    const dirNamedClaude = path.join(root, "notabin");
    await fsp.mkdir(path.join(dirNamedClaude, "claude"), { recursive: true });
    const real = await makeBinDir(root, "bin", "#!/bin/sh\necho real\n");
    const missing = path.join(root, "does-not-exist");
    const found = findRealClaudeBinary({
      pathValue: [missing, dirNamedClaude, real].join(":"),
      platform: "linux",
    });
    assert.equal(found, path.join(real, "claude"));
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
});

test("findRealClaudeBinary honours PATHEXT on win32", async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "authmux-claude-bin-"));
  try {
    const dir = path.join(root, "bin");
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(path.join(dir, "claude.CMD"), "@echo real\r\n");
    const found = findRealClaudeBinary({ pathValue: dir, platform: "win32", pathExt: ".EXE;.CMD" });
    assert.equal(found, path.join(dir, "claude.CMD"));
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
});
