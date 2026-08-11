# Condition Groups and Efficiency Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the five physically compatible reviewed runs, expose their audited conditions, and add exact best-wing/reference navigation with `Cl/Cd`, green comparison markers, and prominent run/step provenance before deploying the verified result to GitHub Pages.

**Architecture:** Extend the registry-owned compatibility fingerprint and serialize it through the existing Pydantic/Zod contracts so compatible history rows naturally enter one dataset group. Add pure TypeScript efficiency/reference selectors, then keep React responsible only for coordinated view state and accessible presentation. Publish only after fixture and live exporters, frontend checks, browser inspection, privacy scans, and thesis-repository invariants pass.

**Tech Stack:** Python 3.12, Pydantic 2, PyYAML, W&B Public API, React 19, TypeScript 5.8, Vite 7, Zod 3, Radix Slider, Framer Motion, Vitest, Testing Library, Playwright, GitHub Actions, GitHub Pages.

## Global Constraints

- Modify only `AI-final-course`; `/Users/edengolan/aero_shape_optimization` remains strictly read-only and must retain branch `drl-setting`, HEAD `4936dea753e11e54f25532820a7ac576f7f84401`, and clean status.
- Public data remains limited to BP3333 parameters, `Cl`, `Cd`, audited condition metadata, and minimal run/step provenance.
- Merge runs only when every required physical-condition field matches exactly; unknown conditions isolate the run.
- The audited condition strip is `Re 3,000 · Grid 900×210 · AoA 7° · Averaging 30–60 TU`.
- Preserve every admitted positive-lift history iteration; do not collapse selectable rows by geometry.
- Define the best wing only inside the selected compatibility group as maximum finite `Cl / Cd` among records with `Cl > 0` and `Cd > 0`.
- Every green marker represents that same best record.
- Never interpolate or borrow aerodynamic values; exact reference geometry without an exact measured row has unavailable metrics/provenance.
- Preserve the two unrelated untracked duplicate fixture files and never stage them.
- Follow red-green-refactor TDD and make focused commits after independently passing tasks.

---

## File map

- `config/wandb-runs.yaml`: audited condition fingerprint for reviewed and candidate runs.
- `pipeline/airfoil_exporter/models.py`: Python registry and public condition contracts.
- `pipeline/airfoil_exporter/registry.py`: canonical condition hashing, labels, and signatures.
- `tests/python/test_contracts_and_registry.py`: merge/isolation and public-contract tests.
- `tests/python/test_exporter.py`: merged-row/count serialization coverage.
- `public/data/`: deterministic synthetic snapshot regenerated from the narrow fixture.
- `src/domain/schema.ts`: Zod condition schema and browser types.
- `src/domain/efficiency.ts`: pure efficiency, scale, tie-break, and exact-reference selection.
- `src/domain/efficiency.test.ts`: focused domain tests.
- `src/components/ConditionStrip.tsx`: compact audited-condition display.
- `src/components/MetricsPanel.tsx`: stable group scales, `Cl/Cd`, and best-record markers.
- `src/components/ParameterSlider.tsx`: best-record marker on each active slider.
- `src/components/WingPlot.tsx`: selected/reference geometry and prominent run/step label.
- `src/components/ProvenancePanel.tsx`: measured/reference provenance states.
- `src/App.tsx`: coordinated measured/reference state and exact navigation actions.
- `src/App.test.tsx`: application-level row consistency and button behavior.
- `src/styles.css`: responsive, dark-mode, focus, and marker styling.
- `e2e/dashboard.e2e.ts`: pointer, keyboard, navigation, layout, and accessibility acceptance.
- `docs/ai-evidence/work-log.md`: prompt, corrections, diff, validation, and time-saved evidence.

---

### Task 1: Audited physical-condition grouping

**Files:**
- Modify: `config/wandb-runs.yaml`
- Modify: `pipeline/airfoil_exporter/models.py`
- Modify: `pipeline/airfoil_exporter/registry.py`
- Modify: `tests/python/test_contracts_and_registry.py`
- Modify: `tests/python/test_exporter.py`

