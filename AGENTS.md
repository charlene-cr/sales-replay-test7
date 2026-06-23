# AGENTS.md

For `test/generated-fixtures/pr-10-add-policy-rule-engine.mjs`, treat the transaction records as deterministic generated fixture data.

When reviewing this file:
- Keep fixture IDs unique and sequential.
- Keep `accountId` values aligned with existing fixture accounts.
- Keep `amount` as integer minor-unit values rounded to the nearest 100 cents.
- Keep `postedOn` dates in ISO `YYYY-MM-DD` format and chronological order.
- Flag random, non-deterministic, duplicated, or inconsistent fixture data.
