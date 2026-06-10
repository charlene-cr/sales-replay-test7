#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const args = parseArgs(process.argv.slice(2));
const owner = args.owner ?? "charlene-cr";
const repo = args.repo ?? "sales-replay-test4";
const visibility = args.visibility ?? "private";
const dryRun = Boolean(args["dry-run"]);
const repository = `${owner}/${repo}`;

const buckets = [
  { name: "tiny", count: 2, min: 1, max: 300, targets: [82, 146] },
  { name: "small", count: 4, min: 100, max: 600, targets: [240, 360, 480, 560] },
  { name: "medium", count: 4, min: 600, max: 1200, targets: [680, 820, 980, 1160] },
  { name: "large", count: 3, min: 1201, max: 2200, targets: [1320, 1680, 2050] },
  { name: "wide", count: 2, min: 2201, max: 3600, targets: [2600, 3150] },
];

const prSpecs = [
  spec("tiny", "add-package-health-check", "Add package health check", addPackageHealthCheck),
  spec("tiny", "document-reconciliation-contract", "Document reconciliation contract", documentReconciliationContract),
  spec("small", "normalize-imported-events", "Normalize imported ledger events", normalizeImportedEvents),
  spec("small", "add-account-tag-index", "Add account tag index", addAccountTagIndex),
  spec("small", "render-batch-summary-cli", "Render batch summary CLI", renderBatchSummaryCli),
  spec("small", "load-json-ledger-snapshots", "Load JSON ledger snapshots", loadJsonLedgerSnapshots),
  spec("medium", "detect-duplicate-events", "Detect duplicate ledger events", detectDuplicateEvents),
  spec("medium", "add-reconciliation-planner", "Add reconciliation planner", addReconciliationPlanner),
  spec("medium", "track-source-system-watermarks", "Track source system watermarks", trackSourceSystemWatermarks),
  spec("medium", "add-policy-rule-engine", "Add policy rule engine", addPolicyRuleEngine),
  spec("large", "stream-import-pipeline", "Build stream import pipeline", streamImportPipeline),
  spec("large", "add-audit-report-renderer", "Add audit report renderer", addAuditReportRenderer),
  spec("large", "support-multi-currency-ledgers", "Support multi-currency ledgers", supportMultiCurrencyLedgers),
  spec("wide", "add-reconciliation-workspace", "Add reconciliation workspace", addReconciliationWorkspace),
  spec("wide", "consolidate-ledger-fixture-suite", "Consolidate ledger fixture suite", consolidateLedgerFixtureSuite),
];
const requestedPrCount = args.count === undefined ? prSpecs.length : Number(args.count);
if (!Number.isInteger(requestedPrCount) || requestedPrCount < 1 || requestedPrCount > prSpecs.length) {
  throw new Error(`--count must be an integer between 1 and ${prSpecs.length}`);
}
const selectedPrSpecs = prSpecs.slice(0, requestedPrCount);

main();

