import { Activity, Gauge } from "lucide-react";
import type { CSSProperties } from "react";
import { efficiencyFor, metricDomains } from "../domain/efficiency";
import type { WingRecord } from "../domain/schema";

type MetricName = "cl" | "cd" | "efficiency";

interface MetricRowProps {
  name: MetricName;
  label: string;
  value: number | null;
  bestValue: number | null;
  scale: number;
  signed?: boolean;
}

function boundedPercent(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(minimum) || !Number.isFinite(maximum) || maximum <= minimum) return 0;
  return Math.min(100, Math.max(0, ((value - minimum) / (maximum - minimum)) * 100));
}

function formatMetric(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(5)}`;
}

function MetricRow({ name, label, value, bestValue, scale, signed = false }: MetricRowProps) {
  const measuredPosition = value === null ? 0 : signed
    ? boundedPercent(value, -scale, scale)
    : boundedPercent(value, 0, scale);
  const bestPosition = bestValue === null ? 0 : signed
    ? boundedPercent(bestValue, -scale, scale)
    : boundedPercent(bestValue, 0, scale);
  const barStyle = signed
    ? {
        "--bar-left": `${value !== null && value < 0 ? measuredPosition : 50}%`,
        "--bar-width": `${value === null ? 0 : Math.abs(measuredPosition - 50)}%`
      } as CSSProperties
    : { "--bar-width": `${measuredPosition}%` } as CSSProperties;
  const markerStyle = { "--marker-position": `${bestPosition}%` } as CSSProperties;

  return (
    <div className="coefficient-row" data-testid={`metric-${name}`}>
      <div className="coefficient-label">
        <span>{label}</span>
        <strong>{value === null ? "Measured metrics unavailable" : formatMetric(value)}</strong>
      </div>
      <div
        className={signed ? "signed-track" : "efficiency-track"}
        role="img"
        aria-label={value === null ? `${label} measured metrics unavailable` : `${label} ${value}`}
      >
        {signed ? <span className="zero-line" /> : null}
        <span className={`coefficient-bar ${signed && value !== null && value < 0 ? "negative" : "positive"}`} style={barStyle} />
        {bestValue !== null ? (
          <>
            <span className="best-metric-marker" style={markerStyle} aria-hidden="true" data-testid={`best-metric-marker-${name}`} />
            <span className="sr-only">Best-wing {label} reference {bestValue}.</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function MetricsPanel({
  record,
  records,
  bestRecord,
  fixture
}: {
  record: WingRecord | null;
  records: readonly WingRecord[];
  bestRecord: WingRecord | null;
  fixture: boolean;
}) {
  const domains = metricDomains(records);
  const efficiency = record ? efficiencyFor(record) : null;
  const bestEfficiency = bestRecord ? efficiencyFor(bestRecord) : null;
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
        <div className="coefficient-scale"><span>−{domains.cl.toFixed(3)}</span><span>0</span><span>+{domains.cl.toFixed(3)}</span></div>
        <MetricRow name="cl" label="Cl" value={record?.cl ?? null} bestValue={bestRecord?.cl ?? null} scale={domains.cl} signed />
        <MetricRow name="cd" label="Cd" value={record?.cd ?? null} bestValue={bestRecord?.cd ?? null} scale={domains.cd} signed />
        <MetricRow name="efficiency" label="Cl/Cd" value={efficiency} bestValue={bestEfficiency} scale={domains.efficiency} />
      </div>
      {bestRecord ? <p className="best-marker-legend"><span className="best-marker-key" aria-hidden="true" />Best Cl/Cd wing</p> : null}
      <p className="measurement-note"><Gauge size={15} aria-hidden="true" /> {fixture ? "Values are copied from one synthetic QA row; they are not live research results." : "Values are copied from one verified CFD database row."}</p>
    </section>
  );
}
