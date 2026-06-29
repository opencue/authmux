// Theme X4 divergence: `parallel` bypasses BaseCommand per
// `01-ARCHITECTURE.md` §1.3 (no auth/registry coupling). We wire --json
// manually using `json-envelope.ts` to keep the on-the-wire shape consistent
// with BaseCommand commands.

import { Command, Flags } from "@oclif/core";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  jsonSuccess,
  writeJsonEnvelope,
} from "../lib/cli/json-envelope";

const CLAUDE_PARALLEL_DIR = path.join(os.homedir(), ".claude-accounts");
const CLAUDE_PARALLEL_BACKUP_DIR = path.join(os.homedir(), ".claude-accounts-backups");
const SKILL_PROFILE_FILE = ".authmux-skill-profile";
const CUE_PROFILE_FILE = ".authmux-cue-profile";
const DEFAULT_CUE_PROFILE = "core";
type ShellName = "bash" | "zsh" | "fish";
type LoginProfileOptions = {
  fresh: boolean;
  requireDistinct: boolean;
};

type AuthBackup = {
  dir: string;
  files: Array<{ name: string; source: string; backup: string }>;
};

interface ParallelProfileEntry {
  name: string;
  configDir: string;
  skillProfile: string;
  cueProfile: string;
  credentialsPresent: boolean;
  claudeAccountStateStale: boolean;
  credentialsDuplicateOf?: string;
  claudeAccountDuplicateOf?: string;
}

function getProfiles(): string[] {
  if (!fs.existsSync(CLAUDE_PARALLEL_DIR)) return [];
  return fs.readdirSync(CLAUDE_PARALLEL_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => d.name)
    .sort();
}

function detectDefaultShell(): ShellName {
  const shell = process.env.SHELL || "/bin/bash";
  if (shell.includes("fish")) return "fish";
  if (shell.includes("zsh")) return "zsh";
  return "bash";
}

function resolveShellName(shell: string | undefined): ShellName {
  if (!shell || shell === "auto") return detectDefaultShell();
  return shell as ShellName;
}

function shellRcPath(shell: ShellName): string {
  if (shell === "zsh") return path.join(os.homedir(), ".zshrc");
  return path.join(os.homedir(), ".bashrc");
}

function fishFunctionsDir(): string {
  return path.join(os.homedir(), ".config", "fish", "functions");
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function fishQuote(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function readSkillProfile(name: string): string | undefined {
  const file = path.join(CLAUDE_PARALLEL_DIR, name, SKILL_PROFILE_FILE);
  if (!fs.existsSync(file)) return undefined;
  const profile = fs.readFileSync(file, "utf8").trim();
  return profile.length > 0 ? profile : undefined;
}

function writeSkillProfile(name: string, skillProfile: string): void {
  const file = path.join(CLAUDE_PARALLEL_DIR, name, SKILL_PROFILE_FILE);
  fs.writeFileSync(file, `${skillProfile.trim()}\n`);
}

function readCueProfile(name: string): string | undefined {
  const file = path.join(CLAUDE_PARALLEL_DIR, name, CUE_PROFILE_FILE);
  if (!fs.existsSync(file)) return undefined;
  const profile = fs.readFileSync(file, "utf8").trim();
  return profile.length > 0 ? profile : undefined;
}

function writeCueProfile(name: string, cueProfile: string): void {
  const file = path.join(CLAUDE_PARALLEL_DIR, name, CUE_PROFILE_FILE);
  fs.writeFileSync(file, `${cueProfile.trim()}\n`);
}

function credentialsPathForProfile(name: string): string {
  return path.join(CLAUDE_PARALLEL_DIR, name, ".credentials.json");
}

function claudeStatePathForProfile(name: string): string {
  return path.join(CLAUDE_PARALLEL_DIR, name, ".claude.json");
}

function authFilePathsForProfile(name: string): Array<{ name: string; source: string }> {
  return [
    { name: ".credentials.json", source: credentialsPathForProfile(name) },
    { name: ".claude.json", source: claudeStatePathForProfile(name) },
  ];
}

function backupTimestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.(\d{3})Z$/, "$1Z");
}

