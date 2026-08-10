from __future__ import annotations

from typing import Final

SCHEMA_MANIFEST: Final = "snapshot-manifest-v1"
SCHEMA_DATASET: Final = "wing-dataset-v1"
SCHEMA_REGISTRY: Final = "wandb-run-registry-v1"

DEFAULT_ENTITY: Final = "edenunu-technion-israel-institute-of-technology"
DEFAULT_PROJECT: Final = "wing parameter test"

PARAMETER_ORDER: Final[tuple[str, ...]] = (
    "r_le",
    "x_c",
    "y_c",
    "k_c",
    "y_t",
    "x_t",
    "beta_te",
    "k_t",
    "gamma_le",
    "alpha_te",
)

PARAMETER_BOUNDS: Final[dict[str, tuple[float, float]]] = {
    "r_le": (-0.08, -0.0005),
    "x_c": (0.25, 0.75),
    "y_c": (0.003, 0.09),
    "k_c": (-2.2, -0.01),
    "y_t": (0.03, 0.18),
    "x_t": (0.08, 0.50),
    "beta_te": (0.005, 0.50),
    "k_t": (-1.2, -0.1),
    "gamma_le": (0.01, 0.50),
    "alpha_te": (0.005, 0.90),
}

BASELINE_PARAMETERS: Final[dict[str, float]] = {
    "r_le": -0.016146018916033678,
    "x_c": 0.42463735413258963,
    "y_c": 0.02038049164704984,
    "k_c": -0.21172827316723572,
    "y_t": 0.06012113069431794,
    "x_t": 0.2989015826574153,
    "beta_te": 0.1373828669255089,
    "k_t": -0.514126765787434,
    "gamma_le": 0.0725896568547561,
    "alpha_te": 0.4022178081503657,
}
BASELINE_VECTOR: Final[tuple[float, ...]] = tuple(
    BASELINE_PARAMETERS[name] for name in PARAMETER_ORDER
)

ACTION_KEYS: Final[dict[str, str]] = {
    name: f"action/{name}" for name in PARAMETER_ORDER
}

TIMESTAMP_KEY: Final = "_timestamp"
AERO_CL_KEY: Final = "aero/step_avg_Cl"
AERO_CD_KEY: Final = "aero/step_avg_Cd"
CURVATURE_KEY: Final = "geometry/step_curvature_ratio"
INVALID_GEOMETRY_KEY: Final = "status/invalid_geometry"
FREQUENCY_1_KEY: Final = "spod/mode1_peak_freq_1"
FREQUENCY_2_KEY: Final = "spod/mode1_peak_freq_2"

ALLOWED_HISTORY_KEYS: Final[tuple[str, ...]] = (
    "_step",
    TIMESTAMP_KEY,
    *(ACTION_KEYS[name] for name in PARAMETER_ORDER),
    AERO_CL_KEY,
    AERO_CD_KEY,
    CURVATURE_KEY,
    INVALID_GEOMETRY_KEY,
    FREQUENCY_1_KEY,
    FREQUENCY_2_KEY,
)

REJECTION_REASON_ORDER: Final[tuple[str, ...]] = (
    "RUN_NOT_FINISHED",
    "RUN_NOT_APPROVED",
    "UNKNOWN_ACTION_SCHEMA",
    "NONFINITE_ACTION",
    "ACTION_OUT_OF_BOUNDS",
    "MISSING_AERO",
    "NONFINITE_AERO",
    "INVALID_GEOMETRY",
    "MISSING_VALIDITY",
    "MISSING_CURVATURE",
    "CURVATURE_LIMIT",
    "MISSING_FREQUENCY",
    "NONPOSITIVE_FREQUENCY",
)

MAX_PUBLIC_FILE_BYTES: Final = 10 * 1024 * 1024
DEFAULT_TARGET_SHARD_BYTES: Final = 9 * 1024 * 1024
