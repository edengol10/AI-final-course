# Skill comparison evaluation

Both files answer the same prompt prospectively. The unskilled answer was frozen before the skill or its reference was opened; the skilled answer was written after reading both completely. Scores use a 0–5 scale, where 5 is implementation-ready and faithful to the scientific/publication contract.

| Criterion | Unskilled | Skilled | Evidence-based assessment |
|---|---:|---:|---|
| Secret exposure | 4 | 5 | Both keep credentials out of the browser and sanitize provenance. The skilled response adds the exact narrow W&B history boundary and explicitly excludes artifacts, summaries/configs, telemetry, episode aggregates, and undeclared fields. |
| Correct per-wing keys | 2 | 5 | The unskilled response says “needed columns” but never names the authoritative keys or distinguishes per-wing values from episode averages. The skilled response pins `aero/step_avg_Cl`, `aero/step_avg_Cd`, and the first two ranked peaks of SPOD mode 1. |
| Invalid-row rejection | 3 | 5 | The unskilled response proposes reasonable checks, but omits the exact primary-reason precedence and several stable codes. The skilled response gives all required conditions and reason codes in contract order. |
| Physical grouping | 3 | 5 | The unskilled response includes sensible dimensions, but invents “objective” and “data schema” as grouping axes and does not require unknown values to form isolated groups. The skilled response uses the exact five compatibility dimensions and run-isolates unknowns. |
| Provenance | 4 | 5 | Both select minimal provenance. The skilled response fixes it to run ID, global step, and sanitized recorded time and ties every displayed metric tuple to one admitted representative. |
| Reproducibility | 3 | 5 | The unskilled answer proposes deterministic output but uses observed ranges for nearest normalization and does not specify the representative ordering. The skilled response uses authoritative bounds, exact float32 bytes, the timestamp/step/run-ID ordering, stable-index tie-breaking, manifest-last publication, and deterministic fixture replay. |
| **Total** | **19/30** | **30/30** | The unskilled design is credible and security-conscious, but lacks the domain contract needed to prevent subtle scientific errors. The skill converts broad good practice into testable rules. |

## Material changes caused by the skill

The largest correction is nearest-neighbor normalization: the unskilled design used each group's observed range, which would make the same query select a different wing merely because the snapshot's sample coverage changed. The contract requires the fixed authoritative BP3333 bounds. The skill also corrected frequency interpretation, made rejection accounting ordered and stable, defined unknown-compatibility isolation, and supplied the deterministic replicate representative ordering. These are substantive scientific-validity improvements rather than stylistic differences.
