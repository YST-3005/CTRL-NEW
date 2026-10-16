# LabelLens Guardian — Instructor Testing Guide

This guide provides direct, step-by-step procedures for reviewing and demonstrating each of the **8 OCR Reliability & Safety Requirements** in LabelLens Guardian.

---

## 1. Automated Test Suite Execution

Run the complete Vitest test suite covering all 15 mission test cases (A through O) plus 24 unit/integration tests:

```bash
npx vitest run
```

### Expected Output:
```
Test Files  11 passed (11)
Tests       39 passed (39)
```

To run specifically the OCR Reliability test suite:
```bash
npx vitest run src/lib/ocr/reliability.test.ts
```

### TypeScript Validation:
```bash
npx tsc --noEmit
```
*Expected: 0 errors.*

### Production Build Validation:
```bash
npm run build
```
*Expected: 21 of 21 static and dynamic pages generated successfully.*

---

## 2. Interactive Reviewer Walkthrough (Live Application)

Open the live application at:
**`http://localhost:3000`**

### Step 1: Demo Access (No Credentials Required)
1. Navigate to `/login` or click **Launch Scanning Chamber** on the home page.
2. Click **Enter demo mode** (instant zero-credential local session).

---

### Step 2: Testing Image Quality Assessment & Guidance
1. Navigate to `/scanner`.
2. Notice the **Optical Quality & Integrity Engine HUD** in the camera/upload area.
3. Test with a sample or upload a small/blurry photo:
   - The HUD displays real-time diagnostics:
     - **Sharpness Variance** (Laplacian 3x3 convolution)
     - **Min Resolution** (Pixel count & boundary limits)
     - **Lighting / Exposure** (BT.601 weighted luminance histogram)
     - **Specular Glare %** (Reflective hotspot detection)
     - **Edge Perimeter Density** (Crop & obstruction heuristic)
   - Specific, actionable advice is surfaced:
     - *"Image appears blurry — retake closer to the label with steady hands."*
     - *"Resolution is low for fine ingredient text — capture closer to the panel."*

---

### Step 3: Structured Extraction & Uncertainty State Machine
1. On `/scanner`, click on any sample product (e.g. **Oat Dawn Clusters** or **Nova Whey Isolate**), or click **Run Demo OCR**.
2. Upon scanning, navigate to `/analysis`.
3. In the **Extraction Integrity & Human-in-the-Loop Deck**:
   - Each field is individually classified with honest status chips:
     - `CONFIRMED` (verified high-confidence extraction)
     - `UNCERTAIN` (low confidence or heuristic estimate)
     - `NEEDS_REVIEW` (conflicts or incomplete syntax)
     - `MISSING` (absent from label)
   - Inspect the **Confidence Rating**: If the OCR engine does not provide character-level confidence, it is explicitly shown as `Honest null (provider unrated)`.

---

### Step 4: Editable Extraction & Live Recalculation
1. On `/analysis`, scroll down to the **Extraction Integrity Deck**.
2. Click **Edit Field** on the **Ingredients Panel**.
3. Type an added ingredient (e.g. add `whey protein` to an otherwise vegan product).
4. Click **Save Correction**:
   - Notice the field status immediately changes to `USER_CORRECTED`.
   - The original OCR text is retained side-by-side with the user correction for full auditability.
   - The **Dietary Rule Engine** dynamically recalculates:
     - Vegan status instantly drops from `VEGAN` to `NON-VEGAN`.
     - New allergen warnings appear in real time without refreshing the page.

---

### Step 5: Fail-Safe Invariance Demonstration
1. Test with an incomplete label or missing allergen statement:
   - When no "Contains:" statement exists, the system flags `ALLERGEN STATUS UNKNOWN` — **it never assumes the product is allergen-free**.
   - If an ingredient list is truncated (ends in `...` or incomplete text), the system displays the high-priority amber banner:
     > `[!] INCOMPLETE INGREDIENT INFORMATION`
     > *"Missing OCR text is never proof of absence. Vegan status and safety cannot be certified."*

---

### Step 6: Close-Up Rescan & Manual Text Fallback
1. On `/analysis`, click **Close-Up Rescan** in the Integrity Deck:
   - Upload a focused crop or clear photo of just the unreadable panel.
   - Notice that previous label metadata is preserved while the target field is updated.
2. In the scanner or integrity deck, click **Enter Text Manually**:
   - Paste or type ingredient text directly.
   - The system processes the text while honestly tagging it as *Manual Text Entry*.

---

### Step 7: Local Persistence & Session Continuity
1. Edit a product's ingredients or allergen statement.
2. Reload the browser page (`F5`).
3. Notice that all user corrections, extraction statuses, and recalculated findings remain fully preserved in localStorage.

---

## 3. Instructor Requirement Verification Matrix

| Requirement | Code Implementation | Test File / Case | UI Location |
| :--- | :--- | :--- | :--- |
| **1. Image Quality Detection** | `src/lib/ocr/quality.ts` | `reliability.test.ts` (Cases B, C) | `/scanner` Quality HUD |
| **2. Completeness & Uncertainty** | `src/lib/extract/extractionEngine.ts` | `reliability.test.ts` (Cases A, D, E, H) | `/analysis` Integrity Deck |
| **3. Clear-Image & Confirmation** | `src/components/analysis/ExtractionIntegrityDeck.tsx` | `reliability.test.ts` (Case N) | Integrity Deck Modal |
| **4. Editable Extraction Workflow** | `src/stores/useGuardianStore.ts` | `reliability.test.ts` (Cases I, J, O) | Inline Field Editor |
| **5. Fail-Safe Dietary Rules** | `src/lib/dietary/rules.ts` | `reliability.test.ts` (Cases F, G, L, M) | Analysis Warning Banner |
| **6. Evidence-Based Interface** | `src/components/analysis/EvidenceCard.tsx` | `reliability.test.ts` (Case A, J) | `/analysis` Evidence View |
| **7. 15 Automated Test Cases** | `src/lib/ocr/reliability.test.ts` | All Cases (A through O) | Vitest CLI |
| **8. Documentation & Audit** | `OCR_RELIABILITY.md`, `TESTING_GUIDE.md` | Full repository inspection | Root Directory |
