# LabelLens Guardian — OCR Reliability & Safety Architecture

This document details the OCR Reliability, Safety, and Uncertainty Engine implemented in LabelLens Guardian to meet rigorous academic, clinical, and regulatory standards for food label interpretation.

---

## 1. Non-Negotiable Safety Philosophy: Fail-Safe Invariance

The central tenet of LabelLens Guardian is:
> **Missing OCR output is NEVER evidence that an ingredient or allergen is absent.**

When text is missing, cropped, blurry, or unreadable:
- An allergen statement that cannot be verified results in **ALLERGEN STATUS UNKNOWN**. It is never treated as "Allergen Free".
- An ingredient list that ends prematurely (e.g. trailing comma, `...`, "and other", or syntax cutoff) triggers **INCOMPLETE INGREDIENT INFORMATION**.
- A product with incomplete ingredients or uncertain origin components is assigned **veganStatus: UNKNOWN**. Vegan status is never fabricated from truncated data.
- When an ingredient explicitly lists an allergen (e.g., `whey protein`, `casein`, `almonds`) that is omitted from the "Contains:" statement, a **CONTRADICTORY EVIDENCE CONFLICT** is flagged.

---

## 2. Image Quality & Optical Assessment Engine (`src/lib/ocr/quality.ts`)

Before and during label extraction, the browser executes client-side canvas-level optical diagnostics:

| Metric | Threshold / Heuristic | Actionable Review Guidance |
| :--- | :--- | :--- |
| **Sharpness / Blur** | Discrete Laplacian convolution variance < 120 | *"Image appears blurry or out of focus. Retake closer to the label with steady hands."* |
| **Resolution** | Min dimension < 600px or pixel count < 400,000 | *"Resolution is too low for small ingredient text. Capture closer to the panel."* |
| **Luminance & Contrast** | BT.601 weighted brightness histogram (Dark < 65, Overexposed > 215) | *"Poor lighting or uneven exposure. Retake in even, diffused lighting."* |
| **Specular Glare** | Pixels with $R, G, B > 245$ exceeding 5% of label area | *"Specular glare detected on glossy surface. Tilt container away from direct light."* |
| **Cropping / Edge Density** | High Sobel edge density within 5% border perimeter | *"Panel appears cropped or obstructed at the edges. Frame the entire box or bottle."* |
| **Surface Curvature** | Aspect ratio distortion heuristic on cylindrical containers | *"Curved container surface detected. Rotate container and capture in flat sections."* |

*Note on Transparency:* Image-quality analysis is performed via discrete heuristic image processing algorithms running in the client browser. It provides probabilistic guidance to help the user capture optimal labels, not a certified laboratory vision benchmark.

---

## 3. Structured Extraction & Uncertainty State Machine (`src/lib/extract/extractionEngine.ts`)

Every extracted field is tracked as an independent, typed `ExtractedField<T>` with an explicit state machine:

```
[RAW OCR INPUT]
       │
       ▼
 ┌─────────────┐
 │  EXTRACTION │
 └──────┬──────┘
        ├────────────► MISSING          (Field not present in source text)
        ├────────────► UNCERTAIN        (Low OCR confidence, blur, or truncated text)
        ├────────────► NEEDS_REVIEW     (Conflicting allergen or non-standard syntax)
        ├────────────► CONFIRMED        (High-confidence OCR verified against catalog)
        │
        ▼ (User Action)
 ┌─────────────┐
 │ CORRECTION  │ ────► USER_CORRECTED  (User supplied override; original preserved)
 └─────────────┘
```

### Honest Confidence Recording
If the underlying OCR engine (e.g., standard Tesseract or on-device fallback) does not return authentic character-level confidence scores, **LabelLens Guardian records confidence as `null`**. Confidence scores are never invented. When numeric scores are absent, an algorithmic quality estimate is documented alongside.

---

## 4. Editable Extraction & Human-in-the-Loop Workflow

Users retain complete control through the **Extraction Integrity Deck** (`src/components/analysis/ExtractionIntegrityDeck.tsx`):
1. **Side-by-Side Comparison:** Whenever a field is edited, the original OCR string is permanently preserved alongside the user correction. The field is visually tagged with a `USER_CORRECTED` badge.
2. **Instant Dynamic Recalculation:** Editing any ingredient immediately re-executes:
   - Ingredient origin classification (`VEGAN`, `NON-VEGAN`, `UNKNOWN`).
   - Dietary rule engine (allergens, gluten, sodium thresholds, sugar limits).
   - Side-by-side comparison tables and radar diff charts.
