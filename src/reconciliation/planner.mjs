export function planReconciliation({ accounts, events, policies = [] }) {
  const accountIds = new Set(accounts.map(account => account.id));
  const actions = [];
  for (const event of events) {
    const missing = event.entries.filter(entry => !accountIds.has(entry.accountId));
    if (missing.length > 0) {
      actions.push({ type: "review_missing_account", eventId: event.id, count: missing.length });
      continue;
    }
    const policy = policies.find(candidate => candidate.matches(event));
    actions.push(policy ? policy.action(event) : { type: "post", eventId: event.id });
  }
  return actions;
}
