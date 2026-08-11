import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SnapshotManifestV1, WingDatasetV1, recordsFromDataset } from "./schema";

const publicDataPath = resolve(process.cwd(), "public/data");
const manifestJson = JSON.parse(readFileSync(resolve(publicDataPath, "manifest.json"), "utf8")) as unknown;

describe("snapshot Zod contracts", () => {
  it("validates the committed manifest and all fixture chunks", () => {
    const manifest = SnapshotManifestV1.parse(manifestJson);
    expect(manifest.totals.uniqueGeometryCount).toBe(7);
    for (const entry of manifest.datasets) {
      const dataset = WingDatasetV1.parse(JSON.parse(readFileSync(resolve(publicDataPath, entry.path), "utf8")) as unknown);
      expect(dataset.columns.stableRecordIndex).toHaveLength(entry.recordCount);
      expect(recordsFromDataset(dataset).every((record) => record.coordinates.length === 253)).toBe(true);
    }
  });

  it("requires the complete ordered compatibility fingerprint", () => {
    const manifest = SnapshotManifestV1.parse(manifestJson);
    const raw = JSON.parse(readFileSync(resolve(publicDataPath, manifest.datasets[0]!.path), "utf8")) as Record<string, unknown>;
    const snapshot = WingDatasetV1.parse(raw);

    expect(snapshot.compatibilityGroup).toMatchObject({
      reynoldsNumber: 3000,
      chordLatticeUnits: 150,
      gridNx: 900,
      gridNy: 210,
      angleOfAttackDeg: 7,
      averagingStartTu: 30,
      averagingEndTu: 60,
      maximumInletVelocity: 0.08,
      collisionModel: "mrt",
      immersedBoundaryScheme: "ib1",
      isolated: false
    });

    const missingRequiredField = structuredClone(raw) as { compatibilityGroup: Record<string, unknown> };
    delete missingRequiredField.compatibilityGroup.reynoldsNumber;
    expect(WingDatasetV1.safeParse(missingRequiredField).success).toBe(false);

    const reversedAveragingWindow = structuredClone(raw) as { compatibilityGroup: Record<string, unknown> };
    reversedAveragingWindow.compatibilityGroup.averagingStartTu = 61;
    reversedAveragingWindow.compatibilityGroup.averagingEndTu = 60;
    expect(WingDatasetV1.safeParse(reversedAveragingWindow).success).toBe(false);
  });

  it("rejects mismatched column lengths", () => {
    const manifest = SnapshotManifestV1.parse(manifestJson);
    const raw = JSON.parse(readFileSync(resolve(publicDataPath, manifest.datasets[0]!.path), "utf8")) as Record<string, unknown>;
    const malformedLength = structuredClone(raw) as { columns: { cd: number[] } };
    malformedLength.columns.cd.pop();
    expect(WingDatasetV1.safeParse(malformedLength).success).toBe(false);
  });

  it("rejects dataset paths outside the declared data directory", () => {
    const unsafe = structuredClone(manifestJson) as { datasets: { path: string }[] };
    unsafe.datasets[0]!.path = "../private.json";
    expect(SnapshotManifestV1.safeParse(unsafe).success).toBe(false);
  });
});
