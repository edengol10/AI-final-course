import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSnapshot, SnapshotLoadError } from "./snapshot";
import { SnapshotManifestV1 } from "../domain/schema";

const publicDataPath = resolve(process.cwd(), "public/data");
const manifestText = readFileSync(resolve(publicDataPath, "manifest.json"), "utf8");
const manifest = SnapshotManifestV1.parse(JSON.parse(manifestText) as unknown);
const responses = new Map<string, string>([["/data/manifest.json", manifestText]]);
for (const entry of manifest.datasets) responses.set(`/data/${entry.path}`, readFileSync(resolve(publicDataPath, entry.path), "utf8"));

function installFetch(overrides = new Map<string, string>()) {
  const requests: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    requests.push(rawUrl);
    const url = new URL(rawUrl, "http://localhost");
    const key = `${url.pathname}${url.pathname.endsWith("manifest.json") ? "" : url.search}`;
    const body = overrides.get(key) ?? responses.get(key);
    return body === undefined ? new Response("not found", { status: 404 }) : new Response(body, { status: 200 });
  }));
  return requests;
}

afterEach(() => vi.unstubAllGlobals());

describe("atomic snapshot loading and refresh", () => {
  it("fully validates fixture chunks and cache-busts only manifest.json", async () => {
    const requests = installFetch();
    const snapshot = await loadSnapshot({ refreshToken: "contract-test" });
    expect(snapshot.groups).toHaveLength(5);
    expect(snapshot.groups.flatMap((group) => group.records)).toHaveLength(7);
    expect(requests[0]).toBe("/data/manifest.json?refresh=contract-test");
    expect(requests.slice(1).every((url) => !url.includes("?"))).toBe(true);
  });

  it("rejects malformed refresh data without returning a partial snapshot", async () => {
    installFetch(new Map([["/data/manifest.json", "{bad json"]]));
    await expect(loadSnapshot({ refreshToken: 1 })).rejects.toMatchObject({ kind: "malformed" } satisfies Partial<SnapshotLoadError>);
  });

  it("classifies network failures as offline", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("network down"); }));
    await expect(loadSnapshot()).rejects.toMatchObject({ kind: "offline" } satisfies Partial<SnapshotLoadError>);
  });
});