function main() {
  ensureGitRepository();
  ensureInitialCommit();
  ensureCleanTree();

  if (dryRun) {
    console.log(`Dry run: prepared local repository for ${repository}`);
    return;
  }

  ensureGitHubCli();
  ensureRemote();
  run("git", ["push", "-u", "origin", "main"]);

  for (let index = 0; index < selectedPrSpecs.length; index += 1) {
    const pr = selectedPrSpecs[index];
    const number = String(index + 1).padStart(2, "0");
    const branch = `pr/${number}-${pr.slug}`;

    run("git", ["checkout", "main"]);
    run("git", ["pull", "--ff-only", "origin", "main"]);
    deleteLocalBranch(branch);
    run("git", ["checkout", "-b", branch]);

    pr.apply({ number, slug: pr.slug, title: pr.title });
    padToBucket(pr, number);
    const localStats = changedLineStats("main");
    validateBucket(pr, localStats.total);

    run("git", ["add", "-A"]);
    run("git", ["commit", "-m", pr.title]);
    run("git", ["push", "-u", "origin", branch]);

    const body = [
      `## Summary`,
      ``,
      `- ${pr.title}`,
      `- Bucket: ${pr.bucket.name}`,
      `- Local changed lines before commit: ${localStats.total}`,
      ``,
      `## Validation`,
      ``,
      `- npm test`,
    ].join("\n");

    const prUrl = run("gh", [
      "pr",
      "create",
      "--repo",
      repository,
      "--base",
      "main",
      "--head",
      branch,
      "--title",
      pr.title,
      "--body",
      body,
    ]).trim();

    run("npm", ["test"]);
    const githubStats = JSON.parse(run("gh", [
      "pr",
      "view",
      prUrl,
      "--repo",
      repository,
      "--json",
      "number,additions,deletions,url",
    ]));
    const changedLines = githubStats.additions + githubStats.deletions;
    validateBucket(pr, changedLines);
    run("gh", ["pr", "merge", prUrl, "--repo", repository, "--merge", "--delete-branch"]);
    console.log(`#${githubStats.number} ${pr.bucket.name}: ${changedLines} changed lines ${githubStats.url}`);
  }

  run("git", ["checkout", "main"]);
  run("git", ["pull", "--ff-only", "origin", "main"]);
  console.log(`Done: https://github.com/${repository}/pulls?q=is%3Apr+is%3Aclosed`);
}

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      result[key] = true;
    } else {
      result[key] = next;
      i += 1;
    }
  }
  return result;
}

function spec(bucketName, slug, title, apply) {
  const bucket = nextBucket(bucketName);
  return { apply, bucket, slug, title };
}

function nextBucket(name) {
  const bucket = buckets.find(candidate => candidate.name === name);
  if (!bucket) throw new Error(`Unknown bucket: ${name}`);
  const index = bucket.used ?? 0;
  if (index >= bucket.count) throw new Error(`Bucket ${name} is over-subscribed`);
  bucket.used = index + 1;
  return {
    max: bucket.max,
    min: bucket.min,
    name: bucket.name,
    target: bucket.targets[index],
  };
}

function ensureGitRepository() {
  if (!existsSync(".git")) {
    run("git", ["init"]);
  }
  run("git", ["checkout", "-B", "main"]);
}

function ensureInitialCommit() {
  const hasCommit = execOk("git", ["rev-parse", "--verify", "HEAD"]);
  if (!hasCommit) {
    run("git", ["add", "-A"]);
    run("git", ["commit", "-m", "Initialize sales replay toolkit"]);
  }
}

function ensureCleanTree() {
  const status = run("git", ["status", "--porcelain"]);
  if (status.trim()) {
    throw new Error(`Working tree is not clean:\n${status}`);
  }
}

function ensureGitHubCli() {
  run("gh", ["--version"]);
  if (!execOk("gh", ["repo", "view", repository])) {
    throw new Error(`Unable to access ${repository} with gh`);
  }
}

function ensureRemote() {
  const remote = execOk("git", ["remote", "get-url", "origin"]);
  if (remote) return;

  const repoExists = execOk("gh", ["repo", "view", repository]);
  if (repoExists) {
    run("git", ["remote", "add", "origin", `https://github.com/${repository}.git`]);
    return;
  }

  const flag = visibility === "public" ? "--public" : "--private";
  run("gh", ["repo", "create", repository, flag, "--source", ".", "--remote", "origin"]);
}

function deleteLocalBranch(branch) {
  if (execOk("git", ["rev-parse", "--verify", branch])) {
    run("git", ["branch", "-D", branch]);
  }
}

function changedLineStats(base) {
  run("git", ["add", "--intent-to-add", "-A"]);
  const output = run("git", ["diff", "--numstat", base, "--"]);
  let additions = 0;
  let deletions = 0;
  for (const line of output.trim().split("\n")) {
    if (!line) continue;
    const [added, deleted] = line.split(/\s+/);
    additions += Number(added);
    deletions += Number(deleted);
  }
  return { additions, deletions, total: additions + deletions };
}

