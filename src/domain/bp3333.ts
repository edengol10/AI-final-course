import type { ParameterVector } from "./parameters";

export interface Point {
  x: number;
  y: number;
}

interface ControlPoint {
  x: number;
  y: number;
}

const cot = (value: number) => Math.cos(value) / Math.sin(value);

function bezier(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const inverse = 1 - t;
  return p0 * inverse ** 3 + 3 * p1 * t * inverse ** 2 + 3 * p2 * t ** 2 * inverse + p3 * t ** 3;
}

function calculateRt(parameters: ParameterVector): number {
  const { k_t: curvature, x_t: x, y_t: y, r_le: radius } = parameters;
  const lower = Math.max(0, x - Math.sqrt((-2 * y) / (3 * curvature)));
  const upper = x;
  const coefficients = {
    a4: (27 * curvature ** 2) / 4,
    a3: -27 * curvature ** 2 * x,
    a2: 9 * curvature * y + (81 * curvature ** 2 * x ** 2) / 2,
    a1: 2 * radius - 18 * curvature * x * y - 27 * curvature ** 2 * x ** 3,
    a0: 3 * y ** 2 + 9 * curvature * x ** 2 * y + (27 * curvature ** 2 * x ** 4) / 4
  };

  let result = (lower + upper) / 2;
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const value = coefficients.a4 * result ** 4 + coefficients.a3 * result ** 3 + coefficients.a2 * result ** 2 + coefficients.a1 * result + coefficients.a0;
    if (Math.abs(value) < 1e-6) break;
    const gradient = 4 * coefficients.a4 * result ** 3 + 3 * coefficients.a3 * result ** 2 + 2 * coefficients.a2 * result + coefficients.a1;
    if (Math.abs(gradient) < 1e-12) break;
    const step = value / gradient;
    result = Math.min(upper, Math.max(lower, result - step));
    if (Math.abs(step) < 1e-6) break;
  }
  return result;
}

function calculateRc(parameters: ParameterVector): number {
  const { k_c, gamma_le, alpha_te, y_c } = parameters;
  const zTe = 0;
  const cotGamma = cot(gamma_le);
  const cotAlpha = cot(alpha_te);
  const combined = cotGamma + cotAlpha;
  const t1 = 3 * k_c * combined ** 2;
  const t2 = 16 + 3 * k_c * combined * (1 + zTe * cotAlpha);
  const radicand = 16 + 6 * k_c * combined * (1 - y_c * combined + zTe * cotAlpha);
  const t3 = 4 * Math.sqrt(Math.max(0, radicand));
  const candidateA = (t2 + t3) / t1;
  const candidateB = (t2 - t3) / t1;
  return candidateA > 0 && candidateA < y_c ? candidateA : candidateB;
}

function buildCurves(parameters: ParameterVector, sampleCount: number): { thickness: Point[]; camber: Point[] } {
  const pointCount = sampleCount - 2;
  const halfCount = Math.floor(pointCount / 2) + 1;
  const rt = calculateRt(parameters);
  const rc = calculateRc(parameters);
  const dzTe = 1e-7;
  const zTe = 0;

  const thicknessStart: [ControlPoint, ControlPoint, ControlPoint, ControlPoint] = [
    { x: 0, y: 0 },
    { x: 0, y: (3 * parameters.k_t * (parameters.x_t - rt) ** 2) / 2 + parameters.y_t },
    { x: rt, y: parameters.y_t },
    { x: parameters.x_t, y: parameters.y_t }
  ];
  const thicknessEnd: [ControlPoint, ControlPoint, ControlPoint, ControlPoint] = [
    { x: parameters.x_t, y: parameters.y_t },
    { x: 2 * parameters.x_t - rt, y: parameters.y_t },
    {
      x: 1 + (dzTe - ((3 * parameters.k_t * (parameters.x_t - rt) ** 2) / 2 + parameters.y_t)) * cot(parameters.beta_te),
      y: (3 * parameters.k_t * (parameters.x_t - rt) ** 2) / 2 + parameters.y_t
    },
    { x: 1, y: dzTe }
  ];
  const camberStart: [ControlPoint, ControlPoint, ControlPoint, ControlPoint] = [
    { x: 0, y: 0 },
    { x: rc * cot(parameters.gamma_le), y: rc },
    { x: parameters.x_c - Math.sqrt((2 * (rc - parameters.y_c)) / (3 * parameters.k_c)), y: parameters.y_c },
    { x: parameters.x_c, y: parameters.y_c }
  ];
  const camberEnd: [ControlPoint, ControlPoint, ControlPoint, ControlPoint] = [
    { x: parameters.x_c, y: parameters.y_c },
    { x: parameters.x_c + Math.sqrt((2 * (rc - parameters.y_c)) / (3 * parameters.k_c)), y: parameters.y_c },
    { x: 1 + (zTe - rc) * cot(parameters.alpha_te), y: rc },
    { x: 1, y: zTe }
  ];

  const makeSegment = (controls: [ControlPoint, ControlPoint, ControlPoint, ControlPoint], kind: "leading" | "trailing") =>
    Array.from({ length: halfCount }, (_, index) => {
      const phase = (index * Math.PI) / (2 * (halfCount - 1));
      const t = kind === "leading" ? 1 - Math.cos(phase) : Math.sin(phase);
      return {
        x: bezier(controls[0].x, controls[1].x, controls[2].x, controls[3].x, t),
        y: bezier(controls[0].y, controls[1].y, controls[2].y, controls[3].y, t)
      };
    });

  return {
    thickness: [...makeSegment(thicknessStart, "leading"), ...makeSegment(thicknessEnd, "trailing").slice(1)],
    camber: [...makeSegment(camberStart, "leading"), ...makeSegment(camberEnd, "trailing").slice(1)]
  };
}