**Interfaces:**
- Produces: `CompatibilitySpec` with `baseline`, `reynolds_number`, `chord_lattice_units`, `grid_nx`, `grid_ny`, `angle_of_attack_deg`, `averaging_start_tu`, `averaging_end_tu`, `maximum_inlet_velocity`, `collision_model`, and `immersed_boundary_scheme`.
- Produces: `compatibility_group_id(run) -> str`, `compatibility_signature(spec) -> tuple[object, ...]`, and `public_compatibility_group(run) -> PublicCompatibilityGroup` using exactly those fields.
- Consumes: the five reviewed run IDs and the existing registry loading/serialization path.

- [ ] **Step 1: Replace the old isolation test with failing exact-fingerprint tests**

Add tests that assert the five reviewed runs share one group ID and that changing each condition individually changes the ID:

```python
def test_reviewed_runs_share_the_audited_physical_group() -> None:
    registry = load_registry(ROOT / "config/wandb-runs.yaml")
    ids = {compatibility_group_id(run) for run in registry.reviewed_runs}
    assert len(ids) == 1
    assert not registry.reviewed_runs[0].compatibility.has_unknowns


@pytest.mark.parametrize(
    ("field", "different"),
    [
        ("reynolds_number", 4000.0),
        ("grid_nx", 901),
        ("grid_ny", 211),
        ("angle_of_attack_deg", 8.0),
        ("averaging_start_tu", 31.0),
        ("averaging_end_tu", 61.0),
        ("collision_model", "bgk"),
        ("immersed_boundary_scheme", "ib2"),
    ],
)
def test_each_physical_difference_prevents_merging(field: str, different: object) -> None:
    run = load_registry(ROOT / "config/wandb-runs.yaml").reviewed_runs[0]
    changed = run.model_copy(
        update={"compatibility": run.compatibility.model_copy(update={field: different})}
    )
    assert compatibility_group_id(changed) != compatibility_group_id(run)
```

Add a test that a candidate with unknown fields remains isolated by run ID and an exporter test that all admitted fixture records from the five reviewed runs appear in one dataset descriptor.

- [ ] **Step 2: Run the focused Python tests and verify red**

Run:

```bash
.venv/bin/pytest tests/python/test_contracts_and_registry.py tests/python/test_exporter.py -q
```

Expected: failures because the new condition fields are absent and reviewed runs still have separate group IDs.

- [ ] **Step 3: Implement the complete Python condition contract**

Replace the old string window/revision model with explicit finite numeric and normalized identifier fields. Implement `has_unknowns` over every required field. Validate positive Reynolds, chord/grid dimensions, averaging order, and inlet velocity.

Use this reviewed registry mapping for all five runs:

```yaml
compatibility: &reviewedCompatibility
  baseline: naca2412-bp3333
  reynoldsNumber: 3000.0
  chordLatticeUnits: 150
  gridNx: 900
  gridNy: 210
  angleOfAttackDeg: 7.0
  averagingStartTu: 30.0
  averagingEndTu: 60.0
  maximumInletVelocity: 0.08
  collisionModel: mrt
  immersedBoundaryScheme: ib1
```

Candidates receive explicit `null` values and remain isolated. Build the public label and description from contract fields; do not access W&B config in the exporter.

- [ ] **Step 4: Run focused Python tests and verify green**

Run:

```bash
.venv/bin/pytest tests/python/test_contracts_and_registry.py tests/python/test_exporter.py -q
```

Expected: all selected tests pass and fixture output logically forms one compatibility group.

- [ ] **Step 5: Run the full Python suite**

Run:

```bash
.venv/bin/pytest tests/python -q
.venv/bin/ruff check pipeline tests/python scripts
```

Expected: all tests pass and Ruff reports no errors.

- [ ] **Step 6: Commit the grouping contract**

```bash
git add config/wandb-runs.yaml pipeline/airfoil_exporter/models.py pipeline/airfoil_exporter/registry.py tests/python/test_contracts_and_registry.py tests/python/test_exporter.py
git commit -m "feat: merge runs by audited physical conditions"
```

---

### Task 2: Regenerate and validate the merged public contract

**Files:**
- Modify: `public/data/manifest.json`
- Replace generated files: `public/data/datasets/*.json`
- Modify: `src/domain/schema.ts`
- Modify: `src/domain/schema.test.ts`
- Modify: `src/data/snapshot.test.ts`

