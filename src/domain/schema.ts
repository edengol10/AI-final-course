import { z } from "zod";
import { buildBp3333 } from "./bp3333";
import { PARAMETER_ORDER, type ParameterName, type ParameterVector } from "./parameters";

const finiteNumber = z.number().finite();
const nonNegativeInteger = z.number().int().nonnegative();
const positiveInteger = z.number().int().positive();
const sha256 = z.string().regex(/^[a-f0-9]{64}$/i, "Expected a SHA-256 hex digest");
const timestamp = z.string().datetime({ offset: true });
const parameterName = z.enum(PARAMETER_ORDER);
const parameterValues = z.record(parameterName, finiteNumber);

export const SnapshotManifestV1 = z
  .object({
    schemaVersion: z.literal("snapshot-manifest-v1"),
    generatedAt: timestamp,
    canonicalSha256: sha256,
    snapshotKind: z.enum(["synthetic-fixture", "reviewed-wandb"]),
    sourceRunCount: nonNegativeInteger,
    parameterOrder: z.tuple([
      z.literal("r_le"),
      z.literal("x_c"),
      z.literal("y_c"),
      z.literal("k_c"),
      z.literal("y_t"),
      z.literal("x_t"),
      z.literal("beta_te"),
      z.literal("k_t"),
      z.literal("gamma_le"),
      z.literal("alpha_te")
    ]),
    parameterBounds: z.record(parameterName, z.object({ minimum: finiteNumber, maximum: finiteNumber }).strict()),
    datasets: z.array(
      z
        .object({
          compatibilityGroupId: z.string().min(1),
          label: z.string().min(1),
          description: z.string().min(1),
          path: z
            .string()
            .regex(/^datasets\/[a-z0-9._-]+\.json$/, "Dataset paths must be hashed files beneath datasets/"),
          sha256,
          byteSize: positiveInteger,
          shardIndex: nonNegativeInteger,
          shardCount: positiveInteger,
          recordCount: nonNegativeInteger,
          groupAdmittedSampleCount: nonNegativeInteger,
          groupUniqueGeometryCount: nonNegativeInteger,
          activeParameters: z.array(parameterName),
          fixedParameters: parameterValues
        })
        .strict()
    ),
    totals: z
      .object({ admittedSampleCount: nonNegativeInteger, uniqueGeometryCount: nonNegativeInteger, rejectedItemCount: nonNegativeInteger })
      .strict(),
    rejectionCounts: z.record(z.string(), nonNegativeInteger)
  })
  .strict()
  .superRefine((manifest, context) => {
    for (const parameter of PARAMETER_ORDER) {
      const bounds = manifest.parameterBounds[parameter];
      if (!bounds) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `Missing authoritative bounds for ${parameter}`, path: ["parameterBounds", parameter] });
      } else if (bounds.minimum >= bounds.maximum) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Minimum must be smaller than maximum", path: ["parameterBounds", parameter] });
      }
    }
    const paths = new Set<string>();
    for (const [index, dataset] of manifest.datasets.entries()) {
      if (dataset.shardIndex >= dataset.shardCount) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Shard index must be below shard count", path: ["datasets", index, "shardIndex"] });
      }
      if (paths.has(dataset.path)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Dataset paths must be unique", path: ["datasets", index, "path"] });
      }
      paths.add(dataset.path);
      const active = new Set(dataset.activeParameters);
      if (active.size !== dataset.activeParameters.length) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Active parameters must be unique", path: ["datasets", index, "activeParameters"] });
      }
      const fixedKeys = Object.keys(dataset.fixedParameters);
      if (fixedKeys.some((key) => active.has(key as ParameterName)) || active.size + fixedKeys.length !== PARAMETER_ORDER.length) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Active and fixed parameters must partition the full vector", path: ["datasets", index] });
      }
    }
    const groupCounts = new Map<string, { admitted: number; unique: number }>();
    for (const dataset of manifest.datasets) {
      if (!groupCounts.has(dataset.compatibilityGroupId)) {
        groupCounts.set(dataset.compatibilityGroupId, { admitted: dataset.groupAdmittedSampleCount, unique: dataset.groupUniqueGeometryCount });
      }
    }
    const admittedTotal = Array.from(groupCounts.values()).reduce((sum, count) => sum + count.admitted, 0);
    const uniqueTotal = Array.from(groupCounts.values()).reduce((sum, count) => sum + count.unique, 0);
    if (admittedTotal !== manifest.totals.admittedSampleCount || uniqueTotal !== manifest.totals.uniqueGeometryCount) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Manifest totals must equal compatibility-group totals", path: ["totals"] });
    }
  });

const CompatibilityGroupSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    description: z.string().min(1),
    baseline: z.string().min(1),
    angleOfAttackDeg: finiteNumber.nullable(),
    cfdAveragingWindow: z.string().min(1).nullable(),
    solverRevision: z.string().min(1).nullable(),
    isolated: z.boolean()
  })
  .strict();

