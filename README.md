# Sales Replay Test 4

Sales Replay Test 4 is a small Node.js toolkit for replaying sales events,
checking ledger-style invariants, and producing concise reconciliation reports.
It is intentionally dependency-free so fixture repositories can run quickly in
clean environments.

## Local Development

```bash
npm test
```

After `gh` is authenticated as an account that can create repositories under
`charlene-cr`, this command creates a GitHub repository and opens/merges the PR
fixture set:

```bash
npm run seed:prs -- --visibility private
```

The PR generator creates 10 merged pull requests that satisfy the provided size
buckets:

- 2 tiny PRs, each at or below 300 changed lines
- 4 small PRs, each between 100 and 600 changed lines
- 4 medium PRs, each between 600 and 1200 changed lines