function splineInterpolate(points: Point[], xQueries: number[]): number[] {
  const sorted = [...points].sort((first, second) => first.x - second.x);
  const length = sorted.length;
  const h = Array.from({ length: length - 1 }, (_, index) => sorted[index + 1]!.x - sorted[index]!.x);
  const delta = h.map((width, index) => (sorted[index + 1]!.y - sorted[index]!.y) / width);
  const a = Array<number>(length).fill(0);
  const b = Array<number>(length).fill(0);
  const c = Array<number>(length).fill(0);
  const d = Array<number>(length).fill(0);
  b[0] = 1;
  b[length - 1] = 1;
  for (let index = 1; index < length - 1; index += 1) {
    if (index >= 2) a[index] = 1.5 * h[index - 2]!;
    b[index] = 2 * (h[index - 1]! + h[index]!);
    c[index] = 1.5 * h[index]!;
    d[index] = 3 * (delta[index]! - delta[index - 1]!);
  }
  for (let index = 2; index < length; index += 1) {
    const multiplier = a[index]! / b[index - 1]!;
    b[index] = b[index]! - multiplier * c[index - 1]!;
    d[index] = d[index]! - multiplier * d[index - 1]!;
  }
  const second = Array<number>(length).fill(0);
  second[length - 1] = d[length - 1]! / b[length - 1]!;
  for (let index = length - 2; index > 0; index -= 1) {
    second[index] = (d[index]! - c[index]! * second[index + 1]!) / b[index]!;
  }

  return xQueries.map((query) => {
    if (query <= sorted[0]!.x) return sorted[0]!.y;
    if (query >= sorted[length - 1]!.x) return sorted[length - 1]!.y;
    let index = 1;
    while (index < length && query >= sorted[index]!.x) index += 1;
    const width = h[index - 1]!;
    const offset = query - sorted[index - 1]!.x;
    return (
      (second[index - 1]! * (width - offset) ** 3 + second[index]! * offset ** 3) / (6 * width) +
      (sorted[index - 1]!.y * (width - offset) + sorted[index]!.y * offset) / width -
      (second[index - 1]! * (width - offset) + second[index]! * offset) * width / 6
    );
  });
}

/** Builds the canonical 253-point, chord-normalized BP3333 surface. */
export function buildBp3333(parameters: ParameterVector, sampleCount = 129): Point[] {
  if (sampleCount < 6) throw new Error("BP3333 wings require at least 6 sample points.");
  if (parameters.k_t >= 0 || parameters.k_c >= 0) throw new Error("BP3333 curvature parameters must be negative.");
  const { thickness, camber } = buildCurves(parameters, sampleCount);
  const interpolatedThickness = splineInterpolate(thickness, camber.map((point) => point.x));
  const theta = camber.map((point, index) => {
    const next = camber[Math.min(index + 1, camber.length - 1)]!;
    return Math.atan2(next.y - point.y, next.x - point.x);
  });
  const lower = camber.map((point, index) => ({
    x: point.x - interpolatedThickness[index]! * Math.sin(theta[index]!),
    y: point.y - interpolatedThickness[index]! * Math.cos(theta[index]!)
  })).reverse();
  const upper = camber.map((point, index) => ({
    x: point.x + interpolatedThickness[index]! * Math.sin(theta[index]!),
    y: point.y + interpolatedThickness[index]! * Math.cos(theta[index]!)
  })).slice(1);
  const surface = [...lower, ...upper];
  if (surface.length !== 2 * sampleCount - 5 || surface.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    throw new Error("BP3333 produced an invalid surface.");
  }
  return surface;
}

/** Standard closed-trailing-edge NACA 2412 reference in matching point order. */
export function buildNaca2412(pointCount = 127): Point[] {
  const upper: Point[] = [];
  const lower: Point[] = [];
  for (let index = 0; index < pointCount; index += 1) {
    const x = (1 - Math.cos((Math.PI * index) / (pointCount - 1))) / 2;
    const yt = 5 * 0.12 * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x ** 2 + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    const yc = x < 0.4 ? (0.02 / 0.4 ** 2) * (2 * 0.4 * x - x ** 2) : (0.02 / 0.6 ** 2) * ((1 - 0.8) + 0.8 * x - x ** 2);
    const slope = x < 0.4 ? (2 * 0.02 / 0.4 ** 2) * (0.4 - x) : (2 * 0.02 / 0.6 ** 2) * (0.4 - x);
    const angle = Math.atan(slope);
    upper.push({ x: x - yt * Math.sin(angle), y: yc + yt * Math.cos(angle) });
    lower.push({ x: x + yt * Math.sin(angle), y: yc - yt * Math.cos(angle) });
  }
  return [...lower.reverse(), ...upper.slice(1)];
}

export function pointsToPath(points: readonly Point[]): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(6)},${(-point.y).toFixed(6)}`).join(" ");
}
