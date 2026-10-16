# Testing Guide & Automated Verification

## Automated Test Suites

```bash
npm test
```

**Results:** `13 passed (13 test files), 69 passed (69 tests)`

### Key Test Suites:

- **Mission 3 Evidence-Grounded Comparisons (`src/lib/dietary/comparisonEngine.test.ts`)**: 15 test scenarios verifying matching evidence conflicts, non-conflict certification safeguards, model contradiction detection, negative nutrition contradictions, ambiguous ingredient confirmation flows, and dynamic preference recalculation.
- **Caregiver Settings, Thresholds & Alerts (`src/lib/caregiver/caregiver.test.ts`)**: 15 test scenarios verifying dependent profile creation, persistence, user isolation, threshold checks, unit compatibility validation, personalized alerts, and safe fallbacks.
- **OCR Reliability Mission (`src/lib/ocr/reliability.test.ts`)**: 15 test scenarios (Cases A through O) covering optical quality assessment (blur, low resolution, glare, crop), structured extraction, honest null confidence, fail-safe invariance, and user corrections.
- **Nutrition Serving Scaling (`src/lib/nutrition/serving.test.ts`)**: 4 tests on unit conversions, scale factor calculations, and missing nutrient handling.
- **Vegan Classification & Catalogs (`src/lib/vegan/classify.test.ts`)**: 5 tests on three-state vegan origin categorization (`VEGAN`, `NON-VEGAN`, `UNKNOWN`).
- **Grounded Chatbot & Label Radar (`src/lib/chat/grounded.test.ts`, `src/lib/radar/labelDiff.test.ts`)**: Grounded citation verification and label version differential tracking.

### Playwright journeys A–L

Defined in `e2e/journeys.spec.ts`. The webServer starts `npm run dev` if needed.

## Manual walkthrough

1. Home → cinematic chamber.
2. Login → **Enter demo mode** → scanner.
3. Load **Oat Dawn Clusters** → analysis ingredients, evidence, nutrition.
4. Set serving to 110 g → scale factor 2.
5. Compare vs Nova Whey → chart + table.
6. Ask Your Label about added sugar, then a follow-up.
7. History search “Oat”, reload, confirm persistence.
8. Preferences → vegan on → scan Nova Whey → vegan conflict.
9. Vegan explorer → classify `glycerin` → UNKNOWN.
10. Change radar → honey added on v2.
11. Store → peanut bar warning. Optional: load extension.
12. Caregiver → opt in, save contact, simulate alert → status `simulated` (not delivered).

## Forced OCR failure

On Scanner, enable **Force next OCR failure**, then upload an image. Chamber goes to `failed`. Disable the checkbox and **Retry** to process the same preview.
