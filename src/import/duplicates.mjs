export function findDuplicateEvents(events) {
  const seen = new Map();
  const duplicates = [];
  for (const event of events) {
    const key = duplicateKey(event);
    const previous = seen.get(key);
    if (previous) {
      duplicates.push({ key, firstId: previous.id, duplicateId: event.id });
    } else {
      seen.set(key, event);
    }
  }
  return duplicates;
}

export function duplicateKey(event) {
  const entries = [...event.entries]
    .map(entry => `${entry.accountId}:${entry.amount}`)
    .sort()
    .join("|");
  return `${event.source ?? "unknown"}:${event.postedOn ?? "na"}:${entries}`;
}
