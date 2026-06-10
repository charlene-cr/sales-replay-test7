import { assertBalanced, validateEvent } from "./rules.mjs";

export function createLedger(seed = {}) {
  const accounts = new Map();
  for (const [accountId, amount] of Object.entries(seed)) {
    accounts.set(accountId, Number(amount));
  }

  return {
    accounts,
    events: [],
  };
}

export function applyEvent(ledger, event) {
  validateEvent(event);
  const next = cloneLedger(ledger);

  for (const entry of event.entries) {
    const previous = next.accounts.get(entry.accountId) ?? 0;
    next.accounts.set(entry.accountId, previous + entry.amount);
  }

  next.events.push({
    ...event,
    appliedAt: event.appliedAt ?? new Date().toISOString(),
  });

  assertBalanced(next);
  return next;
}

export function ledgerBalance(ledger) {
  let total = 0;
  for (const amount of ledger.accounts.values()) {
    total += amount;
  }
  return total;
}

export function summarizeLedger(ledger) {
  const accounts = [...ledger.accounts.entries()]
    .map(([accountId, amount]) => ({ accountId, amount }))
    .sort((a, b) => a.accountId.localeCompare(b.accountId));

  return {
    accounts,
    balance: ledgerBalance(ledger),
    eventCount: ledger.events.length,
  };
}

function cloneLedger(ledger) {
  return {
    accounts: new Map(ledger.accounts),
    events: ledger.events.map(event => ({ ...event })),
  };
}