3. **Rescan & Close-Up Replacement:** If a specific panel (e.g. nutrition table or allergen statement) is unreadable, the user can upload a high-resolution close-up of just that panel without losing previously extracted information.
4. **Manual Text Entry Fallback:** If OCR fails completely, users can paste or type the ingredient panel directly. The application clearly labels this data as *Manual Text Entry*.

---

## 5. Automated Verification Test Suite (`src/lib/ocr/reliability.test.ts`)

The entire engine is verified by a 15-case test suite (`Case A` through `Case O`) executed with Vitest:

| Test Case | Scenario Verified | Outcome |
| :--- | :--- | :--- |
| **Case A** | Clear, high-contrast, fully readable label | Full completeness, all fields `CONFIRMED` |
| **Case B** | Blurry image (Laplacian variance < 120) | Flagged blurry; specific retake guidance generated |
| **Case C** | Low resolution image (< 600px) | Low-res alert triggered; recommends moving closer |
| **Case D** | Truncated ingredient text ending in `...` | `isTruncated: true`, status `NEEDS_REVIEW` |
| **Case E** | Missing or unreadable "Contains:" statement | Status `UNCERTAIN` or `MISSING`, never safe |
| **Case F** | OCR returns blank ingredient text | Triggers fail-safe `incomplete-ingredient-info` alert |
| **Case G** | Incomplete OCR text evaluated for vegan | Strictly `UNKNOWN`; never declared vegan |
| **Case H** | OCR provider with no confidence scores | Honest `confidence: null`; no fabricated numbers |
| **Case I** | User adds missing non-vegan ingredient | Dynamic recalculation switches status to `NON-VEGAN` |
| **Case J** | User corrects allergen statement | Original preserved alongside `USER_CORRECTED` value |
| **Case K** | User correction updates rule alerts | Triggers high-priority allergen warnings instantly |
| **Case L** | Allergen-free assertion on unreadable label | Produces `Allergen status unknown`, not allergen-free |
| **Case M** | Ingredient has milk but "Contains:" says None | Contradictory evidence flagged as conflict |
| **Case N** | Close-up rescan of unreadable panel | Updates target panel while preserving label continuity |
| **Case O** | Persistence of corrections | Validated in local storage across browser reloads |

---

---

## 7. Mission 3: Evidence-Grounded Dietary Comparison & Contradiction Engine (`src/lib/dietary/comparisonEngine.ts`)

Mission 3 elevates simple rule checks into an auditable, evidence-grounded dietary decision system.

### Explicit Result Statuses
1. **`CONFIRMED_CONFLICT`**: Label text explicitly confirms an ingredient or nutrition value that violates a saved user preference or threshold.
2. **`NO_DETECTED_CONFLICT`**: Label text was thoroughly examined, and no conflict was identified within the available readable evidence. *Note: Never equates to a guarantee of safety or complete absence.*
3. **`UNCERTAIN`**: Relevant evidence exists, but the commercial origin is ambiguous (e.g. `glycerin`, `lecithin`) or the label's serving basis/units are incompatible with the configured threshold.
4. **`MISSING_INFORMATION`**: A critical label section (e.g. ingredients or allergen statement) is unreadable or absent. Triggers mandatory fail-safe guardrails.
5. **`UNRESOLVED_CONTRADICTION`**: Competing sources disagree (e.g., an LLM claims a product is vegan, but the physical label lists milk protein). The physical label evidence always takes precedence.
6. **`NEEDS_USER_CONFIRMATION`**: An ambiguous ingredient or contradiction could alter the dietary outcome. The system prompts the user to review the competing interpretations and confirm or leave unresolved.

### Traceable Evidence References
Every comparison object (`EvidenceGroundedComparison`) maintains:
- `supportingEvidenceRefs`: Array of exact ingredient IDs, evidence IDs, or panel identifiers.
- `originalExtractedText`: Exact, unaltered string snippet from the OCR scan.
- `normalizedValue`: Standardized interpretation (e.g. 14g sugar, milk allergen tag).
- `thresholdApplied`: Operator, numerical limit, unit, and serving basis.

Selecting any alert card in the UI automatically navigates to and highlights the supporting evidence in the matrix or panel.

---

