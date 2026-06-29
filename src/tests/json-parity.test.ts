// Theme X4 — snapshot guard for `--json` parity.
//
// Spawns the built CLI (dist/index.js) for each command that ships under
// X4's exit-criteria list, with a fresh ~/.codex sandbox, and asserts:
//
//   1. stdout is exactly one valid JSON document
//   2. The top-level shape is `{ ok: true, data: ... }` OR
//      `{ ok: false, error: { code, severity, message } }`
//   3. No banner / colors / prompt chrome leaks into stdout
//
// This protects every X4 command from regressing back to mixed plaintext.
// Per the spec, some commands need a fake `~/.codex` to run cleanly — we
// use `CODEX_AUTH_CODEX_DIR` + `HOME` overrides for that.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// This test file is compiled to CommonJS (see tsconfig.json:module=Node16
// without a top-level `"type": "module"` in package.json). `__dirname` is
// therefore available natively.
// dist/tests/json-parity.test.js → dist/index.js
const CLI_ENTRY = path.resolve(__dirname, "..", "index.js");

interface CommandCase {
  // Human-readable id for the test name + result table.
  name: string;
  // argv passed after `node dist/index.js`.
  argv: string[];
  // If true, we expect `{ ok: true, data: ... }`. If false, error envelope.
  expectOk: boolean;
  // Optional payload shape assertion run when `ok` matches.
  assertPayload?: (data: unknown) => void;
  // Optional error-envelope assertion (only used when expectOk = false).
  assertError?: (err: {
    code: string;
    severity: string;
    message: string;
  }) => void;
}

const CASES: CommandCase[] = [
  {
    name: "config (no args is a usage error)",
    argv: ["config", "auto", "--json"],
    expectOk: false,
    assertError: (err) => {
      assert.equal(err.code, "E_AUTOSWITCH_CONFIG");
    },
  },
  {
    name: "daemon --once",
    argv: ["daemon", "--once", "--json"],
    expectOk: true,
    assertPayload: (data) => {
      const d = data as { switched: boolean; reason: string };
      assert.equal(typeof d.switched, "boolean");
      assert.equal(typeof d.reason, "string");
    },
  },
  {
    name: "forecast (no accounts → empty list)",
    argv: ["forecast", "--json"],
    expectOk: true,
    assertPayload: (data) => {
      const d = data as { accounts: unknown[] };
      assert.ok(Array.isArray(d.accounts));
    },
  },
  {
    name: "savings (fresh ledger)",
    argv: ["savings", "--json"],
    expectOk: true,
    assertPayload: (data) => {
      const d = data as {
        totalSwitches: number;
        autoSwitches: number;
        rateLimitsAvoided: number;
        estimatedMinutesSaved: number;
        lastUpdated: string;
        autoSwitchRatePercent: number;
      };
      assert.equal(typeof d.totalSwitches, "number");
      assert.equal(typeof d.autoSwitches, "number");
      assert.equal(typeof d.rateLimitsAvoided, "number");
      assert.equal(typeof d.estimatedMinutesSaved, "number");
      assert.equal(typeof d.lastUpdated, "string");
      assert.equal(typeof d.autoSwitchRatePercent, "number");
    },
  },
  {
    name: "hero",
    argv: ["hero", "--json"],
    expectOk: true,
    assertPayload: (data) => {
      const d = data as { sections: Array<{ title: string; items: unknown[] }> };
      assert.ok(Array.isArray(d.sections));
      assert.ok(d.sections.length > 0);
      for (const section of d.sections) {
        assert.equal(typeof section.title, "string");
        assert.ok(Array.isArray(section.items));
      }
    },
  },
  {
    name: "export (no accounts dir → error envelope)",
    argv: ["export", "--json"],
    expectOk: false,
    assertError: (err) => {
      assert.equal(err.code, "E_NO_ACCOUNTS");
    },
  },
  {
    name: "import (missing path → error envelope)",
    argv: ["import", "--json"],
    expectOk: false,
    assertError: (err) => {
      assert.equal(err.code, "E_AUTH_INVALID");
      assert.match(err.message, /Provide a path/);
    },
  },
  {
    name: "parallel --list",
    argv: ["parallel", "--list", "--json"],
    expectOk: true,
    assertPayload: (data) => {
      const d = data as { action: string; profiles: unknown[] };
      assert.equal(d.action, "list");
      assert.ok(Array.isArray(d.profiles));
    },
  },
  {
    name: "kiro (no args → list)",
    argv: ["kiro", "--json"],
    expectOk: true,
    assertPayload: (data) => {
      const d = data as {
        action: string;
        accounts: unknown[];
        active: string | null;
      };
      assert.equal(d.action, "list");
      assert.ok(Array.isArray(d.accounts));
      assert.ok(d.active === null || typeof d.active === "string");
    },
  },
];

