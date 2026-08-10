import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { SnapshotManifestV1 } from "./domain/schema";

const publicDataPath = resolve(process.cwd(), "public/data");
const manifestText = readFileSync(resolve(publicDataPath, "manifest.json"), "utf8");
const manifest = SnapshotManifestV1.parse(JSON.parse(manifestText) as unknown);
const fixtureResponses = new Map<string, string>([["/data/manifest.json", manifestText]]);
for (const entry of manifest.datasets) fixtureResponses.set(`/data/${entry.path}`, readFileSync(resolve(publicDataPath, entry.path), "utf8"));

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
    expect(screen.getByTestId("public-data-policy")).toHaveTextContent(/SPOD and modal values are stripped/i);
    expect(container.querySelector(".app-shell")).toHaveAttribute("data-selected-record-index", "0");

    const slider = screen.getByRole("slider", { name: /Camber position requested value/i });
    slider.focus();
    await user.keyboard("{End}");

    await waitFor(() => expect(container.querySelector(".app-shell")).toHaveAttribute("data-selected-record-index", "1"));
    expect(screen.getByTestId("metric-cl")).toHaveTextContent("+0.72000");
    expect(screen.getByTestId("metric-cd")).toHaveTextContent("+0.02900");
    expect(screen.getByTestId("provenance-run-id")).toHaveTextContent("nl9fb08e");
    expect(screen.getByTestId("requested-marker-x_c")).toBeInTheDocument();
    expect(slider).toHaveAttribute("aria-valuenow", "0.6200000047683716");
  });

  it("omits public modal cards and announces unchanged refresh", async () => {
    const requests = mockFixtureFetch();
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByTestId("modal-data-policy")).toHaveTextContent(/excluded from this public Cl\/Cd dataset/i);
    expect(screen.queryByTestId("metric-frequency-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("metric-frequency-2")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh validated snapshot" }));
    expect(await screen.findByText("Already up to date — validated snapshot is unchanged.")).toBeInTheDocument();
    const refreshManifest = requests.find((url) => url.includes("manifest.json?refresh="));
    expect(refreshManifest).toBeDefined();
    expect(requests.filter((url) => url.includes("datasets/")).every((url) => !url.includes("?"))).toBe(true);
  });
});
