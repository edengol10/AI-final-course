# Data contract and checks

The authoritative BP3333 order is `r_le`, `x_c`, `y_c`, `k_c`, `y_t`, `x_t`, `beta_te`, `k_t`, `gamma_le`, `alpha_te`. Reconstruct every vector from the pinned NACA2412 baseline plus absolute actions.

Admission order: run state, registry approval, action schema, finite/bounded actions, finite `Cl`/`Cd`, valid geometry, and curvature below one. Keep the first rejection reason for each excluded row.

Compatibility identity contains baseline, angle of attack, CFD averaging window, and solver revision. Unknown settings create isolated groups. Nearest-neighbor distance is Euclidean over active dimensions, normalized by authoritative parameter bounds, with stable-record-index tie breaking.