function padToBucket(pr, number) {
  let stats = changedLineStats("main");
  if (stats.total > pr.bucket.max) {
    throw new Error(`${pr.title} starts above ${pr.bucket.name} max: ${stats.total}`);
  }
  if (stats.total >= pr.bucket.target) return;

  const needed = pr.bucket.target - stats.total;
  const file = `test/fixtures/pr-${number}-${pr.slug}.mjs`;
  writeLines(file, scenarioFixtureLines(pr.slug, needed));
  stats = changedLineStats("main");
  if (stats.total !== pr.bucket.target) {
    throw new Error(`${pr.title} expected ${pr.bucket.target} changed lines, received ${stats.total}`);
  }
}

function validateBucket(pr, total) {
  if (total < pr.bucket.min || total > pr.bucket.max) {
    throw new Error(`${pr.title} produced ${total} changed lines, outside ${pr.bucket.name}`);
  }
}

function scenarioFixtureLines(slug, count) {
  if (count < 3) throw new Error("fixture padding needs at least 3 lines");
  const lines = [`export const ${camel(slug)}Scenarios = [`];
  for (let i = 0; i < count - 2; i += 1) {
    const amount = 1000 + ((i * 137) % 9100);
    const day = String((i % 28) + 1).padStart(2, "0");
    lines.push(`  { id: "${slug}-${String(i + 1).padStart(3, "0")}", accountId: "acct_${i % 9}", amount: ${amount}, postedOn: "2026-05-${day}" },`);
  }
  lines.push("];");
  return lines;
}

function addPackageHealthCheck() {
  writeLines("src/health.mjs", [
    "export function packageHealth() {",
    "  return {",
    "    name: \"sales-replay-test4\",",
    "    status: \"ok\",",
    "    checkedAt: new Date().toISOString(),",
    "  };",
    "}",
  ]);
  upsertExport("export { packageHealth } from \"./health.mjs\";");
  writeLines("test/health.test.mjs", [
    "import assert from \"node:assert/strict\";",
    "import test from \"node:test\";",
    "import { packageHealth } from \"../src/index.mjs\";",
    "",
    "test(\"reports package health\", () => {",
    "  assert.equal(packageHealth().status, \"ok\");",
    "});",
  ]);
}

function documentReconciliationContract() {
  writeLines("docs/reconciliation-contract.md", [
    "# Reconciliation Contract",
    "",
    "A reconciliation run compares imported ledger events with account balances",
    "reported by an upstream source system. A run is complete when every source",
    "event has either been matched, ignored by policy, or flagged for review.",
    "",
    "## Invariants",
    "",
    "- imported events must be balanced before they enter the ledger",
    "- account balances are expressed in minor currency units",
    "- source identifiers are stable across retries",
    "- review queues are append-only until a reviewer closes the item",
  ]);
}

function normalizeImportedEvents() {
  writeLines("src/import/normalize.mjs", [
    "export function normalizeImportedEvent(raw) {",
    "  if (!raw || typeof raw !== \"object\") throw new TypeError(\"raw event is required\");",
    "  const id = String(raw.id ?? raw.event_id ?? \"\").trim();",
    "  if (!id) throw new TypeError(\"raw event id is required\");",
    "  const entries = normalizeEntries(raw.entries ?? raw.lines ?? []);",
    "  return {",
    "    id,",
    "    source: String(raw.source ?? \"unknown\"),",
    "    postedOn: normalizeDate(raw.postedOn ?? raw.posted_at ?? raw.date),",
    "    entries,",
    "  };",
    "}",
    "",
    "export function normalizeEntries(entries) {",
    "  if (!Array.isArray(entries) || entries.length === 0) {",
    "    throw new TypeError(\"raw entries must be a non-empty array\");",
    "  }",
    "  return entries.map((entry, index) => ({",
    "    accountId: String(entry.accountId ?? entry.account_id ?? entry.account ?? `line_${index}`),",
    "    amount: Number(entry.amount ?? entry.cents ?? 0),",
    "    memo: entry.memo ? String(entry.memo) : undefined,",
    "  }));",
    "}",
    "",
    "function normalizeDate(value) {",
    "  const date = value ? new Date(value) : new Date();",
    "  if (Number.isNaN(date.valueOf())) throw new TypeError(\"posted date is invalid\");",
    "  return date.toISOString().slice(0, 10);",
    "}",
  ]);
  upsertExport("export { normalizeEntries, normalizeImportedEvent } from \"./import/normalize.mjs\";");
}

