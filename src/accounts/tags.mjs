export function buildAccountTagIndex(accounts) {
  const index = new Map();
  for (const account of accounts) {
    for (const tag of account.tags ?? []) {
      const normalized = String(tag).toLowerCase();
      const bucket = index.get(normalized) ?? [];
      bucket.push(account.id);
      index.set(normalized, bucket);
    }
  }
  return index;
}

export function accountsForTag(index, tag) {
  return [...(index.get(String(tag).toLowerCase()) ?? [])].sort();
}

export function accountHasTag(account, tag) {
  const normalized = String(tag).toLowerCase();
  return (account.tags ?? []).some(candidate => String(candidate).toLowerCase() === normalized);
}
