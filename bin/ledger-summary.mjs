#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createLedger, applyEvent, formatLedgerSummary, summarizeLedger } from "../src/index.mjs";

const file = process.argv[2];
if (!file) {
  console.error("usage: ledger-summary <events.json>");
  process.exit(1);
}

const events = JSON.parse(readFileSync(file, "utf8"));
let ledger = createLedger();
for (const event of events) {
  ledger = applyEvent(ledger, event);
}
console.log(formatLedgerSummary(summarizeLedger(ledger)));
