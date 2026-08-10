from __future__ import annotations

import math
import struct
from collections.abc import Mapping, Sequence

from .constants import PARAMETER_ORDER


def float32(value: float) -> float:
    """Round a value to IEEE-754 binary32 without a NumPy dependency."""

    return struct.unpack("<f", struct.pack("<f", float(value)))[0]


def float32_vector(values: Sequence[float]) -> tuple[float, ...]:
    return tuple(float32(value) for value in values)


def float32_vector_bytes(values: Sequence[float]) -> bytes:
    if len(values) != len(PARAMETER_ORDER):
        raise ValueError(f"expected {len(PARAMETER_ORDER)} BP3333 parameters")
    return struct.pack(f"<{len(values)}f", *(float(value) for value in values))


def _bezier(p0: float, p1: float, p2: float, p3: float, t: float) -> float:
    one_minus_t = 1.0 - t
    return (
        p0 * one_minus_t**3
        + 3.0 * p1 * t * one_minus_t**2
        + 3.0 * p2 * t**2 * one_minus_t
        + p3 * t**3
    )


def _rt_polynomial(rt: float, k_t: float, x_t: float, y_t: float, r_le: float) -> float:
    return (
        27.0 * k_t**2 * rt**4 / 4.0
        - 27.0 * k_t**2 * x_t * rt**3
        + (9.0 * k_t * y_t + 81.0 * k_t**2 * x_t**2 / 2.0) * rt**2
        + (2.0 * r_le - 18.0 * k_t * x_t * y_t - 27.0 * k_t**2 * x_t**3) * rt
        + (3.0 * y_t**2 + 9.0 * k_t * x_t**2 * y_t + 27.0 * k_t**2 * x_t**4 / 4.0)
    )


def _rt_gradient(rt: float, k_t: float, x_t: float, y_t: float, r_le: float) -> float:
    return (
        27.0 * k_t**2 * rt**3
        - 81.0 * k_t**2 * x_t * rt**2
        + 2.0 * (9.0 * k_t * y_t + 81.0 * k_t**2 * x_t**2 / 2.0) * rt
        + 2.0 * r_le
        - 18.0 * k_t * x_t * y_t
        - 27.0 * k_t**2 * x_t**3
    )


def _calculate_rt(k_t: float, x_t: float, y_t: float, r_le: float) -> float:
    lower = max(0.0, x_t - math.sqrt(-2.0 * y_t / (3.0 * k_t)))
    upper = x_t
    rt = (lower + upper) / 2.0
    for _ in range(100):
        value = _rt_polynomial(rt, k_t, x_t, y_t, r_le)
        if abs(value) < 1.0e-6:
            break
        gradient = _rt_gradient(rt, k_t, x_t, y_t, r_le)
        if abs(gradient) < 1.0e-12:
            break
        step = value / gradient
        rt = min(upper, max(lower, rt - step))
        if abs(step) < 1.0e-6:
            break
    return rt


def _cot(value: float) -> float:
    return math.cos(value) / math.sin(value)


def _calculate_rc(k_c: float, gamma_le: float, alpha_te: float, y_c: float) -> float:
    cot_gamma = _cot(gamma_le)
    cot_alpha = _cot(alpha_te)
    combined = cot_gamma + cot_alpha
    t1 = 3.0 * k_c * combined**2
    t2 = 16.0 + 3.0 * k_c * combined
    radicand = 16.0 + 6.0 * k_c * combined * (1.0 - y_c * combined)
    if radicand < 0.0:
        raise ValueError("BP3333 camber construction has a negative radicand")
    t3 = 4.0 * math.sqrt(radicand)
    candidate_a = (t2 + t3) / t1
    candidate_b = (t2 - t3) / t1
    return candidate_a if 0.0 < candidate_a < y_c else candidate_b


def _curve(
    control: tuple[tuple[float, ...], ...], sample_count: int
) -> tuple[list[float], list[float]]:
    curve_length = sample_count - 2
    half = curve_length // 2 + 1
    indices = range(half)
    leading_t = [1.0 - math.cos(index * math.pi / (2.0 * (half - 1))) for index in indices]
    trailing_t = [math.sin(index * math.pi / (2.0 * (half - 1))) for index in indices]
    x = [_bezier(*(control[row][0] for row in range(4)), t) for t in leading_t]
    x.extend(_bezier(*(control[row][1] for row in range(4)), t) for t in trailing_t[1:])
    y = [_bezier(*(control[row][2] for row in range(4)), t) for t in leading_t]
    y.extend(_bezier(*(control[row][3] for row in range(4)), t) for t in trailing_t[1:])
    return x, y


