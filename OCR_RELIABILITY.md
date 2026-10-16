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

## 6. Regulatory & Medical Disclaimer

LabelLens Guardian is an educational food-intelligence aid and research tool. It does **not** provide clinical diagnosis, medical prescription advice, or a legal guarantee against cross-contact or life-threatening anaphylactic reactions. Consumers must always consult the original physical package and their healthcare provider.