function backupProfileAuthFiles(name: string, reason: string): AuthBackup | undefined {
  const files = authFilePathsForProfile(name).filter((file) => fs.existsSync(file.source));
  if (!files.length) return undefined;

  const backupDir = path.join(CLAUDE_PARALLEL_BACKUP_DIR, `${name}-${reason}-${backupTimestamp()}`);
  fs.mkdirSync(backupDir, { recursive: true });
  const backup: AuthBackup = { dir: backupDir, files: [] };

  for (const file of files) {
    const backupPath = path.join(backupDir, file.name);
    fs.renameSync(file.source, backupPath);
    backup.files.push({ ...file, backup: backupPath });
  }

  return backup;
}

function restoreProfileAuthBackup(backup: AuthBackup | undefined): void {
  if (!backup) return;

  for (const file of backup.files) {
    if (fs.existsSync(file.source)) continue;
    fs.mkdirSync(path.dirname(file.source), { recursive: true });
    fs.renameSync(file.backup, file.source);
  }
}

function hashFileIfPresent(file: string): string | undefined {
  if (!fs.existsSync(file)) return undefined;
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(file));
  return hash.digest("hex");
}

function statFileIfPresent(file: string): fs.Stats | undefined {
  return fs.statSync(file, { throwIfNoEntry: false }) ?? undefined;
}

function readClaudeAccountUuid(name: string, credentialsMtimeMs?: number): {
  uuid?: string;
  stale: boolean;
} {
  const file = claudeStatePathForProfile(name);
  const stateStat = statFileIfPresent(file);
  if (!stateStat) return { stale: false };

  if (credentialsMtimeMs !== undefined && stateStat.mtimeMs < credentialsMtimeMs) {
    return { stale: true };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as {
      oauthAccount?: { accountUuid?: unknown };
    };
    const uuid = parsed.oauthAccount?.accountUuid;
    return {
      uuid: typeof uuid === "string" && uuid.length > 0 ? uuid : undefined,
      stale: false,
    };
  } catch {
    return { stale: false };
  }
}

function duplicateOwner<T extends string | undefined>(
  value: T,
  seen: Map<string, string>,
  profile: string,
): string | undefined {
  if (!value) return undefined;
  const existing = seen.get(value);
  if (existing) return existing;
  seen.set(value, profile);
  return undefined;
}

function buildProfileEntries(profiles = getProfiles()): ParallelProfileEntry[] {
  const seenCredentialHashes = new Map<string, string>();
  const seenClaudeAccountUuids = new Map<string, string>();

  return profiles.map((p) => {
    const credentialsPath = credentialsPathForProfile(p);
    const credentialsStat = statFileIfPresent(credentialsPath);
    const credentialHash = credentialsStat ? hashFileIfPresent(credentialsPath) : undefined;
    const claudeAccount = readClaudeAccountUuid(p, credentialsStat?.mtimeMs);

    return {
      name: p,
      configDir: path.join(CLAUDE_PARALLEL_DIR, p),
      skillProfile: readSkillProfile(p) ?? "base",
      cueProfile: readCueProfile(p) ?? readSkillProfile(p) ?? DEFAULT_CUE_PROFILE,
      credentialsPresent: Boolean(credentialHash),
      claudeAccountStateStale: claudeAccount.stale,
      credentialsDuplicateOf: duplicateOwner(credentialHash, seenCredentialHashes, p),
      claudeAccountDuplicateOf: duplicateOwner(claudeAccount.uuid, seenClaudeAccountUuids, p),
    };
  });
}

export default class ClaudeParallel extends Command {
  static description = "Manage parallel Claude Code accounts via CLAUDE_CONFIG_DIR";

