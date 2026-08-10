import { findNearestRecordIndex, normalizedDistanceSquared, type ParameterBounds } from "./nearest";
import { BASELINE_PARAMETERS, PARAMETER_DEFINITIONS } from "./parameters";
import { describe, expect, it } from "vitest";

const bounds = Object.fromEntries(PARAMETER_DEFINITIONS.map(({ name, minimum, maximum }) => [name, { minimum, maximum }])) as ParameterBounds;

describe("normalized nearest neighbor", () => {
  const first = { stableRecordIndex: 11, parameters: { ...BASELINE_PARAMETERS, x_c: 0.3, y_t: 0.05 } };
  const second = { stableRecordIndex: 4, parameters: { ...BASELINE_PARAMETERS, x_c: 0.7, y_t: 0.15 } };

  it("normalizes authoritative ranges and ignores inactive parameters", () => {
    const request = { ...BASELINE_PARAMETERS, x_c: 0.31, y_t: 0.18 };
    expect(findNearestRecordIndex(request, [first, second], ["x_c"], bounds)).toBe(0);
    expect(normalizedDistanceSquared(request, first.parameters, ["x_c"], bounds)).toBeCloseTo(0.0004, 9);
  });

  it("uses the lowest stable record index for exact ties and duplicates", () => {
    const request = { ...BASELINE_PARAMETERS, x_c: 0.5 };
    expect(findNearestRecordIndex(request, [first, second], ["x_c"], bounds)).toBe(1);
    const duplicate = { stableRecordIndex: 2, parameters: { ...first.parameters } };
    expect(findNearestRecordIndex(first.parameters, [first, duplicate], ["x_c"], bounds)).toBe(1);
  });

  it("supports empty groups and clean dataset replacement", () => {
    expect(findNearestRecordIndex(BASELINE_PARAMETERS, [], ["x_c"], bounds)).toBe(-1);
    expect(findNearestRecordIndex(second.parameters, [second], ["x_c"], bounds)).toBe(0);
  });
});
