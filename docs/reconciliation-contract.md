# Reconciliation Contract

A reconciliation run compares imported ledger events with account balances
reported by an upstream source system. A run is complete when every source
event has either been matched, ignored by policy, or flagged for review.

## Invariants

- imported events must be balanced before they enter the ledger
- account balances are expressed in minor currency units
- source identifiers are stable across retries
- review queues are append-only until a reviewer closes the item