function addAccountTagIndex() {
  writeLines("src/accounts/tags.mjs", [
    "export function buildAccountTagIndex(accounts) {",
    "  const index = new Map();",
    "  for (const account of accounts) {",
    "    for (const tag of account.tags ?? []) {",
    "      const normalized = String(tag).toLowerCase();",
    "      const bucket = index.get(normalized) ?? [];",
    "      bucket.push(account.id);",
    "      index.set(normalized, bucket);",
    "    }",
    "  }",
    "  return index;",
    "}",
    "",
    "export function accountsForTag(index, tag) {",
    "  return [...(index.get(String(tag).toLowerCase()) ?? [])].sort();",
    "}",
    "",
    "export function accountHasTag(account, tag) {",
    "  const normalized = String(tag).toLowerCase();",
    "  return (account.tags ?? []).some(candidate => String(candidate).toLowerCase() === normalized);",
    "}",
  ]);
  upsertExport("export { accountHasTag, accountsForTag, buildAccountTagIndex } from \"./accounts/tags.mjs\";");
}

function renderBatchSummaryCli() {
  writeLines("bin/ledger-summary.mjs", [
    "#!/usr/bin/env node",
    "import { readFileSync } from \"node:fs\";",
    "import { createLedger, applyEvent, formatLedgerSummary, summarizeLedger } from \"../src/index.mjs\";",
    "",
    "const file = process.argv[2];",
    "if (!file) {",
    "  console.error(\"usage: ledger-summary <events.json>\");",
    "  process.exit(1);",
    "}",
    "",
    "const events = JSON.parse(readFileSync(file, \"utf8\"));",
    "let ledger = createLedger();",
    "for (const event of events) {",
    "  ledger = applyEvent(ledger, event);",
    "}",
    "console.log(formatLedgerSummary(summarizeLedger(ledger)));",
  ]);
  updateJson("package.json", pkg => {
    pkg.bin = { "ledger-summary": "./bin/ledger-summary.mjs" };
    return pkg;
  });
}

function loadJsonLedgerSnapshots() {
  writeLines("src/snapshot.mjs", [
    "import { readFile } from \"node:fs/promises\";",
    "import { createLedger } from \"./ledger.mjs\";",
    "import { validateLedger } from \"./rules.mjs\";",
    "",
    "export async function loadLedgerSnapshot(file) {",
    "  const payload = JSON.parse(await readFile(file, \"utf8\"));",
    "  return parseLedgerSnapshot(payload);",
    "}",
    "",
    "export function parseLedgerSnapshot(payload) {",
    "  const ledger = createLedger(payload.accounts ?? {});",
    "  ledger.events = Array.isArray(payload.events) ? payload.events : [];",
    "  validateLedger(ledger);",
    "  return ledger;",
    "}",
  ]);
  upsertExport("export { loadLedgerSnapshot, parseLedgerSnapshot } from \"./snapshot.mjs\";");
}

function detectDuplicateEvents() {
  writeLines("src/import/duplicates.mjs", [
    "export function findDuplicateEvents(events) {",
    "  const seen = new Map();",
    "  const duplicates = [];",
    "  for (const event of events) {",
    "    const key = duplicateKey(event);",
    "    const previous = seen.get(key);",
    "    if (previous) {",
    "      duplicates.push({ key, firstId: previous.id, duplicateId: event.id });",
    "    } else {",
    "      seen.set(key, event);",
    "    }",
    "  }",
    "  return duplicates;",
    "}",
    "",
    "export function duplicateKey(event) {",
    "  const entries = [...event.entries]",
    "    .map(entry => `${entry.accountId}:${entry.amount}`)",
    "    .sort()",
    "    .join(\"|\");",
    "  return `${event.source ?? \"unknown\"}:${event.postedOn ?? \"na\"}:${entries}`;",
    "}",
  ]);
  upsertExport("export { duplicateKey, findDuplicateEvents } from \"./import/duplicates.mjs\";");
}