**Interfaces:**
- Consumes: Python `PublicCompatibilityGroup` aliases from Task 1.
- Produces: `CompatibilityGroupSchema` and `DatasetGroup.compatibility` with matching camel-case fields.

- [ ] **Step 1: Add failing Zod contract assertions**

Parse the fixture snapshot and assert:

```ts
expect(snapshot.compatibilityGroup).toMatchObject({
  reynoldsNumber: 3000,
  chordLatticeUnits: 150,
  gridNx: 900,
  gridNy: 210,
  angleOfAttackDeg: 7,
  averagingStartTu: 30,
  averagingEndTu: 60,
  maximumInletVelocity: 0.08,
  collisionModel: "mrt",
  immersedBoundaryScheme: "ib1",
  isolated: false
});
```

Add rejection assertions for an omitted required field and for `averagingStartTu > averagingEndTu`.

- [ ] **Step 2: Run schema tests and verify red**

Run:

```bash
npx vitest run src/domain/schema.test.ts src/data/snapshot.test.ts
```

Expected: failures from the old compatibility schema and old fixture.

- [ ] **Step 3: Update Zod and regenerate the deterministic fixture**

Mirror the Python names and constraints in `CompatibilityGroupSchema`, then run:

```bash
.venv/bin/python -B scripts/export_snapshot.py fixture --registry config/wandb-runs.yaml --fixture tests/fixtures/wandb_history_v1.json --output public/data --generated-at 2026-08-10T00:00:00Z
.venv/bin/python -B scripts/export_snapshot.py validate --manifest public/data/manifest.json
```

Expected: one compatibility group, 8 admitted fixture iterations, 7 unique geometries, valid hashes, and no stale generated shards.

- [ ] **Step 4: Run schema and snapshot tests and verify green**

Run:

```bash
npx vitest run src/domain/schema.test.ts src/data/snapshot.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 5: Scan the generated public snapshot**

Run:

```bash
.venv/bin/python -B scripts/scan_build.py --self-test
npm run build
.venv/bin/python -B scripts/scan_build.py dist
```

Expected: the scanner self-test catches seeded leaks; the actual build contains only the declared public profile.

- [ ] **Step 6: Commit the public contract**

```bash
git add public/data src/domain/schema.ts src/domain/schema.test.ts src/data/snapshot.test.ts
git commit -m "feat: publish merged condition metadata"
```

---

### Task 3: Pure efficiency and exact-reference selectors

**Files:**
- Create: `src/domain/efficiency.ts`
- Create: `src/domain/efficiency.test.ts`

**Interfaces:**
- Produces: `efficiencyFor(record: WingRecord): number | null`.
- Produces: `findMostEfficientRecord(records: readonly WingRecord[]): WingRecord | null`.
- Produces: `findExactParameterRecord(records: readonly WingRecord[], target: ParameterVector): WingRecord | null`.
- Produces: `metricDomains(records: readonly WingRecord[]): { cl: number; cd: number; efficiency: number }` with stable nonzero extents.

- [ ] **Step 1: Write failing selector tests**

Cover positive ratio, zero/negative drag exclusion, non-finite ratio exclusion, selected-group locality, deterministic timestamp/step/run/index ties, exact float32 parameter matching, no nearest fallback, and fixed group scales:

```ts
it("selects one maximum positive Cl/Cd record", () => {
  const records = [record({ cl: 0.8, cd: 0.04 }), record({ cl: 0.6, cd: 0.02 })];
  expect(findMostEfficientRecord(records)).toBe(records[1]);
  expect(efficiencyFor(records[1]!)).toBeCloseTo(30);
});

