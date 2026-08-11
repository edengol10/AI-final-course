import { PARAMETER_ORDER, type ParameterVector } from "./parameters";
import type { WingRecord } from "./schema";

const DOMAIN_FLOOR = Number.EPSILON;

export function efficiencyFor(record: WingRecord): number | null {
  if (!Number.isFinite(record.cl) || !Number.isFinite(record.cd) || record.cl <= 0 || record.cd <= 0) return null;
  const efficiency = record.cl / record.cd;
  return Number.isFinite(efficiency) ? efficiency : null;
}

/** Sorts the preferred record first for equal measured values. */
function compareProvenance(left: WingRecord, right: WingRecord): number {
  const leftTimestamp = left.provenance.recordedAt === null ? Number.NEGATIVE_INFINITY : Date.parse(left.provenance.recordedAt);
  const rightTimestamp = right.provenance.recordedAt === null ? Number.NEGATIVE_INFINITY : Date.parse(right.provenance.recordedAt);
  if (leftTimestamp !== rightTimestamp) return rightTimestamp - leftTimestamp;
  if (left.provenance.globalStep !== right.provenance.globalStep) return right.provenance.globalStep - left.provenance.globalStep;
  const runIdComparison = right.provenance.runId.localeCompare(left.provenance.runId);
  if (runIdComparison !== 0) return runIdComparison;
  return left.stableRecordIndex - right.stableRecordIndex;
}

export function findMostEfficientRecord(records: readonly WingRecord[]): WingRecord | null {
  let winner: WingRecord | null = null;
  let winningEfficiency = Number.NEGATIVE_INFINITY;
  for (const record of records) {
    const efficiency = efficiencyFor(record);
    if (efficiency === null) continue;
    if (efficiency > winningEfficiency || (efficiency === winningEfficiency && winner !== null && compareProvenance(record, winner) < 0)) {
      winner = record;
      winningEfficiency = efficiency;
    }
  }
  return winner;
}

function matchesFloat32Vector(parameters: ParameterVector, target: ParameterVector): boolean {
  return PARAMETER_ORDER.every((name) => Math.fround(parameters[name]) === Math.fround(target[name]));
}

export function findExactParameterRecord(records: readonly WingRecord[], target: ParameterVector): WingRecord | null {
  let winner: WingRecord | null = null;
  for (const record of records) {
    if (!matchesFloat32Vector(record.parameters, target)) continue;
    if (winner === null || compareProvenance(record, winner) < 0) winner = record;
  }
  return winner;
}

export function metricDomains(records: readonly WingRecord[]): { cl: number; cd: number; efficiency: number } {
  let cl = DOMAIN_FLOOR;
  let cd = DOMAIN_FLOOR;
  let efficiency = DOMAIN_FLOOR;
  for (const record of records) {
    if (Number.isFinite(record.cl)) cl = Math.max(cl, Math.abs(record.cl));
    if (Number.isFinite(record.cd)) cd = Math.max(cd, Math.abs(record.cd));
    const ratio = efficiencyFor(record);
    if (ratio !== null) efficiency = Math.max(efficiency, ratio);
  }
  return { cl, cd, efficiency };
}
