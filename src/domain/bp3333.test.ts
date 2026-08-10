import goldenFixture from "../../tests/fixtures/bp3333_golden_coordinates_v1.json";
import { describe, expect, it } from "vitest";
import { buildBp3333, buildNaca2412 } from "./bp3333";
import { vectorFromTuple } from "./schema";

describe("BP3333 geometry", () => {
  it.each(goldenFixture.cases)("matches the Python float32 golden case $name", (golden) => {
    const points = buildBp3333(vectorFromTuple(golden.parameters));
    expect(points).toHaveLength(253);
    expect(points.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
    let maximumError = 0;
    points.forEach((point, index) => {
      maximumError = Math.max(maximumError, Math.abs(point.x - golden.x[index]!), Math.abs(point.y - golden.y[index]!));
    });
    expect(maximumError).toBeLessThanOrEqual(1e-5);
  });

  it("keeps the analytic NACA helper finite and distinct from BP3333 output", () => {
    const naca = buildNaca2412();
    const bp3333 = buildBp3333(vectorFromTuple(goldenFixture.cases[0]!.parameters));
    expect(naca).toHaveLength(253);
    const totalDifference = naca.reduce((sum, point, index) => sum + Math.abs(point.y - bp3333[index]!.y), 0);
    expect(totalDifference).toBeGreaterThan(0.1);
  });
});
