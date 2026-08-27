"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const pkg = require(path.join(root, "package.json"));
const workflowPath = path.join(root, ".github", "workflows", "release.yml");

test("package metadata identifies the canonical Authmux repository", () => {
  assert.equal(pkg.version, "0.1.27");
  assert.equal(pkg.repository.url, "git+https://github.com/opencue/authmux.git");
  assert.equal(pkg.bugs.url, "https://github.com/opencue/authmux/issues");
  assert.equal(pkg.homepage, "https://github.com/opencue/authmux#readme");
});

test("release workflow uses tokenless npm trusted publishing", () => {
  const workflow = fs.readFileSync(workflowPath, "utf8");

  assert.match(workflow, /id-token:\s*write/);
  assert.match(workflow, /environment:\s*npm/);
  assert.match(workflow, /node-version:\s*24/);
  assert.match(workflow, /package-manager-cache:\s*false/);
  assert.match(workflow, /npm publish --access public/);
  assert.doesNotMatch(workflow, /NODE_AUTH_TOKEN|NPM_TOKEN/);
});