it("does not treat a nearby vector as the NACA record", () => {
  const nearby = record({ parameters: { ...BASELINE_PARAMETERS, x_c: BASELINE_PARAMETERS.x_c + 1e-4 } });
  expect(findExactParameterRecord([nearby], BASELINE_PARAMETERS)).toBeNull();
});
```

- [ ] **Step 2: Run the new test and verify red**

Run:

```bash
npx vitest run src/domain/efficiency.test.ts
```

Expected: module-not-found failure.

- [ ] **Step 3: Implement minimal pure functions**

Use `Math.fround` for all ten exact-vector comparisons so the browser matches exported float32 vectors. Keep tie-breaking in one comparator. For metric domains, compute group-wide maximum absolute `Cl` and `Cd`, and maximum positive efficiency, each with a small nonzero floor.

- [ ] **Step 4: Run the new test and verify green**

Run:

```bash
npx vitest run src/domain/efficiency.test.ts
```

Expected: all efficiency tests pass.

- [ ] **Step 5: Commit the domain functions**

```bash
git add src/domain/efficiency.ts src/domain/efficiency.test.ts
git commit -m "feat: define deterministic wing efficiency"
```

---

### Task 4: Metric and slider comparison markers

**Files:**
- Modify: `src/components/MetricsPanel.tsx`
- Modify: `src/components/ParameterSlider.tsx`
- Modify: `src/styles.css`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `efficiencyFor`, `metricDomains`, and one `bestRecord` from Task 3.
- Changes: `MetricsPanel` accepts `record: WingRecord | null`, `records: readonly WingRecord[]`, and `bestRecord: WingRecord | null`.
- Changes: `ParameterSlider` accepts `bestValue?: number`.

- [ ] **Step 1: Add failing component assertions**

Assert a third `metric-efficiency` row, best markers on all three rows, best markers on every active slider, and unavailable metrics for `record={null}`:

```ts
expect(screen.getByTestId("metric-efficiency")).toHaveTextContent("Cl/Cd");
expect(screen.getAllByTestId(/^best-metric-marker-/)).toHaveLength(3);
expect(screen.getAllByTestId(/^best-parameter-marker-/)).toHaveLength(4);
```

- [ ] **Step 2: Run the application test and verify red**

Run:

```bash
npx vitest run src/App.test.tsx
```

Expected: missing ratio and best-marker failures.

- [ ] **Step 3: Implement stable metric bars and green markers**

Render `Cl`, `Cd`, then `Cl/Cd`. Use group-wide domains rather than current-row scaling. Position each green marker using the corresponding value from the one `bestRecord`; include visually hidden text such as `Best-wing Cl reference 0.72`.

Add `bestValue` to each slider and position a noninteractive diamond/circle marker through the same bounded percentage function used by measured/requested indicators. Extend the marker legend with `Best Cl/Cd wing`.

- [ ] **Step 4: Run component tests and verify green**

Run:

```bash
npx vitest run src/App.test.tsx
```

Expected: all application tests pass.

- [ ] **Step 5: Run lint and TypeScript build**

Run:

```bash
npm run lint
npm run build
```

Expected: zero lint/type/build errors.

- [ ] **Step 6: Commit comparison presentation**

```bash
git add src/components/MetricsPanel.tsx src/components/ParameterSlider.tsx src/styles.css src/App.test.tsx
git commit -m "feat: mark the most efficient wing"
```

---

### Task 5: Condition strip, provenance label, and exact navigation

**Files:**
- Create: `src/components/ConditionStrip.tsx`
- Modify: `src/components/WingPlot.tsx`
- Modify: `src/components/ProvenancePanel.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `findMostEfficientRecord` and `findExactParameterRecord` from Task 3.
- Produces: measured selection state or explicit reference-only state without synthetic metrics.
- Produces: `Go to best wing` and `Go to NACA 2412` button actions.

- [ ] **Step 1: Add failing application behavior tests**

Assert the merged condition strip, prominent selected label, both buttons, coordinated best selection, exact NACA selection, and reference-only fallback:

```ts
expect(screen.getByText(/Re 3,000/)).toBeInTheDocument();
expect(screen.getByText(/Grid 900×210/)).toBeInTheDocument();
expect(screen.getByText(/Averaging 30–60 TU/)).toBeInTheDocument();
await user.click(screen.getByRole("button", { name: "Go to best wing" }));
expect(screen.getByTestId("selected-source-label")).toHaveTextContent(/Run .* · Step /);
await user.click(screen.getByRole("button", { name: "Go to NACA 2412" }));
expect(screen.getByTestId("selected-wing-path")).toHaveAttribute("d", screen.getByTestId("reference-wing-path").getAttribute("d"));
```

Create a no-baseline-record fixture in the test and assert `Measured metrics unavailable` plus `Reference definition · no measured run/step`, never a nearby record's values.

