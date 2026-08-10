import * as Slider from "@radix-ui/react-slider";
import type { CSSProperties } from "react";
import { formatParameter, type ParameterDefinition } from "../domain/parameters";

interface ParameterSliderProps {
  definition: ParameterDefinition;
  minimum: number;
  maximum: number;
  displayValue: number;
  measuredValue: number;
  requestedValue?: number;
  snapping: boolean;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}

function percent(value: number, minimum: number, maximum: number): number {
  return ((value - minimum) / (maximum - minimum)) * 100;
}

export function ParameterSlider({
  definition,
  minimum,
  maximum,
  displayValue,
  measuredValue,
  requestedValue,
  snapping,
  onChange,
  onCommit
}: ParameterSliderProps) {
  const requestedDiffers = requestedValue !== undefined && Math.abs(requestedValue - measuredValue) > (maximum - minimum) * 1e-8;
  const markerStyle = { "--marker-position": `${percent(measuredValue, minimum, maximum)}%` } as CSSProperties;
  const ghostStyle = { "--marker-position": `${percent(requestedValue ?? measuredValue, minimum, maximum)}%` } as CSSProperties;
  const step = (maximum - minimum) / 1000;

  return (
    <div className={`parameter-control${snapping ? " is-snapping" : ""}`}>
      <div className="parameter-heading">
        <label id={`parameter-${definition.name}`} htmlFor={`slider-${definition.name}`}>
          <span className="parameter-symbol" aria-hidden="true">{definition.symbol}</span>
          <span>{definition.label}</span>
        </label>
        <span className="parameter-readout">
          <strong>{formatParameter(measuredValue)}</strong>
          {requestedDiffers ? <small>requested {formatParameter(requestedValue)}</small> : null}
        </span>
      </div>
      <div className="slider-wrap">
        <Slider.Root
          className="slider-root"
          id={`slider-${definition.name}`}
          min={minimum}
          max={maximum}
          step={step}
          value={[displayValue]}
          onValueChange={(values) => onChange(values[0] ?? displayValue)}
          onValueCommit={(values) => onCommit(values[0] ?? displayValue)}
          aria-labelledby={`parameter-${definition.name}`}
        >
          <Slider.Track className="slider-track">
            <Slider.Range className="slider-range" />
          </Slider.Track>
          <span className="candidate-marker" style={markerStyle} aria-hidden="true" />
          {requestedDiffers ? (
            <span
              className="requested-marker"
              style={ghostStyle}
              aria-hidden="true"
              data-testid={`requested-marker-${definition.name}`}
            />
          ) : null}
          <Slider.Thumb
            className="slider-thumb"
            aria-label={`${definition.label} requested value`}
            aria-valuetext={`${formatParameter(displayValue)}; selected database-row value ${formatParameter(measuredValue)}`}
          />
        </Slider.Root>
      </div>
      <div className="slider-bounds" aria-hidden="true"><span>{formatParameter(minimum)}</span><span>{formatParameter(maximum)}</span></div>
    </div>
  );
}
