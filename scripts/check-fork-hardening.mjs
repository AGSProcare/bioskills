#!/usr/bin/env node
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PINNABLE_EXTENSIONS, applyPins, findUnpinned } from "./version-pins.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fix = process.argv.includes("--fix");
const failures = [];

async function listFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listFiles(abs)));
    else if (entry.isFile() && PINNABLE_EXTENSIONS.has(path.extname(entry.name))) out.push(abs);
  }
  return out;
}

for (const file of await listFiles(repoRoot)) {
  const rel = path.relative(repoRoot, file);
  let body = await readFile(file, "utf8");
  if (fix) {
    const pinned = applyPins(body);
    if (pinned !== body) {
      await writeFile(file, pinned);
      console.log(`Pinned versions in ${rel}`);
      body = pinned;
    }
  }
  for (const hit of findUnpinned(body)) {
    failures.push(`${rel}: unpinned "${hit}" (add it to scripts/version-pins.mjs, then run npm run fix:pins)`);
  }
}

const workflows = path.join(repoRoot, ".github/workflows");
const updateWorkflow = await readFile(path.join(workflows, "update-agent-native-plan-skills.yml"), "utf8");
if (/gh pr merge/.test(updateWorkflow)) {
  failures.push("update-agent-native-plan-skills.yml: synced upstream content must not be auto-merged (remove `gh pr merge`)");
}

const recapWorkflow = await readFile(path.join(workflows, "pr-visual-recap.yml"), "utf8");
if (!recapWorkflow.includes("is not trusted (needs OWNER, MEMBER, or COLLABORATOR)")) {
  failures.push("pr-visual-recap.yml: trusted-author gate is missing");
}
if (/RECAP_CLI_VERSION:.*'latest'/.test(recapWorkflow)) {
  failures.push("pr-visual-recap.yml: RECAP_CLI_VERSION must default to an exact version");
}

for (const name of await readdir(workflows)) {
  const body = await readFile(path.join(workflows, name), "utf8");
  for (const [, pkg, version] of body.matchAll(/npx -y ((?:@[\w.-]+\/)?[\w.-]+)@(\S+)/g)) {
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      failures.push(`${name}: npx ${pkg}@${version} must use an exact version`);
    }
  }
}

if (failures.length) {
  console.error(`Fork hardening check failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("Fork hardening check passed");
}
