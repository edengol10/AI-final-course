import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { MetricsPanel } from "./components/MetricsPanel";
import { findMostEfficientRecord } from "./domain/efficiency";
import { recordsFromDataset, SnapshotManifestV1, WingDatasetV1 } from "./domain/schema";

const publicDataPath = resolve(process.cwd(), "public/data");
const manifestText = readFileSync(resolve(publicDataPath, "manifest.json"), "utf8");
const manifest = SnapshotManifestV1.parse(JSON.parse(manifestText) as unknown);
const fixtureResponses = new Map<string, string>([["/data/manifest.json", manifestText]]);
for (const entry of manifest.datasets) fixtureResponses.set(`/data/${entry.path}`, readFileSync(resolve(publicDataPath, entry.path), "utf8"));
const fixtureGroupId = manifest.datasets[0]!.compatibilityGroupId;
const fixtureRecords = manifest.datasets
  .filter((entry) => entry.compatibilityGroupId === fixtureGroupId)
  .flatMap((entry) => recordsFromDataset(WingDatasetV1.parse(JSON.parse(fixtureResponses.get(`/data/${entry.path}`)!))));
const greatestCamberPositionRecord = fixtureRecords.reduce((best, candidate) => candidate.parameters.x_c > best.parameters.x_c ? candidate : best);

function mockFixtureFetch() {
  const requests: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    requests.push(rawUrl);
    const url = new URL(rawUrl, "http://localhost");
    const body = fixtureResponses.get(url.pathname);
    return body === undefined ? new Response("not found", { status: 404 }) : new Response(body, { status: 200 });
  }));
  return requests;
}

afterEach(() => vi.unstubAllGlobals());

describe("Airfoil Explorer row and interaction contract", () => {
  it("keeps geometry, sliders, metrics, and provenance on one row after keyboard commit", async () => {
    mockFixtureFetch();
    const user = userEvent.setup();
    const { container } = render(<App />);
    expect(await screen.findByRole("heading", { name: "BP3333 geometry" })).toBeInTheDocument();
    expect(screen.getByTestId("fixture-banner")).toHaveTextContent(/not live thesis results/i);
    expect(screen.getAllByRole("slider")).toHaveLength(4);
    await user.selectOptions(screen.getByRole("combobox"), fixtureGroupId);
    expect(container.querySelector(".app-shell")).toHaveAttribute("data-selected-record-index", "0");
    expect(screen.getByTestId("metric-efficiency")).toHaveTextContent("Cl/Cd");
    expect(screen.getAllByTestId(/^best-metric-marker-/)).toHaveLength(3);
    expect(screen.getAllByTestId(/^best-parameter-marker-/)).toHaveLength(4);

    const slider = screen.getByRole("slider", { name: /Camber position requested value/i });
    slider.focus();
    await user.keyboard("{End}");

    await waitFor(() => expect(container.querySelector(".app-shell")).toHaveAttribute("data-selected-record-index", String(greatestCamberPositionRecord.stableRecordIndex)));
    expect(screen.getByTestId("metric-cl")).toHaveTextContent(`+${greatestCamberPositionRecord.cl.toFixed(5)}`);
    expect(screen.getByTestId("metric-cd")).toHaveTextContent(`+${greatestCamberPositionRecord.cd.toFixed(5)}`);
    expect(screen.getByTestId("provenance-run-id")).toHaveTextContent(greatestCamberPositionRecord.provenance.runId);
    expect(screen.getByTestId("requested-marker-x_c")).toBeInTheDocument();
    expect(slider).toHaveAttribute("aria-valuenow", String(greatestCamberPositionRecord.parameters.x_c));
  });

  it("labels every metric as unavailable without a measured record", async () => {
    render(<MetricsPanel record={null} records={fixtureRecords} bestRecord={findMostEfficientRecord(fixtureRecords)} fixture />);

    expect(screen.getAllByText("Measured metrics unavailable")).toHaveLength(3);
    expect(screen.getAllByTestId(/^best-metric-marker-/)).toHaveLength(3);
  });

  it("announces unchanged refresh", async () => {
    const requests = mockFixtureFetch();
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "BP3333 geometry" });
    await user.click(screen.getByRole("button", { name: "Refresh validated snapshot" }));
    expect(await screen.findByText("Already up to date — validated snapshot is unchanged.")).toBeInTheDocument();
    const refreshManifest = requests.find((url) => url.includes("manifest.json?refresh="));
    expect(refreshManifest).toBeDefined();
    expect(requests.filter((url) => url.includes("datasets/")).every((url) => !url.includes("?"))).toBe(true);
  });
});
