import { PARAMETER_ORDER, type ParameterName } from "../domain/parameters";
import {
  SnapshotManifestV1,
  WingDatasetV1,
  recordsFromDataset,
  type DatasetGroup,
  type SnapshotManifest,
  type ValidatedSnapshot,
  type WingDataset
} from "../domain/schema";

export type SnapshotFailureKind = "offline" | "malformed" | "exporter-failure" | "http";

export class SnapshotLoadError extends Error {
  readonly kind: SnapshotFailureKind;

  constructor(kind: SnapshotFailureKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SnapshotLoadError";
    this.kind = kind;
  }
}

interface LoadOptions {
  manifestUrl?: string;
  refreshToken?: string | number;
  signal?: AbortSignal;
}

function manifestRequestUrl(path: string, refreshToken?: string | number): string {
  if (refreshToken === undefined) return path;
  if (globalThis.location?.href) {
    const url = new URL(path, globalThis.location.href);
    url.searchParams.set("refresh", String(refreshToken));
    return `${url.pathname}${url.search}`;
  }
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}refresh=${encodeURIComponent(String(refreshToken))}`;
}

export function resolveDatasetUrl(path: string, manifestPath = "/data/manifest.json"): string {
  if (/^https?:\/\//i.test(path)) throw new SnapshotLoadError("malformed", "Dataset paths must be same-origin relative paths.");
  if (path.startsWith("/")) return path;
  if (path.startsWith("data/")) return `/${path}`;
  const base = manifestPath.split("?")[0] ?? manifestPath;
  const directory = base.slice(0, Math.max(0, base.lastIndexOf("/") + 1));
  return `${directory}${path}`;
}

async function sha256Hex(textValue: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new SnapshotLoadError("malformed", "This browser cannot verify snapshot checksums.");
  const bytes = new TextEncoder().encode(textValue);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function requestText(url: string, init: RequestInit, resource: "manifest" | "dataset"): Promise<string> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      const kind: SnapshotFailureKind = resource === "manifest" && response.status >= 500 ? "exporter-failure" : "http";
      throw new SnapshotLoadError(kind, `${resource === "manifest" ? "Snapshot manifest" : "Dataset"} request failed (${response.status}).`);
    }
    return await response.text();
  } catch (error) {
    if (error instanceof SnapshotLoadError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new SnapshotLoadError("offline", `Could not reach the ${resource}.`, { cause: error });
  }
}

function parseJson(textValue: string, resource: string): unknown {
  try {
    return JSON.parse(textValue) as unknown;
  } catch (error) {
    throw new SnapshotLoadError("malformed", `${resource} is not valid JSON.`, { cause: error });
  }
}

function parseManifest(textValue: string): SnapshotManifest {
  const result = SnapshotManifestV1.safeParse(parseJson(textValue, "Snapshot manifest"));
  if (!result.success) throw new SnapshotLoadError("malformed", "Snapshot manifest failed validation.", { cause: result.error });
  return result.data;
}

function parseDataset(textValue: string, path: string): WingDataset {
  const result = WingDatasetV1.safeParse(parseJson(textValue, `Dataset ${path}`));
  if (!result.success) throw new SnapshotLoadError("malformed", `Dataset ${path} failed validation.`, { cause: result.error });
  return result.data;
}

function sameParameterList(first: readonly ParameterName[], second: readonly ParameterName[]): boolean {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

function validateDatasetAgainstManifest(dataset: WingDataset, entry: SnapshotManifest["datasets"][number], manifest: SnapshotManifest): void {
  if (dataset.compatibilityGroup.id !== entry.compatibilityGroupId || dataset.shardIndex !== entry.shardIndex || dataset.shardCount !== entry.shardCount) {
    throw new SnapshotLoadError("malformed", `Dataset ${entry.path} does not match its manifest descriptor.`);
  }
  if (dataset.columns.stableRecordIndex.length !== entry.recordCount) {
    throw new SnapshotLoadError("malformed", `Dataset ${entry.path} record count does not match the manifest.`);
  }
  if (!sameParameterList(dataset.activeParameters, entry.activeParameters)) {
    throw new SnapshotLoadError("malformed", `Dataset ${entry.path} active parameters do not match the manifest.`);
  }
  if (dataset.compatibilityGroup.label !== entry.label || dataset.compatibilityGroup.description !== entry.description) {
    throw new SnapshotLoadError("malformed", `Dataset ${entry.path} public descriptor does not match the manifest.`);
  }
  for (const parameter of PARAMETER_ORDER) {
    const manifestValue = entry.fixedParameters[parameter];
    const datasetValue = dataset.fixedParameters[parameter];
    if (manifestValue !== datasetValue) {
      throw new SnapshotLoadError("malformed", `Dataset ${entry.path} fixed parameter ${parameter} does not match the manifest.`);
    }
  }
  for (const [rowIndex, vector] of dataset.columns.parameters.entries()) {
    for (const [parameterIndex, parameter] of PARAMETER_ORDER.entries()) {
      const bounds = manifest.parameterBounds[parameter]!;
      const value = vector[parameterIndex]!;
      if (value < bounds.minimum || value > bounds.maximum) {
        throw new SnapshotLoadError("malformed", `Dataset ${entry.path} row ${rowIndex} has ${parameter} outside authoritative bounds.`);
      }
    }
  }
}

function assembleGroups(manifest: SnapshotManifest, loaded: { entry: SnapshotManifest["datasets"][number]; dataset: WingDataset }[]): DatasetGroup[] {
  const grouped = new Map<string, typeof loaded>();
  for (const item of loaded) {
    const group = grouped.get(item.entry.compatibilityGroupId) ?? [];
    group.push(item);
    grouped.set(item.entry.compatibilityGroupId, group);
  }

  return Array.from(grouped.entries(), ([id, shards]) => {
    shards.sort((first, second) => first.dataset.shardIndex - second.dataset.shardIndex);
    const first = shards[0]!;
    if (shards.length !== first.dataset.shardCount || shards.some((item, index) => item.dataset.shardIndex !== index)) {
      throw new SnapshotLoadError("malformed", `Compatibility group ${id} has missing or duplicate shards.`);
    }
    for (const item of shards.slice(1)) {
      if (!sameParameterList(item.dataset.activeParameters, first.dataset.activeParameters) || item.dataset.compatibilityGroup.id !== first.dataset.compatibilityGroup.id) {
        throw new SnapshotLoadError("malformed", `Compatibility group ${id} has inconsistent shard metadata.`);
      }
    }
    const records = shards.flatMap(({ dataset }) => recordsFromDataset(dataset)).sort((a, b) => a.stableRecordIndex - b.stableRecordIndex);
    if (new Set(records.map((record) => record.stableRecordIndex)).size !== records.length) {
      throw new SnapshotLoadError("malformed", `Compatibility group ${id} contains duplicate stable record indices.`);
    }
    if (records.length !== first.dataset.groupUniqueGeometryCount) {
      throw new SnapshotLoadError("malformed", `Compatibility group ${id} unique-geometry count does not match its rows.`);
    }
    return {
      id,
      label: first.entry.label,
      description: first.entry.description,
      compatibility: first.dataset.compatibilityGroup,
      activeParameters: [...first.dataset.activeParameters],
      fixedParameters: { ...first.dataset.fixedParameters },
      admittedSampleCount: first.dataset.groupAdmittedSampleCount,
      uniqueGeometryCount: first.dataset.groupUniqueGeometryCount,
      records
    };
  });
}

/** Fetches and validates every chunk before exposing a new immutable snapshot. */
export async function loadSnapshot(options: LoadOptions = {}): Promise<ValidatedSnapshot> {
  const manifestPath = options.manifestUrl ?? "/data/manifest.json";
  const requestUrl = manifestRequestUrl(manifestPath, options.refreshToken);
  const manifestText = await requestText(requestUrl, { signal: options.signal, cache: options.refreshToken === undefined ? "default" : "no-store" }, "manifest");
  const manifest = parseManifest(manifestText);
  const loaded = await Promise.all(
    manifest.datasets.map(async (entry) => {
      const url = resolveDatasetUrl(entry.path, manifestPath);
      const textValue = await requestText(url, { signal: options.signal, cache: "default" }, "dataset");
      const byteSize = new TextEncoder().encode(textValue).byteLength;
      if (byteSize !== entry.byteSize) throw new SnapshotLoadError("malformed", `Dataset ${entry.path} byte size does not match its manifest.`);
      if ((await sha256Hex(textValue)) !== entry.sha256.toLowerCase()) throw new SnapshotLoadError("malformed", `Dataset ${entry.path} checksum does not match its manifest.`);
      const dataset = parseDataset(textValue, entry.path);
      validateDatasetAgainstManifest(dataset, entry, manifest);
      return { entry, dataset };
    })
  );
  try {
    return { manifest, groups: assembleGroups(manifest, loaded) };
  } catch (error) {
    if (error instanceof SnapshotLoadError) throw error;
    throw new SnapshotLoadError("malformed", "Snapshot geometry reconstruction failed validation.", { cause: error });
  }
}

export function isSnapshotStale(snapshot: ValidatedSnapshot, now = Date.now(), staleAfterHours = 24): boolean {
  return now - Date.parse(snapshot.manifest.generatedAt) > staleAfterHours * 60 * 60 * 1000;
}
