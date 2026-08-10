import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Check, ChevronDown, Database, RefreshCw, SlidersHorizontal, WifiOff, Wind } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MetricsPanel } from "./components/MetricsPanel";
import { ParameterSlider } from "./components/ParameterSlider";
import { ProvenancePanel } from "./components/ProvenancePanel";
import { WingPlot } from "./components/WingPlot";
import { isSnapshotStale, loadSnapshot, SnapshotLoadError, type SnapshotFailureKind } from "./data/snapshot";
import { findNearestRecordIndex, type ParameterBounds } from "./domain/nearest";
import { PARAMETER_BY_NAME, type ParameterName, type ParameterVector } from "./domain/parameters";
import type { DatasetGroup, ValidatedSnapshot, WingRecord } from "./domain/schema";
import { useNearestWorker } from "./hooks/useNearestWorker";

type RefreshState = "idle" | "checking" | "unchanged" | "updated" | "older" | SnapshotFailureKind;

interface FatalState {
  kind: SnapshotFailureKind;
  message: string;
}

const refreshCopy: Record<RefreshState, string> = {
  idle: "Snapshot ready",
  checking: "Checking for a newer snapshot…",
  unchanged: "Already up to date — verified snapshot is unchanged.",
  updated: "New snapshot loaded and controls reselected.",
  older: "A stale server snapshot was ignored; current verified data kept.",
  offline: "Offline — showing the last verified snapshot.",
  malformed: "Malformed refresh rejected — showing the last verified snapshot.",
  "exporter-failure": "Exporter unavailable — showing the last verified snapshot.",
  http: "Refresh failed — showing the last verified snapshot."
};

function getFailure(error: unknown): FatalState {
  if (error instanceof SnapshotLoadError) return { kind: error.kind, message: error.message };
  return { kind: "malformed", message: "The snapshot could not be validated." };
}

function SnapshotLoading() {
  return (
    <div className="state-shell" aria-busy="true" aria-live="polite">
      <div className="loading-orbit"><span /><span /><span /></div>
      <p className="eyebrow">Verifying local snapshot</p>
      <h1>Preparing the design space</h1>
      <p>Validating the manifest, checksums, and every dataset chunk before display.</p>
    </div>
  );
}

function SnapshotFailure({ failure, retry }: { failure: FatalState; retry: () => void }) {
  const offline = failure.kind === "offline";
  const Icon = offline ? WifiOff : AlertTriangle;
  return (
    <div className="state-shell error-state" role="alert">
      <span className="state-icon"><Icon aria-hidden="true" /></span>
      <p className="eyebrow">{offline ? "Connection unavailable" : "Snapshot not displayed"}</p>
      <h1>{offline ? "The verified data is offline" : "Data validation stopped safely"}</h1>
      <p>{failure.message} No partial or unverified rows were loaded.</p>
      <button className="primary-button" type="button" onClick={retry}><RefreshCw size={17} aria-hidden="true" />Try again</button>
    </div>
  );
}

function EmptyState({ hasDatasets }: { hasDatasets: boolean }) {
  return (
    <section className="card empty-state" role="status">
      <Database aria-hidden="true" />
      <h2>{hasDatasets ? "No verified rows in this dataset" : "No verified datasets yet"}</h2>
      <p>{hasDatasets ? "This compatibility group was exported without an admissible geometry." : "The manifest is valid, but it contains no exported compatibility groups."}</p>
    </section>
  );
}

