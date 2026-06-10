import { readFile } from "node:fs/promises";
import { createLedger } from "./ledger.mjs";
import { validateLedger } from "./rules.mjs";

export async function loadLedgerSnapshot(file) {
  const payload = JSON.parse(await readFile(file, "utf8"));
  return parseLedgerSnapshot(payload);
}

export function parseLedgerSnapshot(payload) {
  const ledger = createLedger(payload.accounts ?? {});
  ledger.events = Array.isArray(payload.events) ? payload.events : [];
  validateLedger(ledger);
  return ledger;
}