- [ ] **Step 2: Run the application tests and verify red**

Run:

```bash
npx vitest run src/App.test.tsx
```

Expected: missing condition strip/actions and reference-state failures.

- [ ] **Step 3: Implement coordinated navigation state**

Compute `bestRecord` from `group.records` with `useMemo`. Implement one `selectMeasuredRecord(index, announcement)` helper that updates record index, exact slider values, requested state, and live announcement atomically.

For NACA navigation, call `findExactParameterRecord(group.records, BASELINE_PARAMETERS)`. Select its real row if found; otherwise enter `referenceOnly`, set exact baseline display values, pass `null` to measured metrics/provenance, and retain no hidden nearby row. Any slider movement exits `referenceOnly` and resumes nearest measured preview.

- [ ] **Step 4: Implement condition and provenance presentation**

Render `ConditionStrip` from `group.compatibility`. Update `WingPlot` to accept display parameters plus optional record and to show `Run <id> · Step <step>` near its title when measured. Update `ProvenancePanel` to render the explicit reference-only message when record is null.

- [ ] **Step 5: Run application tests and verify green**

Run:

```bash
npx vitest run src/App.test.tsx
```

Expected: every navigation and row-consistency assertion passes.

- [ ] **Step 6: Run the full frontend unit suite**

Run:

```bash
npm run lint
npm run test
npm run build
```

Expected: all frontend unit/component tests, lint, TypeScript, and Vite build pass.

- [ ] **Step 7: Commit navigation and provenance**

```bash
git add src/components/ConditionStrip.tsx src/components/WingPlot.tsx src/components/ProvenancePanel.tsx src/App.tsx src/App.test.tsx src/styles.css
git commit -m "feat: navigate best and reference wings"
```

---

### Task 6: Browser acceptance and visual quality

**Files:**
- Modify: `e2e/dashboard.e2e.ts`
- Modify: `e2e/fixture.ts`
- Modify: `src/styles.css` only for defects found by browser inspection.

**Interfaces:**
- Consumes: stable accessible names and test IDs from Tasks 4 and 5.
- Produces: browser evidence for interaction, responsive layout, and accessibility.

- [ ] **Step 1: Update the browser fixture and add acceptance coverage**

Replace the browser fixture's old compatibility keys with the complete audited-condition keys, then add scenarios that verify:

```ts
await expect(page.getByText(/Re 3,000/)).toBeVisible();
await expect(page.getByTestId("metric-efficiency")).toBeVisible();
await page.getByRole("button", { name: "Go to best wing" }).click();
await expect(page.getByTestId("selected-source-label")).toContainText(/Run .* · Step /);
await page.getByRole("button", { name: "Go to NACA 2412" }).click();
await expect(page.getByTestId("selected-wing-path")).toHaveAttribute(
  "d",
  await page.getByTestId("reference-wing-path").getAttribute("d")
);
```

Retain the existing pointer/keyboard row-consistency, refresh, mobile-overflow, and axe checks.

- [ ] **Step 2: Run Playwright and use failures as integration defects**

Run:

```bash
npx playwright test e2e/dashboard.e2e.ts
```

Expected: the new behavior passes if the component work is complete. Any failure is a concrete integration or accessibility defect to fix in Step 3; do not weaken the assertion.

- [ ] **Step 3: Fix only browser-observed UI defects**

Adjust spacing, marker contrast, stacking, focus rings, or accessible copy in the owned component/style files. Do not change scientific selection rules to satisfy visual tests.

- [ ] **Step 4: Run complete local verification**

Run:

```bash
.venv/bin/pytest tests/python -q
.venv/bin/ruff check pipeline tests/python scripts
npm run check
npx playwright test
.venv/bin/python -B scripts/export_snapshot.py validate --manifest public/data/manifest.json
.venv/bin/python -B scripts/scan_build.py --self-test
.venv/bin/python -B scripts/scan_build.py dist
git diff --check
```

Expected: all suites pass, scanner passes, and no whitespace errors remain.

- [ ] **Step 5: Inspect desktop and mobile in the in-app browser**