async function withSandbox<T>(fn: (env: NodeJS.ProcessEnv) => Promise<T>): Promise<T> {
  const tempHome = await fsp.mkdtemp(path.join(os.tmpdir(), "authmux-x4-"));
  const codexDir = path.join(tempHome, ".codex");
  await fsp.mkdir(codexDir, { recursive: true });

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: tempHome,
    // `os.homedir()` ignores HOME on Windows and reads USERPROFILE instead, so
    // without this the sandbox leaks into the real home dir and accounts bleed
    // across tests (parallel install then sees stale profiles). Setting both
    // keeps the sandbox isolated on every platform.
    USERPROFILE: tempHome,
    CODEX_AUTH_CODEX_DIR: codexDir,
    // Make oclif treat stdout as non-TTY so the update-notifier hook stays
    // quiet and no color codes leak into stdout.
    NO_COLOR: "1",
    CI: "1",
  };

  try {
    return await fn(env);
  } finally {
    await fsp.rm(tempHome, { recursive: true, force: true });
  }
}

function runCli(argv: string[], env: NodeJS.ProcessEnv): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync(process.execPath, [CLI_ENTRY, ...argv], {
    env,
    encoding: "utf-8",
    timeout: 15_000,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status,
  };
}

test("parallel --list flags duplicate Claude credentials", async () => {
  await withSandbox(async (env) => {
    for (const profile of ["account1", "account2"]) {
      const added = runCli(["parallel", "--add", profile, "--json"], env);
      assert.equal(added.status, 0, added.stderr);
    }

    const accountsDir = path.join(env.HOME as string, ".claude-accounts");
    const credentials = JSON.stringify({
      claudeAiOauth: {
        accessToken: "same-access-token",
        refreshToken: "same-refresh-token",
        expiresAt: 1782742285132,
      },
    });
    const claudeState = JSON.stringify({
      oauthAccount: {
        accountUuid: "same-claude-account",
      },
    });

    for (const profile of ["account1", "account2"]) {
      const profileDir = path.join(accountsDir, profile);
      await fsp.writeFile(path.join(profileDir, ".credentials.json"), credentials);
      await fsp.writeFile(path.join(profileDir, ".claude.json"), claudeState);
    }

    const listed = runCli(["parallel", "--list", "--json"], env);
    assert.equal(listed.status, 0, listed.stderr);

    const parsed = JSON.parse(listed.stdout.trim()) as {
      ok: true;
      data: {
        profiles: Array<{
          name: string;
          credentialsPresent: boolean;
          credentialsDuplicateOf?: string;
          claudeAccountDuplicateOf?: string;
        }>;
      };
    };
    const account1 = parsed.data.profiles.find((p) => p.name === "account1");
    const account2 = parsed.data.profiles.find((p) => p.name === "account2");
    assert.equal(account1?.credentialsPresent, true);
    assert.equal(account1?.credentialsDuplicateOf, undefined);
    assert.equal(account2?.credentialsPresent, true);
    assert.equal(account2?.credentialsDuplicateOf, "account1");
    assert.equal(account2?.claudeAccountDuplicateOf, "account1");
  });
});

for (const tc of CASES) {
  test(`--json parity: ${tc.name}`, async () => {
    await withSandbox(async (env) => {
      const out = runCli(tc.argv, env);

      // stdout must be exactly one valid JSON document. We parse the trimmed
      // string; anything else (banner, color codes, prompt chrome) would
      // break parse.
      const trimmed = out.stdout.trim();
      assert.ok(
        trimmed.length > 0,
        `stdout empty for ${tc.argv.join(" ")}; stderr=${out.stderr}`,
      );

      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch (err) {
        assert.fail(
          `stdout for ${tc.argv.join(" ")} is not valid JSON: ${(err as Error).message}\n` +
            `--- stdout ---\n${out.stdout}\n--- stderr ---\n${out.stderr}`,
        );
      }

      // Top-level shape.
      assert.equal(typeof parsed, "object");
      assert.notEqual(parsed, null);
      const env_ = parsed as { ok: unknown };
      assert.equal(typeof env_.ok, "boolean");

      if (tc.expectOk) {
        assert.equal(
          env_.ok,
          true,
          `expected ok=true for ${tc.argv.join(" ")}, got ${JSON.stringify(parsed)}`,
        );
        const data = (parsed as { data: unknown }).data;
        assert.notEqual(data, undefined, "ok envelope must carry a `data` field");
        if (tc.assertPayload) tc.assertPayload(data);
      } else {
        assert.equal(
          env_.ok,
          false,
          `expected ok=false for ${tc.argv.join(" ")}, got ${JSON.stringify(parsed)}`,
        );
        const error = (parsed as { error: { code: string; severity: string; message: string } }).error;
        assert.equal(typeof error.code, "string");
        assert.equal(typeof error.severity, "string");
        assert.equal(typeof error.message, "string");
        if (tc.assertError) tc.assertError(error);
      }

      // Also assert that the trimmed stdout is exactly one document — no
      // trailing extra lines, no leading banner. JSON.parse already enforced
      // it's a complete object; this checks no extra characters either side.
      const reSerialised = JSON.stringify(parsed);
      // The CLI writes a trailing newline; we already trimmed. The trimmed
      // value should now match the canonical re-serialisation.
      assert.equal(
        trimmed,
        reSerialised,
        `stdout for ${tc.argv.join(" ")} carries extra chrome around the JSON envelope`,
      );
    });
  });
}

