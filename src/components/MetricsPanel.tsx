import { Activity, Gauge } from "lucide-react";
import type { CSSProperties } from "react";
import type { WingRecord } from "../domain/schema";

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
  fixture
}: {
  record: WingRecord;
  fixture: boolean;
}) {
  const scale = Math.max(Math.abs(record.cl), Math.abs(record.cd), 0.01);
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
      <p className="measurement-note"><Gauge size={15} aria-hidden="true" /> {fixture ? "Values are copied from one synthetic QA row; they are not live research results." : "Values are copied from one verified CFD database row."}</p>
    </section>
  );
}
