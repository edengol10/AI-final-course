import { useCallback, useEffect, useRef } from "react";
import { findNearestRecordIndex, type ParameterBounds } from "../domain/nearest";
import type { ParameterVector } from "../domain/parameters";
import type { DatasetGroup } from "../domain/schema";

interface WorkerResult {
  type: "result";
  revision: number;
  requestId: number;
  recordIndex: number;
}

interface PendingRequest {
  resolve: (recordIndex: number) => void;
  reject: (reason: Error) => void;
}

export function useNearestWorker(group: DatasetGroup | null, bounds: ParameterBounds | null): (requested: ParameterVector) => Promise<number> {
  const workerRef = useRef<Worker | null>(null);
  const revisionRef = useRef(0);
  const requestIdRef = useRef(0);
  const pendingRef = useRef(new Map<number, PendingRequest>());
  const groupRef = useRef(group);
  const boundsRef = useRef(bounds);
  groupRef.current = group;
  boundsRef.current = bounds;

  useEffect(() => {
    revisionRef.current += 1;
    const revision = revisionRef.current;
    for (const request of pendingRef.current.values()) request.reject(new Error("Nearest-neighbor dataset was replaced."));
    pendingRef.current.clear();
    if (!group || !bounds || typeof Worker === "undefined") return;

    const worker = new Worker(new URL("../workers/nearest.worker.ts", import.meta.url), { type: "module", name: "airfoil-nearest-neighbor" });
    workerRef.current = worker;
    worker.addEventListener("message", (event: MessageEvent<WorkerResult>) => {
      if (event.data.type !== "result" || event.data.revision !== revisionRef.current) return;
      const pending = pendingRef.current.get(event.data.requestId);
      if (!pending) return;
      pendingRef.current.delete(event.data.requestId);
      pending.resolve(event.data.recordIndex);
    });
    worker.postMessage({
      type: "replace",
      revision,
      records: group.records.map(({ stableRecordIndex, parameters }) => ({ stableRecordIndex, parameters })),
      activeParameters: group.activeParameters,
      bounds
    });
    return () => {
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };
  }, [group, bounds]);

  return useCallback(async (requested: ParameterVector) => {
    const currentGroup = groupRef.current;
    const currentBounds = boundsRef.current;
    if (!currentGroup || !currentBounds) return -1;
    const worker = workerRef.current;
    if (!worker) return findNearestRecordIndex(requested, currentGroup.records, currentGroup.activeParameters, currentBounds);
    const requestId = ++requestIdRef.current;
    return await new Promise<number>((resolve, reject) => {
      pendingRef.current.set(requestId, { resolve, reject });
      worker.postMessage({ type: "query", revision: revisionRef.current, requestId, requested });
    });
  }, []);
}
