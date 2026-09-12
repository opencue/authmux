import * as fs from "node:fs";
import * as path from "node:path";

// Body marker of cue's `claude` shim (`~/.config/cue/shims/claude`), a bash
// script that re-enters `cue launch claude ...`. cue then relocates
// CLAUDE_CONFIG_DIR to its own per-profile runtime dir, so anything spawned
// through the shim never writes into the authmux account dir we point it at.
const CUE_SHIM_MARKER = "cue launch claude";
const MAX_SHIM_SCRIPT_BYTES = 64_000;

export type FindClaudeBinaryOptions = {
  pathValue?: string;
  platform?: NodeJS.Platform;
  pathExt?: string;
};

function isExecutable(candidate: string): boolean {
  try {
    fs.accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function isCueShim(candidate: string, size: number): boolean {
  if (size >= MAX_SHIM_SCRIPT_BYTES) return false;
  try {
    return fs.readFileSync(candidate, "utf8").includes(CUE_SHIM_MARKER);
  } catch {
    return false;
  }
}

/**
 * First `claude` on PATH that is the real Claude Code CLI, skipping cue shims.
 * Returns undefined when no real binary is on PATH.
 */
export function findRealClaudeBinary(options: FindClaudeBinaryOptions = {}): string | undefined {
  const platform = options.platform ?? process.platform;
  const pathValue = options.pathValue ?? process.env.PATH ?? "";
  const pathEntries = pathValue.split(platform === "win32" ? ";" : ":").filter(Boolean);
  const extensions = platform === "win32"
    ? (options.pathExt ?? process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";")
    : [""];

  for (const entry of pathEntries) {
    for (const extension of extensions) {
      // Absolute, so a `.` PATH entry can't hand spawnSync a bare `claude` that
      // would be re-resolved through PATH — and hit the shim we just skipped.
      const candidate = path.resolve(entry, `claude${extension}`);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(candidate);
      } catch {
        continue;
      }
      if (!stat.isFile()) continue;
      if (platform !== "win32" && !isExecutable(candidate)) continue;
      if (isCueShim(candidate, stat.size)) continue;
      return candidate;
    }
  }
  return undefined;
}

/**
 * Node can't spawn a `.cmd`/`.bat` launcher (npm's Windows shim) directly;
 * it needs cmd.exe behind it.
 */
export function needsWindowsCommandShell(
  bin: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  return platform === "win32" && /\.(cmd|bat)$/i.test(bin);
}
