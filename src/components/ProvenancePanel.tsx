import { Fingerprint, ShieldCheck } from "lucide-react";
import { PARAMETER_BY_NAME, PARAMETER_ORDER, formatParameter } from "../domain/parameters";
import type { DatasetGroup, SnapshotManifest, WingRecord } from "../domain/schema";

function formatDate(value: string | null): string {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function ProvenancePanel({ record, group, manifest }: { record: WingRecord; group: DatasetGroup; manifest: SnapshotManifest }) {
  const fixed = PARAMETER_ORDER.filter((parameter) => !group.activeParameters.includes(parameter));
  return (
    <section className="card provenance-card" aria-labelledby="provenance-title">
      <div className="card-heading-row">
        <div>
          <p className="eyebrow">Traceable source</p>
          <h2 id="provenance-title">Provenance</h2>
        </div>
        <ShieldCheck aria-hidden="true" size={19} />
      </div>
      <dl className="provenance-list">
        <div><dt>Run ID</dt><dd data-testid="provenance-run-id">{record.provenance.runId}</dd></div>
        <div><dt>Global step</dt><dd>{record.provenance.globalStep.toLocaleString()}</dd></div>
        <div><dt>Recorded</dt><dd>{formatDate(record.provenance.recordedAt)}</dd></div>
        <div><dt>Replicates</dt><dd>{record.provenance.replicateCount.toLocaleString()}</dd></div>
        <div><dt>Source runs</dt><dd>{manifest.sourceRunCount.toLocaleString()}</dd></div>
      </dl>
      <div className="compatibility-note">
        <Fingerprint size={16} aria-hidden="true" />
        <div><strong>{group.compatibility.label}</strong><span>{group.compatibility.description}</span></div>
      </div>
      <details>
        <summary>Fixed BP3333 parameters <span>{fixed.length}</span></summary>
        <dl className="fixed-grid">
          {fixed.map((parameter) => (
            <div key={parameter}><dt>{PARAMETER_BY_NAME[parameter].symbol}</dt><dd>{formatParameter(record.parameters[parameter])}</dd></div>
          ))}
        </dl>
      </details>
    </section>
  );
}