function addReconciliationPlanner() {
  writeLines("src/reconciliation/planner.mjs", [
    "export function planReconciliation({ accounts, events, policies = [] }) {",
    "  const accountIds = new Set(accounts.map(account => account.id));",
    "  const actions = [];",
    "  for (const event of events) {",
    "    const missing = event.entries.filter(entry => !accountIds.has(entry.accountId));",
    "    if (missing.length > 0) {",
    "      actions.push({ type: \"review_missing_account\", eventId: event.id, count: missing.length });",
    "      continue;",
    "    }",
    "    const policy = policies.find(candidate => candidate.matches(event));",
    "    actions.push(policy ? policy.action(event) : { type: \"post\", eventId: event.id });",
    "  }",
    "  return actions;",
    "}",
  ]);
  upsertExport("export { planReconciliation } from \"./reconciliation/planner.mjs\";");
}

function trackSourceSystemWatermarks() {
  writeLines("src/import/watermarks.mjs", [
    "export function createWatermarkStore(seed = {}) {",
    "  return new Map(Object.entries(seed));",
    "}",
    "",
    "export function advanceWatermark(store, source, cursor) {",
    "  const previous = store.get(source);",
    "  if (previous && compareCursor(cursor, previous) < 0) {",
    "    throw new RangeError(`cursor for ${source} moved backwards`);",
    "  }",
    "  store.set(source, cursor);",
    "  return store;",
    "}",
    "",
    "export function compareCursor(a, b) {",
    "  return String(a).localeCompare(String(b), undefined, { numeric: true });",
    "}",
  ]);
  upsertExport("export { advanceWatermark, compareCursor, createWatermarkStore } from \"./import/watermarks.mjs\";");
}

function addPolicyRuleEngine() {
  writeLines("src/policy/engine.mjs", [
    "export function createPolicy(name, predicate, action) {",
    "  return {",
    "    name,",
    "    matches: predicate,",
    "    action,",
    "  };",
    "}",
    "",
    "export function evaluatePolicies(policies, event) {",
    "  for (const policy of policies) {",
    "    if (policy.matches(event)) {",
    "      return { policy: policy.name, action: policy.action(event) };",
    "    }",
    "  }",
    "  return { policy: null, action: { type: \"post\", eventId: event.id } };",
    "}",
    "",
    "export function memoContains(text) {",
    "  const needle = String(text).toLowerCase();",
    "  return event => event.entries.some(entry => String(entry.memo ?? \"\").toLowerCase().includes(needle));",
    "}",
  ]);
  upsertExport("export { createPolicy, evaluatePolicies, memoContains } from \"./policy/engine.mjs\";");
}

function streamImportPipeline() {
  writeLines("src/import/pipeline.mjs", [
    "import { normalizeImportedEvent } from \"./normalize.mjs\";",
    "import { findDuplicateEvents } from \"./duplicates.mjs\";",
    "",
    "export async function collectImportStream(records, options = {}) {",
    "  const normalized = [];",
    "  for await (const record of records) {",
    "    const event = normalizeImportedEvent(record);",
    "    if (options.filter && !options.filter(event)) continue;",
    "    normalized.push(event);",
    "  }",
    "  const duplicates = findDuplicateEvents(normalized);",
    "  return { events: normalized, duplicates };",
    "}",
    "",
    "export async function* mapImportStream(records, mapper) {",
    "  for await (const record of records) {",
    "    yield mapper(normalizeImportedEvent(record));",
    "  }",
    "}",
  ]);
  upsertExport("export { collectImportStream, mapImportStream } from \"./import/pipeline.mjs\";");
}

