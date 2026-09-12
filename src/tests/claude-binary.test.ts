import test from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { findRealClaudeBinary, needsWindowsCommandShell } from "../lib/claude-binary";

const CUE_SHIM = [
  "#!/usr/bin/env bash",
  "set -euo pipefail",
  'exec cue launch claude "$@"',
  "",
].join("\n");

// The shim logic is platform-agnostic, but discovery is not: Windows only
// checks PATHEXT names and its PATH entries carry a drive colon. Build the
// fixtures the way the host would find them and join with the host delimiter.
const HOST = process.platform;
const WIN = HOST === "win32";
const EXT = WIN ? ".CMD" : "";
const HOST_OPTS = WIN ? { platform: HOST, pathExt: ".CMD" } : { platform: HOST };
const POSIX_ONLY_SKIP = WIN ? "POSIX execute bits do not apply on Windows" : false;

async function makeBinDir(root: string, name: string, content: string, mode = 0o755): Promise<string> {
  const dir = path.join(root, name);
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(path.join(dir, `claude${EXT}`), content, { mode });
  return dir;
}

async function withTempRoot(run: (root: string) => Promise<void>): Promise<void> {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "authmux-claude-bin-"));
  try {
    await run(root);
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
}

test("findRealClaudeBinary skips cue's shim and returns the next claude on PATH", async () => {
  await withTempRoot(async (root) => {
    const shims = await makeBinDir(root, "shims", CUE_SHIM);
    const real = await makeBinDir(root, "bin", "#!/bin/sh\necho real\n");
    const found = findRealClaudeBinary({ ...HOST_OPTS, pathValue: [shims, real].join(path.delimiter) });
    assert.equal(found, path.join(real, `claude${EXT}`));
  });
});

test("findRealClaudeBinary returns undefined when only the cue shim is on PATH", async () => {
  await withTempRoot(async (root) => {
    const shims = await makeBinDir(root, "shims", CUE_SHIM);
    const empty = path.join(root, "empty");
    await fsp.mkdir(empty);
    const found = findRealClaudeBinary({ ...HOST_OPTS, pathValue: [shims, empty].join(path.delimiter) });
    assert.equal(found, undefined);
  });
});

test("findRealClaudeBinary ignores missing PATH entries and directories named claude", async () => {
  await withTempRoot(async (root) => {
    const dirNamedClaude = path.join(root, "notabin");
    await fsp.mkdir(path.join(dirNamedClaude, `claude${EXT}`), { recursive: true });
    const real = await makeBinDir(root, "bin", "#!/bin/sh\necho real\n");
    const missing = path.join(root, "does-not-exist");
    const found = findRealClaudeBinary({
      ...HOST_OPTS,
      pathValue: [missing, dirNamedClaude, real].join(path.delimiter),
    });
    assert.equal(found, path.join(real, `claude${EXT}`));
  });
});

test("findRealClaudeBinary returns an absolute path for a relative PATH entry", async () => {
  await withTempRoot(async (root) => {
    const real = await makeBinDir(root, "bin", "#!/bin/sh\necho real\n");
    const relative = path.relative(process.cwd(), real);
    assert.ok(!path.isAbsolute(relative));
    const found = findRealClaudeBinary({ ...HOST_OPTS, pathValue: relative });
    assert.equal(found, path.join(real, `claude${EXT}`));
    assert.ok(found && path.isAbsolute(found));
  });
});

test("findRealClaudeBinary skips a non-executable claude ahead of a real one", { skip: POSIX_ONLY_SKIP }, async () => {
  await withTempRoot(async (root) => {
    const notExec = await makeBinDir(root, "notexec", "#!/bin/sh\necho nope\n", 0o644);
    const real = await makeBinDir(root, "bin", "#!/bin/sh\necho real\n");
    const found = findRealClaudeBinary({ ...HOST_OPTS, pathValue: [notExec, real].join(path.delimiter) });
    assert.equal(found, path.join(real, "claude"));
  });
});

test("findRealClaudeBinary honours PATHEXT on win32", async () => {
  await withTempRoot(async (root) => {
    const dir = path.join(root, "bin");
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(path.join(dir, "claude.CMD"), "@echo real\r\n");
    const found = findRealClaudeBinary({ pathValue: dir, platform: "win32", pathExt: ".EXE;.CMD" });
    assert.equal(found, path.join(dir, "claude.CMD"));
  });
});

test("needsWindowsCommandShell is true only for .cmd/.bat launchers on win32", () => {
  assert.equal(needsWindowsCommandShell("C:\\npm\\claude.cmd", "win32"), true);
  assert.equal(needsWindowsCommandShell("C:\\npm\\claude.BAT", "win32"), true);
  assert.equal(needsWindowsCommandShell("C:\\npm\\claude.exe", "win32"), false);
  assert.equal(needsWindowsCommandShell("/usr/local/bin/claude", "linux"), false);
  assert.equal(needsWindowsCommandShell("/tmp/claude.cmd", "linux"), false);
});
