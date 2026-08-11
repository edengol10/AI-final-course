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
