/**
 * Serializes JSON values with recursively sorted object keys.
 *
 * This matches the exporter's canonical representation for the manifest
 * contract. Manifest numbers are constrained so JavaScript and Python emit the
 * same decimal spellings (no integer-valued floats or negative zero).
 */
export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;

  switch (typeof value) {
    case "boolean":
    case "string":
      return JSON.stringify(value);
    case "number": {
      if (!Number.isFinite(value) || Object.is(value, -0)) {
        throw new TypeError("Canonical JSON accepts only finite, non-negative-zero numbers.");
      }
      return JSON.stringify(value);
    }
    case "object": {
      const record = value as Record<string, unknown>;
      return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
        .join(",")}}`;
    }
    default:
      throw new TypeError(`Canonical JSON cannot serialize ${typeof value}.`);
  }
}
