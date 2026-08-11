import { createHash } from "node:crypto";
import type { Page, Request } from "@playwright/test";
import { canonicalJson } from "../src/data/canonicalJson";

const parameterOrder = [
  "r_le",
  "x_c",
  "y_c",
  "k_c",
  "y_t",
  "x_t",
  "beta_te",
  "k_t",
  "gamma_le",
  "alpha_te"
] as const;

const parameterBounds = {
  r_le: { minimum: -0.08, maximum: -0.0005 },
  x_c: { minimum: 0.25, maximum: 0.75 },
  y_c: { minimum: 0.003, maximum: 0.09 },
  k_c: { minimum: -2.2, maximum: -0.01 },
  y_t: { minimum: 0.03, maximum: 0.18 },
  x_t: { minimum: 0.08, maximum: 0.5 },
  beta_te: { minimum: 0.005, maximum: 0.5 },
  k_t: { minimum: -1.2, maximum: -0.1 },
  gamma_le: { minimum: 0.01, maximum: 0.5 },
  alpha_te: { minimum: 0.005, maximum: 0.9 }
};

const fixedParameters = {
  r_le: -0.016146018916033678,
  y_c: 0.02038049164704984,
  k_c: -0.21172827316723572,
  x_t: 0.2989015826574153,
  beta_te: 0.1373828669255089,
  k_t: -0.514126765787434,
  gamma_le: 0.0725896568547561,
  alpha_te: 0.4022178081503657
};

const rowA = [
  fixedParameters.r_le,
  0.3,
  fixedParameters.y_c,
  fixedParameters.k_c,
  0.07,
  fixedParameters.x_t,
  fixedParameters.beta_te,
  fixedParameters.k_t,
  fixedParameters.gamma_le,
  fixedParameters.alpha_te
];

const rowB = [
  fixedParameters.r_le,
  0.7,
  fixedParameters.y_c,
  fixedParameters.k_c,
  0.14,
  fixedParameters.x_t,
  fixedParameters.beta_te,
  fixedParameters.k_t,
  fixedParameters.gamma_le,
  fixedParameters.alpha_te
];

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export interface FixtureSnapshot {
  manifest: Record<string, unknown>;
  manifestText: string;
  dataset: Record<string, unknown>;
  datasetText: string;
  datasetPath: string;
}

export function makeFixtureSnapshot(version = 1): FixtureSnapshot {
  const dataset = {
    schemaVersion: "wing-dataset-v1",
    compatibilityGroup: {
      id: "fixture-group",
      label: "Fixture-only design sweep",
      description: "Synthetic deterministic browser-test records",
      baseline: "synthetic fixture baseline",
      angleOfAttackDeg: 7,
      cfdAveragingWindow: "fixture steps 100 through 200",
      solverRevision: "fixture-revision",
      isolated: false
    },
    parameterOrder,
    activeParameters: ["x_c", "y_t"],
    fixedParameters,
    groupAdmittedSampleCount: 3,
    groupUniqueGeometryCount: 2,
    shardIndex: 0,
    shardCount: 1,
    columns: {
      stableRecordIndex: [101, 151, 202],
      parameters: [rowA, rowA, rowB],
      cl: [0.111, 0.222, 0.777 + version / 1_000],
      cd: [0.0222, 0.0244, -0.0333 - version / 10_000],
      curvatureRatio: [0.41, 0.43, 0.73],
      runId: ["fixture-run-row-a", "fixture-run-row-a-iteration-2", `fixture-run-row-b-v${version}`],
      globalStep: [1101, 1102, 2202 + version],
      recordedAt: ["2026-08-10T08:00:00Z", "2026-08-10T08:05:00Z", "2026-08-10T09:00:00Z"],
      replicateCount: [1, 1, 1],
      replicateProvenance: [
        [{ runId: "fixture-run-row-a", globalStep: 1101, recordedAt: "2026-08-10T08:00:00Z" }],
        [{ runId: "fixture-run-row-a-iteration-2", globalStep: 1102, recordedAt: "2026-08-10T08:05:00Z" }],
        [
          {
            runId: `fixture-run-row-b-v${version}`,
            globalStep: 2202 + version,
            recordedAt: "2026-08-10T09:00:00Z"
          }
        ]
      ]
    }
  };
  const datasetText = canonicalJson(dataset);
  const datasetSha = sha256(datasetText);
  const datasetPath = `datasets/fixture-group.${datasetSha.slice(0, 16)}.json`;
  const generatedAt = new Date(Date.now() + version * 1_000).toISOString();
  const manifestPayload = {
    schemaVersion: "snapshot-manifest-v1",
    generatedAt,
    snapshotKind: "synthetic-fixture",
    sourceRunCount: 2,
    parameterOrder,
    parameterBounds,
    datasets: [
      {
        compatibilityGroupId: "fixture-group",
        label: "Fixture-only design sweep",
        description: "Synthetic deterministic browser-test records",
        path: datasetPath,
        sha256: datasetSha,
        byteSize: Buffer.byteLength(datasetText),
        shardIndex: 0,
        shardCount: 1,
        recordCount: 3,
        groupAdmittedSampleCount: 3,
        groupUniqueGeometryCount: 2,
        activeParameters: ["x_c", "y_t"],
        fixedParameters
      }
    ],
    totals: { admittedSampleCount: 3, uniqueGeometryCount: 2, rejectedItemCount: 1 },
    rejectionCounts: { "fixture-only rejection": 1 }
  };
  const manifest = { canonicalSha256: sha256(canonicalJson(manifestPayload)), ...manifestPayload };
  return { manifest, manifestText: canonicalJson(manifest), dataset, datasetText, datasetPath };
}

