export function createWatermarkStore(seed = {}) {
  return new Map(Object.entries(seed));
}

export function advanceWatermark(store, source, cursor) {
  const previous = store.get(source);
  if (previous && compareCursor(cursor, previous) < 0) {
    throw new RangeError(`cursor for ${source} moved backwards`);
  }
  store.set(source, cursor);
  return store;
}

export function compareCursor(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}