Start Vite, open the local site with `browser:control-in-app-browser`, exercise both navigation buttons and a drag, inspect desktop and 390-pixel mobile layouts, and capture screenshots. Confirm the same run/step appears with the same row's metrics after every measured transition.

- [ ] **Step 6: Commit browser acceptance fixes**

```bash
git add e2e/dashboard.e2e.ts e2e/fixture.ts src/styles.css
git commit -m "test: verify efficiency navigation in browser"
```

---

### Task 7: Live export, evidence, review, and GitHub Pages deployment

**Files:**
- Modify: `docs/ai-evidence/work-log.md`
- Modify: `docs/qa/local-validation-2026-08-10.md` or create `docs/qa/local-validation-2026-08-11.md` for new evidence.
- No committed live W&B snapshot files.

**Interfaces:**
- Consumes: the complete verified branch and repository secrets/variables already configured for the live workflow.
- Produces: reviewed commit(s) on `main`, successful Pages workflow, and a verified public URL.

- [ ] **Step 1: Recheck the thesis invariant**

Run:

```bash
git -C /Users/edengolan/aero_shape_optimization branch --show-current
git -C /Users/edengolan/aero_shape_optimization rev-parse HEAD
git -C /Users/edengolan/aero_shape_optimization status --short --untracked-files=all
```

Expected: `drl-setting`, `4936dea753e11e54f25532820a7ac576f7f84401`, and no status output.

- [ ] **Step 2: Produce a temporary live W&B snapshot and audit it**

Export to a temporary directory outside tracked paths:

```bash
live_dir=$(mktemp -d)
.venv/bin/python -B scripts/export_snapshot.py live --registry config/wandb-runs.yaml --output "$live_dir"
.venv/bin/python -B scripts/export_snapshot.py validate --manifest "$live_dir/manifest.json"
```

Inspect only manifest counts and condition descriptors. Expected: snapshot kind `reviewed-wandb`, one audited compatibility group for the five reviewed runs, hundreds of admitted positive-lift iterations, and no undeclared fields. Remove the temporary directory through a recoverable cleanup only after evidence is recorded.

- [ ] **Step 3: Update the AI and QA evidence**

Record the human prompt, `caveman`, Cavecrew, and Superpowers usage, exact changed paths, human choices, test counts, browser screenshots, live snapshot counts, thesis invariant, and conservative time saved. Do not copy secrets or machine-specific private metadata.

- [ ] **Step 4: Request Cavecrew diff review and resolve findings**

Ask a `cavecrew-reviewer` to inspect the complete branch diff against the approved design, focusing on scientific grouping, row consistency, reference fallback, public-field boundary, tests, and deployment safety. Apply valid corrections using TDD and rerun affected suites.

- [ ] **Step 5: Run verification-before-completion**

Use `superpowers:verification-before-completion` and rerun the full command set from Task 6 plus the thesis invariant. Record current command output; do not rely on earlier results.

- [ ] **Step 6: Commit documentation evidence**

```bash
git add docs/ai-evidence/work-log.md docs/qa/local-validation-2026-08-11.md
git commit -m "docs: record condition explorer validation"
```

- [ ] **Step 7: Publish the feature branch and integrate to main**

Use the repository publication workflow to push the feature branch, review the exact diff, and integrate the verified commits to `main` without staging the unrelated duplicate fixtures. Push `main` only after the final review is clean.

- [ ] **Step 8: Trigger and monitor the approved live-data Pages workflow**

Run the `Publish approved live W&B data publicly` workflow on `main`. Monitor build/export/validation/privacy/deploy jobs until completion. If it fails, diagnose with `superpowers:systematic-debugging`; the previous verified Pages deployment must remain live.

- [ ] **Step 9: Verify production**

Open `https://edengol10.github.io/AI-final-course/` in the in-app browser with a cache-busting query. Confirm:

- reviewed live snapshot, not synthetic fixture;
- one condition group with the five reviewed runs;
- dynamic admitted/unique counts;
- condition strip values;
- `Cl`, `Cd`, and `Cl/Cd` consistency;
- green markers on metrics and active sliders;
- best/reference buttons;
- exact run/step labels;
- desktop and mobile accessibility/layout;
- refresh never contacts W&B from the browser.

Record the workflow URL, deployed commit, manifest checksum, and public website URL in the handoff.
