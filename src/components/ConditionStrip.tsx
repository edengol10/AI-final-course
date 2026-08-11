import { Crosshair, Fingerprint, Gauge, Grid3X3, Layers3, Ruler, TimerReset, Wind } from "lucide-react";
import type { WingDataset } from "../domain/schema";

type Compatibility = WingDataset["compatibilityGroup"];

interface ConditionStripProps {
  compatibility: Compatibility;
  bestAvailable: boolean;
  onSelectBest: () => void;
  onSelectReference: () => void;
}

interface ConditionItem {
  label: string;
  value: string;
  icon: typeof Gauge;
}

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function conditionItems(compatibility: Compatibility): ConditionItem[] {
  const items: Array<ConditionItem | null> = [
    compatibility.baseline === null ? null : { label: "Baseline definition", value: `Baseline ${compatibility.baseline}`, icon: Fingerprint },
    compatibility.reynoldsNumber === null ? null : { label: "Reynolds number", value: `Re ${formatNumber(compatibility.reynoldsNumber)}`, icon: Wind },
    compatibility.chordLatticeUnits === null ? null : { label: "Chord", value: `Chord ${formatNumber(compatibility.chordLatticeUnits)} LU`, icon: Ruler },
    compatibility.gridNx === null || compatibility.gridNy === null ? null : { label: "Grid", value: `Grid ${formatNumber(compatibility.gridNx)}×${formatNumber(compatibility.gridNy)}`, icon: Grid3X3 },
    compatibility.angleOfAttackDeg === null ? null : { label: "Angle of attack", value: `AoA ${formatNumber(compatibility.angleOfAttackDeg)}°`, icon: Crosshair },
    compatibility.averagingStartTu === null || compatibility.averagingEndTu === null ? null : {
      label: "Averaging window",
      value: `Averaging ${formatNumber(compatibility.averagingStartTu)}–${formatNumber(compatibility.averagingEndTu)} TU`,
      icon: TimerReset
    },
    compatibility.maximumInletVelocity === null ? null : { label: "Maximum inlet velocity", value: `Inlet max ${formatNumber(compatibility.maximumInletVelocity)}`, icon: Gauge },
    { label: "Run grouping", value: compatibility.isolated ? "Isolated run group" : "Merged compatible runs", icon: Layers3 }
  ];
  return items.filter((item): item is ConditionItem => item !== null);
}

export function ConditionStrip({ compatibility, bestAvailable, onSelectBest, onSelectReference }: ConditionStripProps) {
  const items = conditionItems(compatibility);
  const method = [compatibility.collisionModel, compatibility.immersedBoundaryScheme]
    .filter((value): value is string => value !== null)
    .map((value) => value.toUpperCase())
    .join(" · ");

  return (
    <section className="condition-strip" aria-label="Simulation conditions" data-testid="condition-strip">
      <dl className="condition-list">
        {items.map(({ label, value, icon: Icon }) => (
          <div key={label}>
            <Icon size={15} aria-hidden="true" />
            <dt className="sr-only">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        {method ? <div className="condition-method"><dt className="sr-only">Numerical method</dt><dd>{method}</dd></div> : null}
      </dl>
      <div className="navigation-actions" role="group" aria-label="Wing navigation">
        <button className="secondary-button" type="button" onClick={onSelectBest} disabled={!bestAvailable}>Go to best wing</button>
        <button className="secondary-button" type="button" onClick={onSelectReference}>Go to NACA 2412</button>
      </div>
    </section>
  );
}