  static flags = {
    add: Flags.string({ description: "Add a new profile name" }),
    login: Flags.string({ description: "Run Claude Code login inside a parallel profile" }),
    fresh: Flags.boolean({ description: "Back up and remove existing Claude auth before --login" }),
    "require-distinct": Flags.boolean({
      description: "Fail --login if the result matches another Claude profile",
    }),
    remove: Flags.string({ description: "Remove a profile" }),
    aliases: Flags.boolean({ description: "Print shell aliases for all profiles" }),
    install: Flags.boolean({ description: "Install aliases into shell rc file" }),
    list: Flags.boolean({ char: "l", description: "List profiles" }),
    "skill-profile": Flags.string({ description: "Soul skill profile for this Claude profile" }),
    "cue-profile": Flags.string({ description: "Cue profile used by generated claude-<name> aliases" }),
    shell: Flags.string({
      description: "Shell syntax for --aliases/--install",
      options: ["auto", "bash", "zsh", "fish"],
      default: "auto",
    }),
    json: Flags.boolean({
      description: "Emit a single JSON envelope to stdout (Theme X4).",
      default: false,
    }),
  } as const;

  static examples = [
    "agent-auth parallel --add work",
    "agent-auth parallel --add frontend --skill-profile frontend",
    "agent-auth parallel --add personal",
    "agent-auth parallel --login work",
    "agent-auth parallel --login work --fresh --require-distinct",
    "agent-auth parallel --list",
    "agent-auth parallel --aliases",
    "agent-auth parallel --install",
  ];

  private jsonMode = false;

  async run(): Promise<void> {
    const { flags } = await this.parse(ClaudeParallel);
    this.jsonMode = Boolean(flags.json);
    const shell = resolveShellName(flags.shell);

    if (flags.add) {
      this.addProfile(flags.add, flags["skill-profile"], flags["cue-profile"]);
    } else if (flags.login) {
      this.loginProfile(flags.login, {
        fresh: Boolean(flags.fresh),
        requireDistinct: Boolean(flags["require-distinct"]),
      });
    } else if (flags.remove) {
      this.removeProfile(flags.remove);
    } else if (flags.install) {
      this.installAliases(shell);
    } else if (flags.aliases) {
      this.printAliases(shell);
    } else {
      this.listProfiles();
    }
  }

  private addProfile(name: string, skillProfile?: string, cueProfile?: string): void {
    const dir = path.join(CLAUDE_PARALLEL_DIR, name);
    const existed = fs.existsSync(dir);
    if (!existed) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (skillProfile) {
      writeSkillProfile(name, skillProfile);
    }
    const resolvedCueProfile = cueProfile ?? readCueProfile(name) ?? skillProfile ?? DEFAULT_CUE_PROFILE;
    if (cueProfile || !readCueProfile(name)) {
      writeCueProfile(name, resolvedCueProfile);
    }

    if (this.jsonMode) {
      writeJsonEnvelope(jsonSuccess({
        action: "add" as const,
        profile: name,
        dir,
        created: !existed,
        skillProfile: skillProfile ?? readSkillProfile(name) ?? "base",
        cueProfile: resolvedCueProfile,
      }));
      return;
    }

    if (existed) {
      this.log(`Profile "${name}" already exists at ${dir}`);
      if (skillProfile) {
        this.log(`  Skill profile: ${skillProfile}`);
      }
      this.log(`  Cue profile: ${resolvedCueProfile}`);
      return;
    }
    this.log(`Created profile: ${name}`);
    this.log(`  Config dir: ${dir}`);
    this.log(`  Skill profile: ${skillProfile ?? "base"}`);
    this.log(`  Cue profile: ${resolvedCueProfile}`);
    this.log(`  Run: CLAUDE_CONFIG_DIR=${dir} claude`);
    this.log(`\nTo install shell aliases: agent-auth parallel --install`);
  }

