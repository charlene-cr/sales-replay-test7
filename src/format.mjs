export function formatCurrency(amount, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(amount / 100);
}

export function toIsoDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new TypeError("value must be a valid date");
  }
  return date.toISOString().slice(0, 10);
}

export function formatLedgerSummary(summary, currency = "USD") {
  const rows = summary.accounts.map(account => {
    return `${account.accountId}: ${formatCurrency(account.amount, currency)}`;
  });
  rows.push(`balance: ${formatCurrency(summary.balance, currency)}`);
  rows.push(`events: ${summary.eventCount}`);
  return rows.join("\n");
}