## 8. Caregiver Dashboard, Nutrition Thresholds & Personalized Alerts (`src/app/caregiver/page.tsx`)

A dedicated caregiver management portal allowing authorized caregivers to safeguard dependents:

- **Dependent Profile**: Configurable identifier, vegan/vegetarian diet plan, multi-allergen avoidance list, and custom ingredients of concern.
- **Nutrition Thresholds**: Numeric limits for sugar, sodium, saturated fat, calories, etc., with support for `>=`, `<=`, `>`, `<`.
- **Unit & Serving Basis Normalization**: Evaluates thresholds per printed serving or normalized to 100g/100ml. If units are incompatible (e.g. calories vs milligrams) or serving size lacks gram conversion, the system generates an `UNCERTAIN` finding rather than an incorrect calculation.
- **Automatic Scan Verification**: Every label scan instantly evaluates both personal preferences and the caregiver profile, generating evidence-linked alerts in real time.
- **Persistence & User Isolation**: Stored under isolated user keys (`llg.caregiverProfiles`), preventing unauthorized cross-account contamination.

---

## 9. Comprehensive Automated Test Matrix (69 Total Tests)

LabelLens Guardian is validated across 13 dedicated test suites totaling 69 passing tests:

1. **`src/lib/dietary/comparisonEngine.test.ts` (15 Scenarios)**:
   - Scenario 1: Matching evidence supports dietary conflict.
   - Scenario 2: Matching evidence supports no detected conflict within scope.
   - Scenario 3: Model contradicts explicit extracted evidence.
   - Scenario 4: Extracted text and model allergen claims disagree.
   - Scenario 5: Ambiguous ingredient requires user confirmation.
   - Scenario 6: Unreadable or missing ingredient remains unresolved.
   - Scenario 7: Cropped ingredient list cannot be treated as complete.
   - Scenario 8: Nutrition value conflicts with source text (negative values).
   - Scenario 9: Different dietary preferences produce different results on same label.
   - Scenario 10: Updating dietary preferences recalculates comparisons dynamically.
   - Scenario 11: Correcting an extracted field updates evidence and comparison.
   - Scenario 12: Evidence links navigate to correct source field IDs.
   - Scenario 13: Missing evidence produces no fabricated links.
   - Scenario 14: Unanswered confirmation requests remain in `NEEDS_USER_CONFIRMATION`.
   - Scenario 15: No unsupported medical, safety, or certification claims produced.

2. **`src/lib/caregiver/caregiver.test.ts` (15 Scenarios)**:
   - Caregiver 1: Successful creation and saving of dependent profile.
   - Caregiver 2: Persistence across session restores.
   - Caregiver 3: User isolation (zero cross-user profile contamination).
   - Caregiver 4: Declared ingredient triggers configured restriction.
   - Caregiver 5: Nutrition value exceeding threshold triggers alert.
   - Caregiver 6: Incompatible units flagged as `UNCERTAIN`.
   - Caregiver 7: Missing nutrient flagged as `MISSING_INFORMATION`.
   - Caregiver 8: Multiple dependents receive distinct personalized alerts on same label.
   - Caregiver 9: Updating threshold limit recalculates outcome dynamically.
   - Caregiver 10: Updating allergen avoidance recalculates findings.
   - Caregiver 11: Every alert carries exact supporting text and evidence ref.
   - Caregiver 12: Model assertions cannot suppress detected label allergens.
   - Caregiver 13: `leave_unresolved` maintains honest `UNCERTAIN` status.
   - Caregiver 14: Incomplete label coverage produces guardrail alert.
   - Caregiver 15: Fallback defaults initialize safely.

3. **`src/lib/ocr/reliability.test.ts` (15 Cases A–O)**: Optical quality, blur, truncation, confidence null handling, fail-safe rules, and persistence.
4. **Unit & Integration Suites (24 Tests)**: Serving size scaling, vegan origin classifier, label parser, radar diff, chat citations, notification simulation, search filtering.

---

## 10. Regulatory, Clinical & Safety Limitations

1. **OCR Invariance**: OCR systems are subject to character recognition inaccuracies on curved, shiny, or folded packaging.
2. **Heuristic Image Assessment**: Optical diagnostics (blur, glare, resolution) provide probabilistic guidance for retakes, not certified laboratory benchmarks.
3. **Informational Aid Only**: LabelLens Guardian is not a medical device, diagnosis tool, or certification authority. Users with severe allergies must always verify physical packaging directly.