function formatSync(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function selectNearest(group: DatasetGroup, requested: ParameterVector | null, bounds: ParameterBounds): number {
  if (group.records.length === 0) return -1;
  return requested ? findNearestRecordIndex(requested, group.records, group.activeParameters, bounds) : 0;
}

export default function App() {
  const [snapshot, setSnapshot] = useState<ValidatedSnapshot | null>(null);
  const [fatal, setFatal] = useState<FatalState | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedRecordIndex, setSelectedRecordIndex] = useState(-1);
  const [displayValues, setDisplayValues] = useState<ParameterVector | null>(null);
  const [requestedValues, setRequestedValues] = useState<ParameterVector | null>(null);
  const [snapping, setSnapping] = useState(false);
  const [refreshState, setRefreshState] = useState<RefreshState>("idle");
  const [candidateAnnouncement, setCandidateAnnouncement] = useState("");
  const valuesRef = useRef<ParameterVector | null>(null);
  const selectedGroupIdRef = useRef<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const pendingTargetRef = useRef<ParameterVector | null>(null);
  const requestEpochRef = useRef(0);
  const snapTimerRef = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();

  const group = useMemo(
    () => snapshot?.groups.find((candidate) => candidate.id === selectedGroupId) ?? snapshot?.groups[0] ?? null,
    [snapshot, selectedGroupId]
  );
  const bounds = (snapshot?.manifest.parameterBounds ?? null) as ParameterBounds | null;
  const record: WingRecord | null = group?.records[selectedRecordIndex] ?? null;
  const queryNearest = useNearestWorker(group, bounds);

  const setExactDisplay = useCallback((parameters: ParameterVector | null) => {
    valuesRef.current = parameters;
    setDisplayValues(parameters);
  }, []);

  const applySnapshot = useCallback((next: ValidatedSnapshot, requested: ParameterVector | null = null) => {
    const preferred = next.groups.find((candidate) => candidate.id === selectedGroupIdRef.current) ?? next.groups[0] ?? null;
    const nextBounds = next.manifest.parameterBounds as ParameterBounds;
    const nextIndex = preferred ? selectNearest(preferred, requested, nextBounds) : -1;
    const nextRecord = preferred?.records[nextIndex] ?? null;
    setSnapshot(next);
    selectedGroupIdRef.current = preferred?.id ?? null;
    setSelectedGroupId(preferred?.id ?? null);
    setSelectedRecordIndex(nextIndex);
    setExactDisplay(nextRecord?.parameters ?? null);
    setRequestedValues(null);
    setCandidateAnnouncement(nextRecord ? `Candidate row ${nextRecord.stableRecordIndex} selected.` : "Verified snapshot contains no selectable rows.");
  }, [setExactDisplay]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setFatal(null);
    try {
      const next = await loadSnapshot();
      applySnapshot(next);
      setRefreshState("idle");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFatal(getFailure(error));
    } finally {
      setLoading(false);
    }
  }, [applySnapshot]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => () => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    if (snapTimerRef.current !== null) window.clearTimeout(snapTimerRef.current);
  }, []);

  useEffect(() => {
    const markOffline = () => {
      if (snapshot) setRefreshState("offline");
    };
    window.addEventListener("offline", markOffline);
    return () => window.removeEventListener("offline", markOffline);
  }, [snapshot]);

  const previewNearest = useCallback((target: ParameterVector) => {
    const epoch = ++requestEpochRef.current;
    void queryNearest(target).then((index) => {
      if (epoch !== requestEpochRef.current || index < 0) return;
      setSelectedRecordIndex(index);
      const candidate = group?.records[index];
      if (candidate) setCandidateAnnouncement(`Nearest measured candidate row ${candidate.stableRecordIndex}.`);
    }).catch(() => undefined);
  }, [group, queryNearest]);

  const schedulePreview = useCallback((target: ParameterVector) => {
    pendingTargetRef.current = target;
    if (animationFrameRef.current !== null) return;
    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null;
      const pending = pendingTargetRef.current;
      pendingTargetRef.current = null;
      if (pending) previewNearest(pending);
    });
  }, [previewNearest]);

  const handleSliderChange = useCallback((parameter: ParameterName, value: number) => {
    const current = valuesRef.current ?? record?.parameters;
    if (!current) return;
    const next = { ...current, [parameter]: value };
    valuesRef.current = next;
    setDisplayValues(next);
    setRequestedValues(next);
    schedulePreview(next);
  }, [record, schedulePreview]);

  const commitRequested = useCallback((parameter: ParameterName, value: number) => {
    const current = valuesRef.current ?? record?.parameters;
    if (!current || !group) return;
    const target = { ...current, [parameter]: value };
    valuesRef.current = target;
    setRequestedValues(target);
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    pendingTargetRef.current = null;
    const epoch = ++requestEpochRef.current;
    void queryNearest(target).then((index) => {
      if (epoch !== requestEpochRef.current || index < 0) return;
      const candidate = group.records[index];
      if (!candidate) return;
      setSelectedRecordIndex(index);
      setSnapping(true);
      setExactDisplay(candidate.parameters);
      setCandidateAnnouncement(`Snapped to measured database row ${candidate.stableRecordIndex}. All active parameters and metrics now match that row.`);
      if (snapTimerRef.current !== null) window.clearTimeout(snapTimerRef.current);
      snapTimerRef.current = window.setTimeout(() => setSnapping(false), reducedMotion ? 0 : 520);
    }).catch(() => undefined);
  }, [group, queryNearest, record, reducedMotion, setExactDisplay]);

  const changeDataset = (id: string) => {
    const nextGroup = snapshot?.groups.find((candidate) => candidate.id === id) ?? null;
    const nextRecord = nextGroup?.records[0] ?? null;
    requestEpochRef.current += 1;
    selectedGroupIdRef.current = id;
    setSelectedGroupId(id);
    setSelectedRecordIndex(nextRecord ? 0 : -1);
    setExactDisplay(nextRecord?.parameters ?? null);
    setRequestedValues(null);
    setCandidateAnnouncement(nextRecord ? `${nextGroup!.label}; candidate row ${nextRecord.stableRecordIndex} selected.` : `${nextGroup?.label ?? "Dataset"} has no selectable rows.`);
  };

  const refresh = async () => {
    if (!snapshot || refreshState === "checking") return;
    setRefreshState("checking");
    try {
      const next = await loadSnapshot({ refreshToken: Date.now() });
      if (next.manifest.canonicalSha256 === snapshot.manifest.canonicalSha256) {
        setRefreshState("unchanged");
        return;
      }
      if (Date.parse(next.manifest.generatedAt) <= Date.parse(snapshot.manifest.generatedAt)) {
        setRefreshState("older");
        return;
      }
      applySnapshot(next, record?.parameters ?? null);
      setRefreshState("updated");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setRefreshState(getFailure(error).kind);
    }
  };

  if (loading) return <SnapshotLoading />;
  if (fatal || !snapshot) return <SnapshotFailure failure={fatal ?? { kind: "malformed", message: "No verified snapshot is available." }} retry={() => void loadInitial()} />;

  const stale = isSnapshotStale(snapshot);
  const statusTone = refreshState === "updated" || refreshState === "unchanged" || refreshState === "idle" ? "ok" : refreshState === "checking" ? "busy" : "warning";

  return (
    <div className="app-shell" data-selected-record-index={record?.stableRecordIndex ?? ""}>
      <a className="skip-link" href="#design-controls">Skip to design controls</a>
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true"><Wind /></div>
        <div className="brand-copy">
          <p>Verified aerodynamic research</p>
          <h1>Airfoil Explorer <span>— DRL × LBM Design Space</span></h1>
        </div>
        <div className="sync-cluster">
          <div className={`sync-status ${statusTone}`} role="status" aria-live="polite" aria-atomic="true">
            <span className="status-dot" />
            <span><strong>{refreshCopy[refreshState]}</strong><small>Last sync {formatSync(snapshot.manifest.generatedAt)}</small></span>
          </div>
          <button className="icon-button" type="button" aria-label="Refresh verified snapshot" title="Refresh verified snapshot" onClick={() => void refresh()} disabled={refreshState === "checking"}>
            <RefreshCw className={refreshState === "checking" ? "spin" : ""} size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main>
        {stale ? (
          <div className="notice warning-notice" role="status"><AlertTriangle size={17} aria-hidden="true" /><span><strong>Stale snapshot.</strong> Results remain verified, but this export is more than 24 hours old.</span></div>
        ) : null}

        <section className="dataset-toolbar" aria-labelledby="dataset-heading">
          <div className="dataset-selector-wrap">
            <label id="dataset-heading" htmlFor="dataset-selector">Dataset</label>
            <div className="select-shell">
              <select id="dataset-selector" value={group?.id ?? ""} onChange={(event) => changeDataset(event.target.value)} disabled={snapshot.groups.length === 0}>
                {snapshot.groups.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}
              </select>
              <ChevronDown aria-hidden="true" size={16} />
            </div>
            <p>{group?.description ?? "No compatibility groups are available in this snapshot."}</p>
            <p className="global-summary">Snapshot total: <strong>{snapshot.manifest.totals.uniqueGeometryCount.toLocaleString()} verified wing geometries</strong> from <strong>{snapshot.manifest.totals.admittedSampleCount.toLocaleString()} successful CFD samples</strong>.</p>
          </div>
          <dl className="dataset-stats" aria-label="Selected dataset counts">
            <div><dt>Selected wings</dt><dd>{(group?.uniqueGeometryCount ?? 0).toLocaleString()}</dd></div>
            <div><dt>Successful samples</dt><dd>{(group?.admittedSampleCount ?? 0).toLocaleString()}</dd></div>
            <div><dt>Active dimensions</dt><dd>{(group?.activeParameters.length ?? 0).toLocaleString()}</dd></div>
          </dl>
        </section>

        {!group || !record || !displayValues ? <EmptyState hasDatasets={snapshot.groups.length > 0} /> : (
          <motion.div className="dashboard-grid" initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="visual-column">
              <WingPlot record={record} />
              <MetricsPanel record={record} />
            </div>
            <aside className="control-column" aria-label="Design controls and provenance">
              <section className="card controls-card" id="design-controls" aria-labelledby="controls-title">
                <div className="card-heading-row">
                  <div>
                    <p className="eyebrow">Nearest measured neighbor</p>
                    <h2 id="controls-title">Design variables</h2>
                  </div>
                  <SlidersHorizontal size={19} aria-hidden="true" />
                </div>
                <p className="controls-intro">{group.activeParameters.length > 0 ? "Move any active dimension to preview the nearest verified row. Release to snap every control to that exact geometry." : "This isolated compatibility group contains one fixed design vector and has no editable dimensions."}</p>
                {group.activeParameters.length > 0 ? <div className="marker-key" aria-hidden="true"><span><i className="candidate-key" />Measured</span><span><i className="requested-key" />Requested</span></div> : null}
                <div className="parameter-stack">
                  {group.activeParameters.map((parameter) => {
                    const definition = PARAMETER_BY_NAME[parameter];
                    const parameterBounds = bounds![parameter];
                    return (
                      <ParameterSlider
                        key={parameter}
                        definition={definition}
                        minimum={parameterBounds.minimum}
                        maximum={parameterBounds.maximum}
                        displayValue={displayValues[parameter]}
                        measuredValue={record.parameters[parameter]}
                        requestedValue={requestedValues?.[parameter]}
                        snapping={snapping}
                        onChange={(value) => handleSliderChange(parameter, value)}
                        onCommit={(value) => commitRequested(parameter, value)}
                      />
                    );
                  })}
                </div>
                <AnimatePresence>
                  {snapping ? (
                    <motion.p className="snap-confirmation" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <Check size={15} aria-hidden="true" /> Snapped to database row {record.stableRecordIndex}
                    </motion.p>
                  ) : null}
                </AnimatePresence>
              </section>
              <ProvenancePanel record={record} group={group} manifest={snapshot.manifest} />
            </aside>
          </motion.div>
        )}
      </main>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{candidateAnnouncement}</p>
      <footer><span>Read-only verified snapshot</span><span>Manifest {snapshot.manifest.canonicalSha256.slice(0, 10)}…</span></footer>
    </div>
  );
}