  private loginProfile(name: string, options: LoginProfileOptions): void {
    if (this.jsonMode) {
      this.error("parallel --login is interactive and does not support --json.");
    }

    const dir = path.join(CLAUDE_PARALLEL_DIR, name);
    const existed = fs.existsSync(dir);
    if (!existed) {
      fs.mkdirSync(dir, { recursive: true });
      writeCueProfile(name, DEFAULT_CUE_PROFILE);
      this.log(`Created profile: ${name}`);
      this.log(`  Config dir: ${dir}`);
    }

    const existingBackup = options.fresh ? backupProfileAuthFiles(name, "fresh-login") : undefined;
    if (existingBackup) {
      this.log(`Backed up existing Claude auth for "${name}" to ${existingBackup.dir}.`);
    }

    const credentialsPath = credentialsPathForProfile(name);
    const before = fs.statSync(credentialsPath, { throwIfNoEntry: false })?.mtimeMs ?? 0;
    const result = spawnSync("claude", ["login"], {
      stdio: "inherit",
      env: {
        ...process.env,
        CLAUDE_CONFIG_DIR: dir,
      },
    });

    if (result.error) {
      restoreProfileAuthBackup(existingBackup);
      const err = result.error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        this.error("`claude` CLI was not found in PATH. Install Claude Code first, then retry.");
      }
      throw result.error;
    }

    if (result.status !== 0) {
      restoreProfileAuthBackup(existingBackup);
      this.error(`\`claude login\` failed with exit code ${result.status ?? "unknown"}.`);
    }

    const after = fs.statSync(credentialsPath, { throwIfNoEntry: false });
    if (!after) {
      restoreProfileAuthBackup(existingBackup);
      this.error(`Claude login completed but did not write ${credentialsPath}.`);
    }

    const duplicateEntry = buildProfileEntries().find((p) => p.name === name);
    const duplicateOwner = duplicateEntry?.credentialsDuplicateOf ?? duplicateEntry?.claudeAccountDuplicateOf;
    if (options.requireDistinct && duplicateOwner) {
      const duplicateBackup = backupProfileAuthFiles(name, "duplicate-login");
      this.error(
        `Claude login for "${name}" produced the same account as "${duplicateOwner}". ` +
          `The duplicate auth was moved to ${duplicateBackup?.dir ?? "a backup directory"}. ` +
          "Run the login again and choose a different Anthropic account.",
      );
    }