function addAuditReportRenderer() {
  writeLines("src/audit/report.mjs", [
    "import { formatCurrency } from \"../format.mjs\";",
    "",
    "export function renderAuditReport({ title, summary, findings = [] }) {",
    "  const lines = [`# ${title}`, \"\", \"## Summary\", \"\"];",
    "  lines.push(`Accounts: ${summary.accounts.length}`);",
    "  lines.push(`Events: ${summary.eventCount}`);",
    "  lines.push(`Balance: ${formatCurrency(summary.balance)}`);",
    "  lines.push(\"\", \"## Findings\", \"\");",
    "  if (findings.length === 0) {",
    "    lines.push(\"No findings.\");",
    "  } else {",
    "    for (const finding of findings) {",
    "      lines.push(`- [${finding.severity}] ${finding.message}`);",
    "    }",
    "  }",
    "  return lines.join(\"\\n\");",
    "}",
  ]);
  upsertExport("export { renderAuditReport } from \"./audit/report.mjs\";");
}

function supportMultiCurrencyLedgers() {
  writeLines("src/currency.mjs", [
    "export function createMoney(amount, currency = \"USD\") {",
    "  if (!Number.isInteger(amount)) throw new TypeError(\"money amount must be integer minor units\");",
    "  return { amount, currency };",
    "}",
    "",
    "export function addMoney(left, right) {",
    "  assertSameCurrency(left, right);",
    "  return createMoney(left.amount + right.amount, left.currency);",
    "}",
    "",
    "export function negateMoney(value) {",
    "  return createMoney(-value.amount, value.currency);",
    "}",
    "",
    "export function assertSameCurrency(left, right) {",
    "  if (left.currency !== right.currency) {",
    "    throw new RangeError(`currency mismatch: ${left.currency} !== ${right.currency}`);",
    "  }",
    "}",
  ]);
  upsertExport("export { addMoney, assertSameCurrency, createMoney, negateMoney } from \"./currency.mjs\";");
}

function addReconciliationWorkspace() {
  writeLines("src/reconciliation/workspace.mjs", [
    "import { planReconciliation } from \"./planner.mjs\";",
    "",
    "export function createWorkspace(input) {",
    "  const actions = planReconciliation(input);",
    "  const queues = groupActions(actions);",
    "  return {",
    "    actions,",
    "    queues,",
    "    openedAt: new Date().toISOString(),",
    "  };",
    "}",
    "",
    "export function groupActions(actions) {",
    "  const queues = new Map();",
    "  for (const action of actions) {",
    "    const bucket = queues.get(action.type) ?? [];",
    "    bucket.push(action);",
    "    queues.set(action.type, bucket);",
    "  }",
    "  return queues;",
    "}",
  ]);
  upsertExport("export { createWorkspace, groupActions } from \"./reconciliation/workspace.mjs\";");
}

function consolidateLedgerFixtureSuite() {
  writeLines("test/fixtures/build-ledger.mjs", [
    "import { applyEvent, createLedger } from \"../../src/index.mjs\";",
    "",
    "export function buildLedgerFromEvents(events, seed = {}) {",
    "  let ledger = createLedger(seed);",
    "  for (const event of events) {",
    "    ledger = applyEvent(ledger, event);",
    "  }",
    "  return ledger;",
    "}",
    "",
    "export function balancedEvent(id, debitAccount, creditAccount, amount) {",
    "  return {",
    "    id,",
    "    entries: [",
    "      { accountId: debitAccount, amount },",
    "      { accountId: creditAccount, amount: -amount },",
    "    ],",
    "  };",
    "}",
  ]);
  writeLines("test/fixtures/README.md", [
    "# Ledger Fixture Suite",
    "",
    "The generated PRs use this fixture suite to keep bucket sizes stable while",
    "remaining useful to people reviewing the repository history. Scenario modules",
    "represent realistic account imports, duplicate runs, and reconciliation queues.",
  ]);
}

function writeLines(file, lines) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${lines.join("\n")}\n`);
}

function upsertExport(line) {
  const file = "src/index.mjs";
  const existing = readFileSync(file, "utf8");
  if (existing.includes(line)) return;
  writeFileSync(file, `${existing.trimEnd()}\n${line}\n`);
}

function updateJson(file, updater) {
  const value = JSON.parse(readFileSync(file, "utf8"));
  const next = updater(value);
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
}

function camel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function run(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function execOk(command, args) {
  try {
    run(command, args);
    return true;
  } catch {
    return false;
  }
}
