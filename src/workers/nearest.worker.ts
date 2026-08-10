/// <reference lib="webworker" />

import { findNearestRecordIndex, type NearestRecord, type ParameterBounds } from "../domain/nearest";
import type { ParameterName, ParameterVector } from "../domain/parameters";

interface ReplaceMessage {
  type: "replace";
  revision: number;
  records: NearestRecord[];
  activeParameters: ParameterName[];
  bounds: ParameterBounds;
}

interface QueryMessage {
  type: "query";
  revision: number;
  requestId: number;
  requested: ParameterVector;
}

let revision = 0;
let records: NearestRecord[] = [];
let activeParameters: ParameterName[] = [];
let bounds: ParameterBounds | null = null;

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

workerScope.addEventListener("message", (event: MessageEvent<ReplaceMessage | QueryMessage>) => {
  if (event.data.type === "replace") {
    revision = event.data.revision;
    records = event.data.records;
    activeParameters = event.data.activeParameters;
    bounds = event.data.bounds;
    workerScope.postMessage({ type: "ready", revision });
    return;
  }
  if (event.data.revision !== revision || bounds === null) return;
  workerScope.postMessage({
    type: "result",
    revision,
    requestId: event.data.requestId,
    recordIndex: findNearestRecordIndex(event.data.requested, records, activeParameters, bounds)
  });
});

export {};
