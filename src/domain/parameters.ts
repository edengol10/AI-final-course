export const PARAMETER_ORDER = [
  "r_le",
  "x_c",
  "y_c",
  "k_c",
  "y_t",
  "x_t",
  "beta_te",
  "k_t",
  "gamma_le",
  "alpha_te"
] as const;

export type ParameterName = (typeof PARAMETER_ORDER)[number];
export type ParameterVector = Record<ParameterName, number>;

export interface ParameterDefinition {
  name: ParameterName;
  label: string;
  symbol: string;
  minimum: number;
  maximum: number;
  baseline: number;
}

export const PARAMETER_DEFINITIONS: readonly ParameterDefinition[] = [
  { name: "r_le", label: "Leading-edge radius", symbol: "rₗₑ", minimum: -0.08, maximum: -0.0005, baseline: -0.016146018916033678 },
  { name: "x_c", label: "Camber position", symbol: "xᶜ", minimum: 0.25, maximum: 0.75, baseline: 0.42463735413258963 },
  { name: "y_c", label: "Maximum camber", symbol: "yᶜ", minimum: 0.003, maximum: 0.09, baseline: 0.02038049164704984 },
  { name: "k_c", label: "Camber curvature", symbol: "κᶜ", minimum: -2.2, maximum: -0.01, baseline: -0.21172827316723572 },
  { name: "y_t", label: "Maximum thickness", symbol: "yᵗ", minimum: 0.03, maximum: 0.18, baseline: 0.06012113069431794 },
  { name: "x_t", label: "Thickness position", symbol: "xᵗ", minimum: 0.08, maximum: 0.5, baseline: 0.2989015826574153 },
  { name: "beta_te", label: "Trailing-edge thickness angle", symbol: "βₜₑ", minimum: 0.005, maximum: 0.5, baseline: 0.1373828669255089 },
  { name: "k_t", label: "Thickness curvature", symbol: "κᵗ", minimum: -1.2, maximum: -0.1, baseline: -0.514126765787434 },
  { name: "gamma_le", label: "Leading-edge camber angle", symbol: "γₗₑ", minimum: 0.01, maximum: 0.5, baseline: 0.0725896568547561 },
  { name: "alpha_te", label: "Trailing-edge camber angle", symbol: "αₜₑ", minimum: 0.005, maximum: 0.9, baseline: 0.4022178081503657 }
] as const;

export const PARAMETER_BY_NAME = Object.fromEntries(
  PARAMETER_DEFINITIONS.map((definition) => [definition.name, definition])
) as Record<ParameterName, ParameterDefinition>;

export const BASELINE_PARAMETERS = Object.fromEntries(
  PARAMETER_DEFINITIONS.map((definition) => [definition.name, definition.baseline])
) as ParameterVector;

export function isParameterName(value: string): value is ParameterName {
  return (PARAMETER_ORDER as readonly string[]).includes(value);
}

export function clampParameter(name: ParameterName, value: number): number {
  const definition = PARAMETER_BY_NAME[name];
  return Math.min(definition.maximum, Math.max(definition.minimum, value));
}

export function formatParameter(value: number): string {
  const magnitude = Math.abs(value);
  if (magnitude !== 0 && magnitude < 0.001) return value.toExponential(2);
  return value.toFixed(magnitude < 0.1 ? 4 : 3);
}
