import { describe, expect, it } from "vitest";
import { efficiencyFor, findExactParameterRecord, findMostEfficientRecord, metricDomains } from "./efficiency";
import { BASELINE_PARAMETERS, type ParameterVector } from "./parameters";
import type { WingRecord } from "./schema";

function record(overrides: Partial<WingRecord> = {}): WingRecord {
  return {
    stableRecordIndex: 1,
    parameters: { ...BASELINE_PARAMETERS },
    coordinates: [],
    cl: 0.5,
    cd: 0.05,
    provenance: { runId: "run-a", globalStep: 10, recordedAt: "2026-01-01T00:00:00.000Z", replicateCount: 1 },
    ...overrides
  };
}

describe("wing efficiency selectors", () => {
  it("selects one maximum positive Cl/Cd record", () => {
    const records = [record({ cl: 0.8, cd: 0.04 }), record({ cl: 0.6, cd: 0.02 })];

    expect(findMostEfficientRecord(records)).toBe(records[1]);
    expect(efficiencyFor(records[1]!)).toBeCloseTo(30);
  });

  it("excludes zero, negative, non-positive lift, and non-finite ratios", () => {
    expect(efficiencyFor(record({ cl: 1, cd: 0 }))).toBeNull();
    expect(efficiencyFor(record({ cl: 1, cd: -0.1 }))).toBeNull();
    expect(efficiencyFor(record({ cl: 0, cd: 0.1 }))).toBeNull();
    expect(efficiencyFor(record({ cl: Number.POSITIVE_INFINITY, cd: 0.1 }))).toBeNull();
    expect(findMostEfficientRecord([record({ cl: 1, cd: 0 }), record({ cl: -1, cd: 0.1 })])).toBeNull();
  });

  it("uses only the records from the selected group", () => {
    const selectedGroup = [record({ cl: 0.6, cd: 0.03, stableRecordIndex: 2 })];
    const otherGroupWinner = record({ cl: 3, cd: 0.01, stableRecordIndex: 3 });

    expect(findMostEfficientRecord(selectedGroup)).toBe(selectedGroup[0]);
    expect(findMostEfficientRecord([otherGroupWinner])).toBe(otherGroupWinner);
  });

  it("breaks efficiency and exact-vector ties by newest timestamp, step, run, then index", () => {
    const oldest = record({ stableRecordIndex: 99, provenance: { runId: "z", globalStep: 999, recordedAt: "2026-01-01T00:00:00.000Z", replicateCount: 1 } });
    const newestLowStep = record({ stableRecordIndex: 98, provenance: { runId: "z", globalStep: 1, recordedAt: "2026-01-02T00:00:00.000Z", replicateCount: 1 } });
    const newestHighStep = record({ stableRecordIndex: 97, provenance: { runId: "a", globalStep: 2, recordedAt: "2026-01-02T00:00:00.000Z", replicateCount: 1 } });
    const newestRun = record({ stableRecordIndex: 96, provenance: { runId: "b", globalStep: 2, recordedAt: "2026-01-02T00:00:00.000Z", replicateCount: 1 } });
    const winner = record({ stableRecordIndex: 4, provenance: { runId: "b", globalStep: 2, recordedAt: "2026-01-02T00:00:00.000Z", replicateCount: 1 } });
    const records = [oldest, newestLowStep, newestHighStep, newestRun, winner];

    expect(findMostEfficientRecord(records)).toBe(winner);
    expect(findExactParameterRecord(records, BASELINE_PARAMETERS)).toBe(winner);
  });

  it("uses step, run, and index ties when malformed timestamps are reversed", () => {
    const malformedTimestamp = "not-a-timestamp";
    const stepLoser = record({ stableRecordIndex: 99, provenance: { runId: "z", globalStep: 1, recordedAt: malformedTimestamp, replicateCount: 1 } });
    const runLoser = record({ stableRecordIndex: 98, provenance: { runId: "a", globalStep: 2, recordedAt: malformedTimestamp, replicateCount: 1 } });
    const indexLoser = record({ stableRecordIndex: 9, provenance: { runId: "b", globalStep: 2, recordedAt: malformedTimestamp, replicateCount: 1 } });
    const winner = record({ stableRecordIndex: 4, provenance: { runId: "b", globalStep: 2, recordedAt: malformedTimestamp, replicateCount: 1 } });
    const records = [stepLoser, runLoser, indexLoser, winner];

    expect(findMostEfficientRecord(records)).toBe(winner);
    expect(findExactParameterRecord(records, BASELINE_PARAMETERS)).toBe(winner);
  });

  it("matches all ten parameters after float32 rounding", () => {
    const float32Vector = Object.fromEntries(
      Object.entries(BASELINE_PARAMETERS).map(([name, value]) => [name, Math.fround(value)])
    ) as ParameterVector;
    const matching = record({ parameters: float32Vector });

    expect(findExactParameterRecord([matching], BASELINE_PARAMETERS)).toBe(matching);
  });

  it("does not treat a nearby vector as the NACA record", () => {
    const nearby = record({ parameters: { ...BASELINE_PARAMETERS, x_c: BASELINE_PARAMETERS.x_c + 1e-4 } });

    expect(findExactParameterRecord([nearby], BASELINE_PARAMETERS)).toBeNull();
  });

  it("uses fixed nonzero domains from all selected-group records", () => {
    const records = [record({ cl: -2, cd: -0.5 }), record({ cl: 0.6, cd: 0.02 })];

    expect(metricDomains(records)).toEqual({ cl: 2, cd: 0.5, efficiency: 30 });
    expect(metricDomains([])).toEqual({ cl: Number.EPSILON, cd: Number.EPSILON, efficiency: Number.EPSILON });
  });
});
