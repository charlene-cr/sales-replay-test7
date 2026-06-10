import { ledgerBalance } from "./ledger.mjs";

export function validateEvent(event) {
  if (!event || typeof event !== "object") {
    throw new TypeError("event must be an object");
  }
  if (!event.id || typeof event.id !== "string") {
    throw new TypeError("event.id must be a string");
  }
  if (!Array.isArray(event.entries) || event.entries.length === 0) {
    throw new TypeError("event.entries must contain at least one entry");
  }

  let total = 0;
  for (const entry of event.entries) {
    if (!entry.accountId || typeof entry.accountId !== "string") {
      throw new TypeError("entry.accountId must be a string");
    }
    if (!Number.isFinite(entry.amount)) {
      throw new TypeError("entry.amount must be a finite number");
    }
    total += entry.amount;
  }

  if (total !== 0) {
    throw new RangeError(`event ${event.id} is not balanced`);
  }
}

export function assertBalanced(ledger) {
  const balance = ledgerBalance(ledger);
  if (balance !== 0) {
    throw new RangeError(`ledger balance must be zero, received ${balance}`);
  }
}

export function validateLedger(ledger) {
  if (!ledger || !(ledger.accounts instanceof Map)) {
    throw new TypeError("ledger.accounts must be a Map");
  }
  if (!Array.isArray(ledger.events)) {
    throw new TypeError("ledger.events must be an array");
  }
  assertBalanced(ledger);
}
