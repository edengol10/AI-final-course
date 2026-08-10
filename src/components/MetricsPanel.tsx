import { Activity, Gauge, Waves } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { WingRecord } from "../domain/schema";

interface MetricCardProps {
  label: string;
  testId: string;
  value: ReactNode;
  note: string;
  unavailable?: boolean;
}

function MetricCard({ label, testId, value, note, unavailable = false }: MetricCardProps) {
  return (
    <article className={`metric-card${unavailable ? " unavailable" : ""}`} data-testid={testId}>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function SignedBar({ label, value, scale, testId }: { label: string; value: number; scale: number; testId: string }) {
  const extent = (Math.abs(value) / scale) * 50;
  const style = {
    "--bar-left": `${value < 0 ? 50 - extent : 50}%`,
    "--bar-width": `${extent}%`
  } as CSSProperties;
  return (
    <div className="coefficient-row" data-testid={testId}>
      <div className="coefficient-label"><span>{label}</span><strong>{value >= 0 ? "+" : ""}{value.toFixed(5)}</strong></div>
      <div className="signed-track" role="img" aria-label={`${label} ${value}; signed scale from ${-scale} to ${scale}, zero at center`}>
        <span className="zero-line" />
        <span className={`coefficient-bar ${value < 0 ? "negative" : "positive"}`} style={style} />
      </div>
    </div>
  );
}

export function MetricsPanel({
  record,
  fixture,
  modalDataIncluded
}: {
  record: WingRecord;
  fixture: boolean;
  modalDataIncluded: boolean;
}) {
  const scale = Math.max(Math.abs(record.cl), Math.abs(record.cd), 0.01);
  const frequenciesAvailable = record.frequencyPeak1 !== null && record.frequencyPeak2 !== null;
  return (
    <section className="card metrics-card" aria-labelledby="metrics-title">
      <div className="card-heading-row">
        <div>
          <p className="eyebrow">No interpolation</p>
          <h2 id="metrics-title">{fixture ? "Synthetic fixture response" : "Measured response"}</h2>
        </div>
        <Activity aria-hidden="true" size={19} />
      </div>
      <div className="coefficient-chart">
        <div className="coefficient-scale"><span>−{scale.toFixed(3)}</span><span>0</span><span>+{scale.toFixed(3)}</span></div>
        <SignedBar label="Cl" value={record.cl} scale={scale} testId="metric-cl" />
        <SignedBar label="Cd" value={record.cd} scale={scale} testId="metric-cd" />
      </div>
      {modalDataIncluded ? (
        <div className="metric-grid">
          <MetricCard
            label="1st frequency peak — SPOD mode 1"
            testId="metric-frequency-1"
            value={frequenciesAvailable ? <>{record.frequencyPeak1!.toFixed(5)} <span className="unit">TU⁻¹</span></> : "Unavailable"}
            note={frequenciesAvailable ? "Resolved mode-1 peak" : "Not present in this snapshot"}
            unavailable={!frequenciesAvailable}
          />
          <MetricCard
            label="2nd frequency peak — SPOD mode 1"
            testId="metric-frequency-2"
            value={frequenciesAvailable ? <>{record.frequencyPeak2!.toFixed(5)} <span className="unit">TU⁻¹</span></> : "Unavailable"}
            note={frequenciesAvailable ? "Resolved mode-1 peak" : "Not present in this snapshot"}
            unavailable={!frequenciesAvailable}
          />
          <MetricCard
            label="Curvature ratio"
            testId="metric-curvature"
            value={record.curvatureRatio.toFixed(5)}
            note="Admitted below 1.0"
          />
        </div>
      ) : null}
      <p className="measurement-note"><Gauge size={15} aria-hidden="true" /> {fixture ? "Values are copied from one synthetic QA row; they are not live research results." : modalDataIncluded ? "Values are copied from one verified CFD/SPOD database row." : "Values are copied from one verified CFD database row."}</p>
      {modalDataIncluded && !frequenciesAvailable ? (
        <p className="frequency-warning"><Waves size={15} aria-hidden="true" /> Frequency data is unavailable; no zero or estimate is substituted.</p>
      ) : null}
    </section>
  );
}
