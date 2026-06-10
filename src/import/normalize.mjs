export function normalizeImportedEvent(raw) {
  if (!raw || typeof raw !== "object") throw new TypeError("raw event is required");
  const id = String(raw.id ?? raw.event_id ?? "").trim();
  if (!id) throw new TypeError("raw event id is required");
  const entries = normalizeEntries(raw.entries ?? raw.lines ?? []);
  return {
    id,
    source: String(raw.source ?? "unknown"),
    postedOn: normalizeDate(raw.postedOn ?? raw.posted_at ?? raw.date),
    entries,
  };
}

export function normalizeEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new TypeError("raw entries must be a non-empty array");
  }
  return entries.map((entry, index) => ({
    accountId: String(entry.accountId ?? entry.account_id ?? entry.account ?? `line_${index}`),
    amount: Number(entry.amount ?? entry.cents ?? 0),
    memo: entry.memo ? String(entry.memo) : undefined,
  }));
}

function normalizeDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.valueOf())) throw new TypeError("posted date is invalid");
  return date.toISOString().slice(0, 10);
}