def _spline(
    x_data: Sequence[float], y_data: Sequence[float], queries: Sequence[float]
) -> list[float]:
    ordered = sorted(zip(x_data, y_data, strict=True))
    x = [item[0] for item in ordered]
    y = [item[1] for item in ordered]
    count = len(x)
    h = [x[index + 1] - x[index] for index in range(count - 1)]
    delta = [(y[index + 1] - y[index]) / h[index] for index in range(count - 1)]
    a = [0.0] * count
    b = [0.0] * count
    c = [0.0] * count
    d = [0.0] * count
    for index in range(2, count):
        a[index] = 1.5 * h[index - 2]
    for index in range(1, count - 1):
        b[index] = 2.0 * (h[index - 1] + h[index])
        c[index] = 1.5 * h[index]
        d[index] = 3.0 * (delta[index] - delta[index - 1])
    b[0] = 1.0
    b[-1] = 1.0
    for index in range(2, count):
        multiplier = a[index] / b[index - 1]
        b[index] -= multiplier * c[index - 1]
        d[index] -= multiplier * d[index - 1]
    second = [0.0] * count
    second[-1] = d[-1] / b[-1]
    for index in range(count - 2, 0, -1):
        second[index] = (d[index] - c[index] * second[index + 1]) / b[index]
    result: list[float] = []
    for query in queries:
        if query <= x[0]:
            result.append(y[0])
            continue
        if query >= x[-1]:
            result.append(y[-1])
            continue
        interval = next(index for index in range(1, count) if query < x[index])
        xx = query - x[interval - 1]
        width = h[interval - 1]
        result.append(
            (
                second[interval - 1] * (width - xx) ** 3 + second[interval] * xx**3
            )
            / (6.0 * width)
            + (y[interval - 1] * (width - xx) + y[interval] * xx) / width
            - (
                second[interval - 1] * (width - xx) + second[interval] * xx
            )
            * width
            / 6.0
        )
    return result


def build_bp3333_coordinates(
    parameters: Mapping[str, float] | Sequence[float],
    *,
    num_points: int = 129,
) -> tuple[tuple[float, ...], tuple[float, ...]]:
    """Reconstruct chord-normalized 0° BP3333 coordinates from a full vector."""

    if num_points < 6:
        raise ValueError("BP3333 requires at least six sample points")
    if isinstance(parameters, Mapping):
        values = {name: float32(parameters[name]) for name in PARAMETER_ORDER}
    else:
        if len(parameters) != len(PARAMETER_ORDER):
            raise ValueError(f"expected {len(PARAMETER_ORDER)} parameters")
        values = {
            name: float32(value)
            for name, value in zip(PARAMETER_ORDER, parameters, strict=True)
        }
    r_le = values["r_le"]
    x_c = values["x_c"]
    y_c = values["y_c"]
    k_c = values["k_c"]
    y_t = values["y_t"]
    x_t = values["x_t"]
    beta_te = values["beta_te"]
    k_t = values["k_t"]
    gamma_le = values["gamma_le"]
    alpha_te = values["alpha_te"]
    if k_t >= 0.0 or k_c >= 0.0:
        raise ValueError("BP3333 k_t and k_c must be negative")
    rt = _calculate_rt(k_t, x_t, y_t, r_le)
    rc = _calculate_rc(k_c, gamma_le, alpha_te, y_c)
    dz_te = 1.0e-7
    thickness_control = (
        (0.0, x_t, 0.0, y_t),
        (0.0, 2.0 * x_t - rt, 3.0 * k_t * (x_t - rt) ** 2 / 2.0 + y_t, y_t),
        (
            rt,
            1.0 + (dz_te - (3.0 * k_t * (x_t - rt) ** 2 / 2.0 + y_t)) * _cot(beta_te),
            y_t,
            3.0 * k_t * (x_t - rt) ** 2 / 2.0 + y_t,
        ),
        (x_t, 1.0, y_t, dz_te),
    )
    camber_control = (
        (0.0, x_c, 0.0, y_c),
        (rc * _cot(gamma_le), x_c + math.sqrt(2.0 * (rc - y_c) / (3.0 * k_c)), rc, y_c),
        (x_c - math.sqrt(2.0 * (rc - y_c) / (3.0 * k_c)), 1.0 - rc * _cot(alpha_te), y_c, rc),
        (x_c, 1.0, y_c, 0.0),
    )
    thickness_x, thickness_y = _curve(thickness_control, num_points)
    camber_x, camber_y = _curve(camber_control, num_points)
    interpolated = _spline(thickness_x, thickness_y, camber_x)
    theta = [
        math.atan2(camber_y[index + 1] - camber_y[index], camber_x[index + 1] - camber_x[index])
        for index in range(len(camber_x) - 1)
    ]
    theta.append(0.0)
    lower_x = [
        camber_x[index] - interpolated[index] * math.sin(theta[index])
        for index in range(len(camber_x))
    ]
    lower_y = [
        camber_y[index] - interpolated[index] * math.cos(theta[index])
        for index in range(len(camber_x))
    ]
    upper_x = [
        camber_x[index] + interpolated[index] * math.sin(theta[index])
        for index in range(1, len(camber_x))
    ]
    upper_y = [
        camber_y[index] + interpolated[index] * math.cos(theta[index])
        for index in range(1, len(camber_x))
    ]
    x = list(reversed(lower_x)) + upper_x
    y = list(reversed(lower_y)) + upper_y
    return tuple(float32(value) for value in x), tuple(float32(value) for value in y)
