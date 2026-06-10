import assert from "node:assert/strict";
import test from "node:test";
import {
  applyEvent,
  createLedger,
  formatLedgerSummary,
  summarizeLedger,
} from "../src/index.mjs";

test("applies a balanced ledger event", () => {
  const ledger = createLedger({ cash: 0, revenue: 0 });
  const next = applyEvent(ledger, {
    id: "evt_001",
    entries: [
      { accountId: "cash", amount: 2500 },
      { accountId: "revenue", amount: -2500 },
    ],
  });

  assert.equal(next.accounts.get("cash"), 2500);
  assert.equal(next.accounts.get("revenue"), -2500);
  assert.equal(next.events.length, 1);
});

test("rejects an unbalanced event", () => {
  const ledger = createLedger({ cash: 0, revenue: 0 });
  assert.throws(() => {
    applyEvent(ledger, {
      id: "evt_bad",
      entries: [
        { accountId: "cash", amount: 2500 },
        { accountId: "revenue", amount: -2400 },
      ],
    });
  }, /not balanced/);
});

test("formats ledger summaries", () => {
  const ledger = applyEvent(createLedger({ cash: 0, revenue: 0 }), {
    id: "evt_002",
    entries: [
      { accountId: "cash", amount: 1999 },
      { accountId: "revenue", amount: -1999 },
    ],
  });

  assert.equal(
    formatLedgerSummary(summarizeLedger(ledger)),
    "cash: $19.99\nrevenue: -$19.99\nbalance: $0.00\nevents: 1",
  );
});
