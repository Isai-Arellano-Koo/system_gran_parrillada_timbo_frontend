export function matchesQuery(query: string, ...values: unknown[]) {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!tokens.length) return true;
  const haystack = values
    .flatMap((value) => {
      if (value == null || value === "") return [];
      if (typeof value === "number" && Number.isFinite(value)) {
        return [String(value), value.toFixed(2), String(Math.round(value))];
      }
      return [String(value)];
    })
    .join(" ")
    .toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}