function replaceGeneratedAt(snapshot: FixtureSnapshot, generatedAt: string): void {
  const payload = { ...snapshot.manifest };
  delete payload.canonicalSha256;
  payload.generatedAt = generatedAt;
  snapshot.manifest = { canonicalSha256: sha256(canonicalJson(payload)), ...payload };
  snapshot.manifestText = canonicalJson(snapshot.manifest);
}

export type RefreshMode = "same" | "newer" | "older" | "malformed" | "offline" | "exporter-failure";
export type InitialMode = "ready" | "malformed" | "offline" | "exporter-failure";

export interface FixtureController {
  initial: FixtureSnapshot;
  newer: FixtureSnapshot;
  older: FixtureSnapshot;
  requests: Request[];
  setRefreshMode(mode: RefreshMode): void;
}

export async function installFixtureRoutes(
  page: Page,
  options: { initialMode?: InitialMode } = {}
): Promise<FixtureController> {
  const initial = makeFixtureSnapshot(1);
  const newer = makeFixtureSnapshot(2);
  const older = makeFixtureSnapshot(3);
  replaceGeneratedAt(older, "2000-01-01T00:00:00.000Z");
  const chunks = new Map([
    [`/data/${initial.datasetPath}`, initial.datasetText],
    [`/data/${newer.datasetPath}`, newer.datasetText],
    [`/data/${older.datasetPath}`, older.datasetText]
  ]);
  const requests: Request[] = [];
  let refreshMode: RefreshMode = "same";

  await page.route("**/data/**/*.json*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push(request);
    if (url.pathname === "/data/manifest.json") {
      const isRefresh = url.searchParams.has("refresh");
      const mode = isRefresh ? refreshMode : options.initialMode ?? "ready";
      if (mode === "offline") {
        await route.abort("internetdisconnected");
        return;
      }
      if (mode === "exporter-failure") {
        await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
        return;
      }
      if (mode === "malformed") {
        await route.fulfill({ status: 200, contentType: "application/json", body: '{"schemaVersion":"wrong"}' });
        return;
      }
      const snapshot = mode === "newer" ? newer : mode === "older" ? older : initial;
      await route.fulfill({ status: 200, contentType: "application/json", body: snapshot.manifestText });
      return;
    }

    const body = chunks.get(url.pathname);
    if (body === undefined) {
      await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body });
  });

  return {
    initial,
    newer,
    older,
    requests,
    setRefreshMode(mode) {
      refreshMode = mode;
    }
  };
}
