import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { MetricsPanel } from "./components/MetricsPanel";
import { canonicalJson } from "./data/canonicalJson";
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
const mostEfficientRecord = findMostEfficientRecord(fixtureRecords)!;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function fixtureWithoutBaseline(): Map<string, string> {
  const responses = new Map(fixtureResponses);
  const nextManifest = structuredClone(manifest);
  const entry = nextManifest.datasets[0]!;
  const dataset = structuredClone(JSON.parse(responses.get(`/data/${entry.path}`)!) as Record<string, unknown>) as {
    columns: { parameters: number[][] };
  };
  const baselineParameters = dataset.columns.parameters.at(-1);
  if (!baselineParameters || baselineParameters[1] === undefined) throw new Error("Fixture baseline row is missing x_c.");
  baselineParameters[1] += 0.0001;
  const datasetText = JSON.stringify(dataset);
  entry.byteSize = Buffer.byteLength(datasetText);
  entry.sha256 = sha256(datasetText);
  const manifestPayload: Record<string, unknown> = { ...nextManifest };
  delete manifestPayload.canonicalSha256;
  nextManifest.canonicalSha256 = sha256(canonicalJson(manifestPayload));
  responses.set(`/data/${entry.path}`, datasetText);
  responses.set("/data/manifest.json", JSON.stringify(nextManifest));
  return responses;
}

function mockFixtureFetch(responses = fixtureResponses) {
  const requests: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    requests.push(rawUrl);
    const url = new URL(rawUrl, "http://localhost");
    const body = responses.get(url.pathname);
    return body === undefined ? new Response("not found", { status: 404 }) : new Response(body, { status: 200 });
  }));
  return requests;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Airfoil Explorer row and interaction contract", () => {
  it("shows the merged conditions and coordinates exact best and NACA measured selections", async () => {
    const nativeToLocaleString = Number.prototype.toLocaleString;
    vi.spyOn(Number.prototype, "toLocaleString").mockImplementation(function (this: number, locales, options) {
      return nativeToLocaleString.call(this, locales ?? "de-DE", options);
    });
    mockFixtureFetch();
    const user = userEvent.setup();
    const { container } = render(<App />);

    expect(await screen.findByRole("heading", { name: "BP3333 geometry" })).toBeInTheDocument();
    const conditionStrip = screen.getByTestId("condition-strip");
    expect(within(conditionStrip).getByText("Re 3,000")).toBeInTheDocument();
    expect(within(conditionStrip).getByText("Grid 900×210")).toBeInTheDocument();
    expect(within(conditionStrip).getByText("AoA 7°")).toBeInTheDocument();
    expect(within(conditionStrip).getByText("Averaging 30–60 TU")).toBeInTheDocument();
    expect(screen.getByTestId("selected-source-label")).toHaveTextContent(/Run fo7gm0ds · Step 10/);

    await user.click(screen.getByRole("button", { name: "Go to best wing" }));
    expect(container.querySelector(".app-shell")).toHaveAttribute("data-selected-record-index", String(mostEfficientRecord.stableRecordIndex));
    expect(screen.getByTestId("selected-source-label")).toHaveTextContent(`Run ${mostEfficientRecord.provenance.runId} · Step ${mostEfficientRecord.provenance.globalStep}`);
    expect(screen.getByTestId("metric-cl")).toHaveTextContent(`+${mostEfficientRecord.cl.toFixed(5)}`);
    expect(screen.getByTestId("provenance-run-id")).toHaveTextContent(mostEfficientRecord.provenance.runId);

    await user.click(screen.getByRole("button", { name: "Go to NACA 2412" }));
    expect(screen.getByTestId("selected-wing-path")).toHaveAttribute("d", screen.getByTestId("reference-wing-path").getAttribute("d"));
    expect(screen.getByTestId("selected-source-label")).toHaveTextContent(/Run k202yi52 · Step 50/);
    expect(screen.getByTestId("metric-cl")).toHaveTextContent("+0.45000");
    expect(screen.getByTestId("provenance-run-id")).toHaveTextContent("k202yi52");
  });

  it("uses reference-only NACA geometry without nearby metrics and exits on slider movement", async () => {
    mockFixtureFetch(fixtureWithoutBaseline());
    const user = userEvent.setup();
    const { container } = render(<App />);

    expect(await screen.findByRole("heading", { name: "BP3333 geometry" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Go to NACA 2412" }));

    expect(container.querySelector(".app-shell")).toHaveAttribute("data-selected-record-index", "");
    expect(screen.getByTestId("selected-wing-path")).toHaveAttribute("d", screen.getByTestId("reference-wing-path").getAttribute("d"));
    expect(screen.getByTestId("selected-source-label")).toHaveTextContent("Reference definition · no measured run/step");
    expect(screen.getAllByText("Measured metrics unavailable")).toHaveLength(3);
    expect(screen.getByText("Reference definition · no measured run/step")).toBeInTheDocument();
    expect(screen.queryByTestId("provenance-run-id")).not.toBeInTheDocument();

    const slider = screen.getByRole("slider", { name: /Camber position requested value/i });
    slider.focus();
    await user.keyboard("{ArrowRight}");

    await waitFor(() => expect(container.querySelector(".app-shell")).not.toHaveAttribute("data-selected-record-index", ""));
    expect(screen.getByTestId("selected-source-label")).toHaveTextContent(/Run .* · Step /);
    expect(screen.queryByText("Measured metrics unavailable")).not.toBeInTheDocument();
    expect(screen.getByTestId("provenance-run-id")).toBeInTheDocument();
  });

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
