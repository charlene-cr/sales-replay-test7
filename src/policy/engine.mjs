export function createPolicy(name, predicate, action) {
  return {
    name,
    matches: predicate,
    action,
  };
}

export function evaluatePolicies(policies, event) {
  for (const policy of policies) {
    if (policy.matches(event)) {
      return { policy: policy.name, action: policy.action(event) };
    }
  }
  return { policy: null, action: { type: "post", eventId: event.id } };
}

export function memoContains(text) {
  const needle = String(text).toLowerCase();
  return event => event.entries.some(entry => String(entry.memo ?? "").toLowerCase().includes(needle));
}
