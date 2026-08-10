import type { ParameterName, ParameterVector } from "./parameters";

export type ParameterBounds = Record<ParameterName, { minimum: number; maximum: number }>;

export interface NearestRecord {
  stableRecordIndex: number;
  parameters: ParameterVector;
}

export function normalizedDistanceSquared(
  requested: ParameterVector,
  candidate: ParameterVector,
  activeParameters: readonly ParameterName[],
  bounds: ParameterBounds
): number {
  let distance = 0;
  for (const parameter of activeParameters) {
    const range = bounds[parameter].maximum - bounds[parameter].minimum;
    if (!Number.isFinite(range) || range <= 0) throw new Error(`Invalid bounds for ${parameter}.`);
    const delta = (requested[parameter] - candidate[parameter]) / range;
    distance += delta * delta;
  }
  return distance;
}

/** Returns the array index. Exact ties resolve to the lowest stable record index. */
export function findNearestRecordIndex(
  requested: ParameterVector,
  records: readonly NearestRecord[],
  activeParameters: readonly ParameterName[],
  bounds: ParameterBounds
): number {
  if (records.length === 0) return -1;
  let bestArrayIndex = -1;
  let bestStableIndex = Number.POSITIVE_INFINITY;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [arrayIndex, record] of records.entries()) {
    const distance = normalizedDistanceSquared(requested, record.parameters, activeParameters, bounds);
    if (distance < bestDistance || (distance === bestDistance && record.stableRecordIndex < bestStableIndex)) {
      bestArrayIndex = arrayIndex;
      bestStableIndex = record.stableRecordIndex;
      bestDistance = distance;
    }
  }
  return bestArrayIndex;
}