export const WingDatasetV1 = z
  .object({
    schemaVersion: z.literal("wing-dataset-v1"),
    compatibilityGroup: CompatibilityGroupSchema,
    parameterOrder: z.tuple([
      z.literal("r_le"),
      z.literal("x_c"),
      z.literal("y_c"),
      z.literal("k_c"),
      z.literal("y_t"),
      z.literal("x_t"),
      z.literal("beta_te"),
      z.literal("k_t"),
      z.literal("gamma_le"),
      z.literal("alpha_te")
    ]),
    activeParameters: z.array(parameterName),
    fixedParameters: parameterValues,
    groupAdmittedSampleCount: nonNegativeInteger,
    groupUniqueGeometryCount: nonNegativeInteger,
    shardIndex: nonNegativeInteger,
    shardCount: positiveInteger,
    columns: z
      .object({
        stableRecordIndex: z.array(nonNegativeInteger),
        parameters: z.array(z.tuple([finiteNumber, finiteNumber, finiteNumber, finiteNumber, finiteNumber, finiteNumber, finiteNumber, finiteNumber, finiteNumber, finiteNumber])),
        cl: z.array(finiteNumber),
        cd: z.array(finiteNumber),
        curvatureRatio: z.array(finiteNumber.lt(1)),
        runId: z.array(z.string().min(1)),
        globalStep: z.array(nonNegativeInteger),
        recordedAt: z.array(timestamp.nullable()),
        replicateCount: z.array(positiveInteger),
        replicateProvenance: z.array(
          z.array(
            z
              .object({ runId: z.string().min(1), globalStep: nonNegativeInteger, recordedAt: timestamp.nullable() })
              .strict()
          )
        )
      })
      .strict()
  })
  .strict()
  .superRefine((dataset, context) => {
    if (dataset.shardIndex >= dataset.shardCount) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Shard index must be below shard count", path: ["shardIndex"] });
    }
    const active = new Set(dataset.activeParameters);
    const fixedKeys = Object.keys(dataset.fixedParameters);
    if (active.size !== dataset.activeParameters.length || fixedKeys.some((key) => active.has(key as ParameterName)) || active.size + fixedKeys.length !== PARAMETER_ORDER.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Active and fixed parameters must partition the full vector", path: ["activeParameters"] });
    }
    const expected = dataset.columns.stableRecordIndex.length;
    for (const [name, values] of Object.entries(dataset.columns)) {
      if (values.length !== expected) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `Column length ${values.length} does not match ${expected}`, path: ["columns", name] });
      }
    }
    for (let index = 0; index < expected; index += 1) {
      if (dataset.columns.replicateProvenance[index]?.length !== dataset.columns.replicateCount[index]) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Replicate provenance count must match replicateCount", path: ["columns", "replicateProvenance", index] });
      }
      const representative = dataset.columns.replicateProvenance[index]?.some(
        (sample) => sample.runId === dataset.columns.runId[index] && sample.globalStep === dataset.columns.globalStep[index] && sample.recordedAt === dataset.columns.recordedAt[index]
      );
      if (!representative) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Representative provenance must be present in replicate provenance", path: ["columns", "replicateProvenance", index] });
      }
    }
  });

export type SnapshotManifest = z.infer<typeof SnapshotManifestV1>;
export type WingDataset = z.infer<typeof WingDatasetV1>;

export interface WingRecord {
  stableRecordIndex: number;
  parameters: ParameterVector;
  coordinates: { x: number; y: number }[];
  cl: number;
  cd: number;
  curvatureRatio: number;
  provenance: {
    runId: string;
    globalStep: number;
    recordedAt: string | null;
    replicateCount: number;
  };
}

export interface DatasetGroup {
  id: string;
  label: string;
  description: string;
  compatibility: WingDataset["compatibilityGroup"];
  activeParameters: ParameterName[];
  fixedParameters: Partial<ParameterVector>;
  admittedSampleCount: number;
  uniqueGeometryCount: number;
  records: WingRecord[];
}

export interface ValidatedSnapshot {
  manifest: SnapshotManifest;
  groups: DatasetGroup[];
}

export function vectorFromTuple(values: readonly number[]): ParameterVector {
  return Object.fromEntries(PARAMETER_ORDER.map((name, index) => [name, values[index]!])) as ParameterVector;
}

export function recordsFromDataset(dataset: WingDataset): WingRecord[] {
  return dataset.columns.stableRecordIndex.map((stableRecordIndex, index) => {
    const parameters = vectorFromTuple(dataset.columns.parameters[index]!);
    return {
      stableRecordIndex,
      parameters,
      coordinates: buildBp3333(parameters),
      cl: dataset.columns.cl[index]!,
      cd: dataset.columns.cd[index]!,
      curvatureRatio: dataset.columns.curvatureRatio[index]!,
      provenance: {
        runId: dataset.columns.runId[index]!,
        globalStep: dataset.columns.globalStep[index]!,
        recordedAt: dataset.columns.recordedAt[index]!,
        replicateCount: dataset.columns.replicateCount[index]!
      }
    };
  });
}
