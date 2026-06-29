#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function isTruthy(value) {
  return typeof value === "string" && /^(1|true|yes|on)$/i.test(value.trim());
}

function findCommand(command) {
  const extensions = process.platform === "win32"
    ? (process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(";")
    : [""];

  for (const entry of (process.env.PATH || "").split(path.delimiter)) {
    if (!entry) continue;
    for (const extension of extensions) {
      const candidate = path.join(entry, `${command}${extension}`);
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch {
        // Try the next PATH entry.
      }
    }
  }
  return null;
}

function detectShell() {
  const shell = (process.env.SHELL || "").toLowerCase();
  if (shell.includes("fish")) return "fish";
  if (shell.includes("zsh")) return "zsh";
  return "bash";
}

function listProfiles(home) {
  const accountsDir = path.join(home, ".claude-accounts");
  if (!fs.existsSync(accountsDir)) return [];
  return fs.readdirSync(accountsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name);
}

function backupWrappers(shell, home) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.(\d{3})Z$/, "$1Z");
  if (shell === "fish") {
    const functionsDir = path.join(home, ".config", "fish", "functions");
    if (!fs.existsSync(functionsDir)) return null;
    const files = fs.readdirSync(functionsDir)
      .filter((name) => /^claude-.+\.fish$/.test(name));
    if (!files.length) return null;
    const backupDir = path.join(home, ".config", "fish", `functions.authmux-build-backup-${stamp}`);
    fs.mkdirSync(backupDir, { recursive: true });
    for (const file of files) {
      fs.copyFileSync(path.join(functionsDir, file), path.join(backupDir, file));
    }
    return backupDir;
  }

  const rc = path.join(home, shell === "zsh" ? ".zshrc" : ".bashrc");
  if (!fs.existsSync(rc)) return null;
  const backup = `${rc}.authmux-build-backup-${stamp}`;
  fs.copyFileSync(rc, backup);
  return backup;
}

function main() {
  if (isTruthy(process.env.AUTHMUX_SKIP_POSTBUILD_PARALLEL_INSTALL)) return;

  const repoRoot = path.resolve(__dirname, "..");
  const distEntry = path.join(repoRoot, "dist", "index.js");
  if (!fs.existsSync(distEntry)) return;

  const liveAuthmux = findCommand("authmux");
  const liveTarget = liveAuthmux ? fs.realpathSync(liveAuthmux) : "";
  const force = isTruthy(process.env.AUTHMUX_REFRESH_PARALLEL_WRAPPERS);
  if (!force && liveTarget !== fs.realpathSync(distEntry)) return;

  const home = os.homedir();
  const profiles = listProfiles(home);
  if (!profiles.length) return;

  const shell = detectShell();
  const backup = backupWrappers(shell, home);
  const result = spawnSync(process.execPath, [
    distEntry,
    "parallel",
    "--install",
    "--shell",
    shell,
    "--json",
  ], {
    encoding: "utf8",
    env: {
      ...process.env,
      AUTHMUX_SKIP_POSTBUILD_PARALLEL_INSTALL: "1",
    },
  });

  if (result.status !== 0 || result.error) {
    const reason = result.error ? result.error.message : result.stderr.trim();
    process.stderr.write(`[authmux postbuild] Skipped Claude wrapper refresh: ${reason}\n`);
    return;
  }

  process.stderr.write(
    `[authmux postbuild] Refreshed Claude parallel ${shell} wrappers` +
      (backup ? `; backup=${backup}` : "") +
      ".\n",
  );
}

main();