test("parallel aliases pass explicit cue profile per Claude account", async () => {
  await withSandbox(async (env) => {
    const addDefault = runCli(
      ["parallel", "--add", "account1", "--json"],
      env,
    );
    assert.equal(addDefault.status, 0, addDefault.stderr);

    const parsedDefault = JSON.parse(addDefault.stdout.trim()) as {
      ok: true;
      data: { profile: string; skillProfile: string; cueProfile: string };
    };
    assert.equal(parsedDefault.data.profile, "account1");
    assert.equal(parsedDefault.data.skillProfile, "base");
    assert.equal(parsedDefault.data.cueProfile, "core");

    const add = runCli(
      ["parallel", "--add", "account2", "--skill-profile", "frontend", "--json"],
      env,
    );
    assert.equal(add.status, 0, add.stderr);

    const parsedAdd = JSON.parse(add.stdout.trim()) as {
      ok: true;
      data: { profile: string; skillProfile: string; cueProfile: string };
    };
    assert.equal(parsedAdd.data.profile, "account2");
    assert.equal(parsedAdd.data.skillProfile, "frontend");
    assert.equal(parsedAdd.data.cueProfile, "frontend");

    const aliases = runCli(["parallel", "--aliases", "--shell", "bash", "--json"], env);
    assert.equal(aliases.status, 0, aliases.stderr);

    const parsedAliases = JSON.parse(aliases.stdout.trim()) as {
      ok: true;
      data: { aliases: string; shell: string };
    };
    assert.equal(parsedAliases.data.shell, "bash");
    assert.match(parsedAliases.data.aliases, /__authmux_claude_account\(\)/);
    assert.match(
      parsedAliases.data.aliases,
      /authmux skills activate "\$skill_profile" --agent claude/,
    );
    assert.match(
      parsedAliases.data.aliases,
      /\[ "\$\{1:-\}" = "login" \]/,
    );
    assert.match(
      parsedAliases.data.aliases,
      /cue launch claude --cue-profile "\$cue_profile"/,
    );
    assert.match(
      parsedAliases.data.aliases,
      /alias claude-account2="__authmux_claude_account 'account2' 'frontend' 'frontend'"/,
    );
  });
});

test("parallel install writes Fish functions with direct login refresh path", async () => {
  await withSandbox(async (env) => {
    const addDefault = runCli(
      ["parallel", "--add", "account1", "--cue-profile", "pick", "--json"],
      env,
    );
    assert.equal(addDefault.status, 0, addDefault.stderr);
    await fsp.mkdir(path.join(env.HOME as string, ".claude-accounts", ".backup"), {
      recursive: true,
    });

    const install = runCli(
      ["parallel", "--install", "--shell", "fish", "--json"],
      env,
    );
    assert.equal(install.status, 0, install.stderr);

    const parsedInstall = JSON.parse(install.stdout.trim()) as {
      ok: true;
      data: { shell: string; files: string[] };
    };
    assert.equal(parsedInstall.data.shell, "fish");
    assert.equal(parsedInstall.data.files.length, 1);

    const functionPath = path.join(
      env.HOME as string,
      ".config",
      "fish",
      "functions",
      "claude-account1.fish",
    );
    const body = await fsp.readFile(functionPath, "utf8");
    assert.match(body, /set -lx CLAUDE_CONFIG_DIR "\$dir"/);
    assert.match(body, /test "\$argv\[1\]" = login/);
    assert.match(body, /not test -s "\$dir\/\.credentials\.json"/);
    assert.match(body, /cue launch claude --cue-pick \$argv/);
    assert.match(body, /command claude \$argv/);
  });
});
