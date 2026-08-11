import { useId, useMemo } from "react";
import { buildBp3333, pointsToPath } from "../domain/bp3333";
import { BASELINE_PARAMETERS, PARAMETER_ORDER, type ParameterVector } from "../domain/parameters";
import type { WingRecord } from "../domain/schema";

interface WingPlotProps {
  displayParameters: ParameterVector;
  record: WingRecord | null;
  fixture: boolean;
}

const referencePath = pointsToPath(buildBp3333(BASELINE_PARAMETERS));

export function WingPlot({ displayParameters, record, fixture }: WingPlotProps) {
  const titleId = useId();
  const descriptionId = useId();
  const isReferenceGeometry = PARAMETER_ORDER.every(
    (parameter) => Math.fround(displayParameters[parameter]) === Math.fround(BASELINE_PARAMETERS[parameter])
  );
  const selectedPath = useMemo(
    () => isReferenceGeometry ? referencePath : pointsToPath(record?.coordinates ?? buildBp3333(displayParameters)),
    [displayParameters, isReferenceGeometry, record]
  );
  const selectedSource = record
    ? `Run ${record.provenance.runId} · Step ${record.provenance.globalStep.toLocaleString()}`
    : "Reference definition · no measured run/step";

  return (
    <section className="card wing-card" aria-labelledby={titleId}>
      <div className="card-heading-row">
        <div>
          <p className="eyebrow">{record ? (fixture ? "Synthetic fixture candidate" : "Measured candidate") : "Unmeasured reference"}</p>
          <h2 id={titleId}>BP3333 geometry</h2>
          <p className="selected-source-label" data-testid="selected-source-label">{selectedSource}</p>
        </div>
        <span className="record-pill">{record ? `Row ${record.stableRecordIndex}` : "Reference only"}</span>
      </div>
      <div className="wing-plot-frame">
        <svg
          className="wing-plot"
          viewBox="-0.05 -0.22 1.10 0.44"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-labelledby={`${titleId} ${descriptionId}`}
          data-testid="wing-plot"
        >
          <desc id={descriptionId}>Chord-normalized BP3333 airfoil compared with a NACA 2412 reference. Horizontal and vertical axes use the same scale.</desc>
          <g className="plot-grid" aria-hidden="true">
            <line x1="0" y1="-0.2" x2="0" y2="0.2" />
            <line x1="0.25" y1="-0.2" x2="0.25" y2="0.2" />
            <line x1="0.5" y1="-0.2" x2="0.5" y2="0.2" />
            <line x1="0.75" y1="-0.2" x2="0.75" y2="0.2" />
            <line x1="1" y1="-0.2" x2="1" y2="0.2" />
            <line className="zero-grid" x1="-0.04" y1="0" x2="1.04" y2="0" />
          </g>
          <path className="reference-wing" d={referencePath} data-testid="reference-wing-path" vectorEffect="non-scaling-stroke" />
          <path
            className="selected-wing-halo"
            d={selectedPath}
            vectorEffect="non-scaling-stroke"
            aria-hidden="true"
          />
          <path
            className="selected-wing"
            d={selectedPath}
            data-testid="selected-wing-path"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div className="plot-footer">
        <span className="legend-item"><i className="legend-line selected" />{record ? "Selected BP3333" : "Selected NACA 2412"}</span>
        <span className="legend-item"><i className="legend-line reference" />NACA 2412 reference</span>
        <span className="axis-note">Equal x/y axes · chord = 1</span>
      </div>
    </section>
  );
}