    const suffix = after.mtimeMs > before ? "refreshed" : "present";
    this.log(`Claude credentials ${suffix} for "${name}" at ${credentialsPath}.`);
    this.warnIfProfileDuplicates(name);
  }

  private removeProfile(name: string): void {
    const dir = path.join(CLAUDE_PARALLEL_DIR, name);
    if (!fs.existsSync(dir)) {
      this.error(`Profile "${name}" not found.`);
    }
    fs.rmSync(dir, { recursive: true });

    if (this.jsonMode) {
      writeJsonEnvelope(jsonSuccess({
        action: "remove" as const,
        profile: name,
        dir,
      }));
      return;
    }
    this.log(`Removed profile: ${name}`);
  }

  private listProfiles(): void {
    const profiles = getProfiles();
    const entries = buildProfileEntries(profiles);

    if (this.jsonMode) {
      writeJsonEnvelope(jsonSuccess({
        action: "list" as const,
        profiles: entries,
      }));
      return;
    }

    if (!profiles.length) {
      this.log("No Claude Code parallel profiles configured.");
      this.log("Add one: agent-auth parallel --add <name>");
      return;
    }
    this.log("Claude Code parallel profiles:\n");
    for (const p of entries) {
      const duplicateBits = [
        p.credentialsDuplicateOf ? `credentialsDuplicateOf=${p.credentialsDuplicateOf}` : undefined,
        p.claudeAccountDuplicateOf ? `claudeAccountDuplicateOf=${p.claudeAccountDuplicateOf}` : undefined,
        p.claudeAccountStateStale ? "claudeAccountState=stale" : undefined,
      ].filter(Boolean);
      const duplicateSuffix = duplicateBits.length ? ` ${duplicateBits.join(" ")}` : "";
      this.log(
        `  • ${p.name}  →  ${p.configDir}  skillProfile=${p.skillProfile} cueProfile=${p.cueProfile}` +
          ` credentials=${p.credentialsPresent ? "present" : "missing"}${duplicateSuffix}`,
      );
    }
    this.warnForDuplicateEntries(entries);
    this.log(`\nRun any profile: claude-<name> (after installing aliases)`);
  }

  private warnIfProfileDuplicates(name: string): void {
    const entry = buildProfileEntries().find((p) => p.name === name);
    if (!entry) return;

    if (entry.credentialsDuplicateOf || entry.claudeAccountDuplicateOf) {
      const other = entry.credentialsDuplicateOf ?? entry.claudeAccountDuplicateOf;
      this.warn(
        `Profile "${name}" uses the same Claude login as "${other}". ` +
          "Those profiles are not independent; logging in or out of one can invalidate the other.",
      );
      this.warn("Log this profile in with a different Anthropic account to run true parallel sessions.");
    }
  }

  private warnForDuplicateEntries(entries: ParallelProfileEntry[]): void {
    const duplicates = entries.filter((p) => p.credentialsDuplicateOf || p.claudeAccountDuplicateOf);
    if (!duplicates.length) return;

    for (const entry of duplicates) {
      const other = entry.credentialsDuplicateOf ?? entry.claudeAccountDuplicateOf;
      this.warn(
        `Profile "${entry.name}" shares a Claude login with "${other}". ` +
          "Use a different Anthropic account if these should run independently.",
      );
    }
  }

  private generateBashAliases(): string {
    const profiles = getProfiles();
    if (!profiles.length) return "";
    const lines = [
      "# Claude Code parallel accounts (managed by agent-auth)",
      "__authmux_claude_account() {",
      "  local name=\"$1\"",
      "  local skill_profile=\"${2:-base}\"",
      `  local cue_profile="\${3:-${DEFAULT_CUE_PROFILE}}"`,
      "  shift 3",
      "  local dir=\"$HOME/.claude-accounts/$name\"",
      "  command authmux skills activate \"$skill_profile\" --agent claude --target \"$dir/skills\" >/dev/null 2>&1 || true",
      "  if [ \"${1:-}\" = \"login\" ]; then",
      "    command authmux parallel --login \"$name\" --fresh --require-distinct",
      "    return $?",
      "  fi",
      "  if [ \"${1:-}\" = \"logout\" ]; then",
      "    CLAUDE_CONFIG_DIR=\"$dir\" command claude \"$@\"",
      "    return $?",
      "  fi",
      "  if [ \"$#\" -eq 0 ] && [ ! -s \"$dir/.credentials.json\" ]; then",
      "    command authmux parallel --login \"$name\" --fresh --require-distinct || return $?",
      "  fi",
      "  if command -v cue >/dev/null 2>&1 && [ -z \"${AUTHMUX_SKIP_CUE_LAUNCH:-}\" ]; then",
      // The sentinel `pick` means \"don't force a profile — open cue's selector\".
      // Any other value is forced via --cue-profile (which suppresses the picker).
      "    if [ \"$cue_profile\" = \"pick\" ]; then",
      "      CLAUDE_CONFIG_DIR=\"$dir\" cue launch claude --cue-pick \"$@\"",
      "    else",
      "      CLAUDE_CONFIG_DIR=\"$dir\" cue launch claude --cue-profile \"$cue_profile\" \"$@\"",
      "    fi",
      "  else",
      "    CLAUDE_CONFIG_DIR=\"$dir\" command claude \"$@\"",
      "  fi",
      "}",
      ...profiles.map((p) => {
        const skillProfile = readSkillProfile(p) ?? "base";
        const cueProfile = readCueProfile(p) ?? DEFAULT_CUE_PROFILE;
        return `alias claude-${p}="__authmux_claude_account ${shellQuote(p)} ${shellQuote(skillProfile)} ${shellQuote(cueProfile)}"`;
      }),
    ];
    return lines.join("\n");
  }

  private generateFishFunction(profile: string): string {
    const skillProfile = readSkillProfile(profile) ?? "base";
    const cueProfile = readCueProfile(profile) ?? DEFAULT_CUE_PROFILE;
    const lines = [
      `function claude-${profile} --description ${fishQuote(`Claude Code with ${profile} config`)}`,
      `    set -l name ${fishQuote(profile)}`,
      `    set -l skill_profile ${fishQuote(skillProfile)}`,
      `    set -l cue_profile ${fishQuote(cueProfile)}`,
      "    set -l dir \"$HOME/.claude-accounts/$name\"",
      "    command authmux skills activate \"$skill_profile\" --agent claude --target \"$dir/skills\" >/dev/null 2>&1; or true",
      "    set -lx CLAUDE_CONFIG_DIR \"$dir\"",
      "    if set -q argv[1]; and test \"$argv[1]\" = login",
      "        command authmux parallel --login \"$name\" --fresh --require-distinct",
      "        return $status",
      "    end",
      "    if set -q argv[1]; and test \"$argv[1]\" = logout",
      "        command claude $argv",
      "        return $status",
      "    end",
      "    if not set -q argv[1]; and not test -s \"$dir/.credentials.json\"",
      "        command authmux parallel --login \"$name\" --fresh --require-distinct",
      "        or return $status",
      "    end",
      "    if command -q cue; and not set -q AUTHMUX_SKIP_CUE_LAUNCH",
      cueProfile === "pick"
        ? "        cue launch claude --cue-pick $argv"
        : "        cue launch claude --cue-profile \"$cue_profile\" $argv",
      "    else",
      "        command claude $argv",
      "    end",
      "end",
    ];
    return lines.join("\n");
  }

  private generateAliases(shell: ShellName): string {
    if (shell === "fish") {
      return getProfiles().map((p) => this.generateFishFunction(p)).join("\n\n");
    }
    return this.generateBashAliases();
  }

  private printAliases(shell: ShellName): void {
    const aliases = this.generateAliases(shell);
    const profiles = getProfiles();

    if (this.jsonMode) {
      writeJsonEnvelope(jsonSuccess({
        action: "aliases" as const,
        shell,
        profiles,
        aliases,
      }));
      return;
    }

    if (!aliases) {
      this.log("No profiles. Add one first: agent-auth parallel --add <name>");
      return;
    }
    this.log(aliases);
  }

  private installAliases(shell: ShellName): void {
    const profiles = getProfiles();
    if (!profiles.length) {
      this.error("No profiles. Add one first: agent-auth parallel --add <name>");
    }

    if (shell === "fish") {
      this.installFishFunctions(profiles);
      return;
    }

    const rc = shellRcPath(shell);
    const marker = "# >>> agent-auth parallel >>>";
    const endMarker = "# <<< agent-auth parallel <<<";
    const block = [marker, this.generateAliases(shell), endMarker].join("\n");

    let content = "";
    if (fs.existsSync(rc)) {
      content = fs.readFileSync(rc, "utf-8");
      const startIdx = content.indexOf(marker);
      const endIdx = content.indexOf(endMarker);
      if (startIdx !== -1 && endIdx !== -1) {
        content = content.slice(0, startIdx) + content.slice(endIdx + endMarker.length + 1);
      }
    }

    content = content.trimEnd() + "\n\n" + block + "\n";
    fs.writeFileSync(rc, content);

    if (this.jsonMode) {
      writeJsonEnvelope(jsonSuccess({
        action: "install" as const,
        shell,
        rc,
        profiles,
      }));
      return;
    }
    this.log(`Installed aliases in ${rc}`);
    this.log(`Run: source ${rc}`);
    this.log(`\nAvailable commands:`);
    for (const p of profiles) {
      this.log(`  claude-${p}`);
    }
  }

  private installFishFunctions(profiles: string[]): void {
    const functionsDir = fishFunctionsDir();
    fs.mkdirSync(functionsDir, { recursive: true });
    const files = profiles.map((p) => {
      const file = path.join(functionsDir, `claude-${p}.fish`);
      fs.writeFileSync(file, `${this.generateFishFunction(p)}\n`);
      return file;
    });

    if (this.jsonMode) {
      writeJsonEnvelope(jsonSuccess({
        action: "install" as const,
        shell: "fish" as const,
        functionsDir,
        files,
        profiles,
      }));
      return;
    }

    this.log(`Installed Fish functions in ${functionsDir}`);
    this.log(`\nAvailable commands:`);
    for (const p of profiles) {
      this.log(`  claude-${p}`);
    }
  }
}
