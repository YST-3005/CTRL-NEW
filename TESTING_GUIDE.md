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
Test Files  13 passed (13)
Tests       69 passed (69)
```

To run specifically the Evidence-Grounded Comparison test suite:
```bash
npx vitest run src/lib/dietary/comparisonEngine.test.ts
```

To run specifically the Caregiver Settings & Alerts test suite:
```bash
npx vitest run src/lib/caregiver/caregiver.test.ts
```

To run the OCR Reliability test suite:
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

---

### Step 8: Evidence-Grounded Alerts & Clickable Evidence Navigation (Mission 3)
1. On `/analysis`, scroll down to **Dietary comparison (Evidence-grounded alerts & rules)**.
2. Notice the explicit status badges:
   - `CONFIRMED CONFLICT` (red badge + alert icon)
   - `NO DETECTED CONFLICT` (emerald badge + checkmark)
   - `UNCERTAIN` (amber badge + warning icon)
   - `MISSING INFORMATION` (amber badge + list icon)
   - `UNRESOLVED CONTRADICTION` (fuchsia badge + conflict icon)
   - `NEEDS CONFIRMATION` (cyan badge + question icon)
3. For each alert, inspect the exact quoted label snippet, normalized value, and configured threshold.
4. Click **🔍 View Label Evidence**:
   - The interface instantly scrolls to the exact ingredient in the list or the nutrition facts panel and highlights it with a radiant cyan glow.

---

### Step 9: Contradiction Detection & User Ambiguity Confirmation (Mission 3)
1. Test with an ambiguous ingredient (e.g. `glycerin` in an oat bar):
   - Notice the alert badge indicates `NEEDS CONFIRMATION`.
2. Click **⚠️ Review & Resolve**:
   - A modal displays:
     - The exact original label phrase: *&ldquo;glycerin&rdquo;*
     - Competing interpretations: *Plant-derived synthesis* vs *Animal-derived rendering*
     - Clear explanation of why the distinction affects your saved dietary plan.
   - Click **Confirm Plant Origin**:
     - The status dynamically updates to `NO DETECTED CONFLICT` (`✓ User Confirmed`).
   - Or click **Leave Unresolved**:
     - The system maintains an honest `UNCERTAIN` status without guessing.

---

### Step 10: Caregiver Portal, Threshold Configuration & Personalized Alerts
1. In the navigation bar, click **Caregiver** (`/caregiver`).
2. Manage the Dependent Dietary Profile:
   - Edit Dependent Name (e.g., *Maya*).
   - Toggle Strict Vegan / Vegetarian.
   - Toggle major allergens (e.g. Milk, Peanuts, Tree Nuts) and enter custom ingredients of concern.
   - Click **Save Dietary Profile**.
3. Configure Numeric Nutrition Thresholds:
   - Review active limits (e.g., *Total Sugars >= 12g*, *Sodium >= 400mg*).
   - Add a new limit: *Nutrient: Saturated Fat*, *Operator: >=*, *Limit: 2*, *Unit: g*, *Basis: Per Printed Serving*.
   - Click **+ Add Threshold** and **Save All Changes**.
4. Live Alert Verification on Scanned Product:
   - Notice the **Live Scan Verification** section in the Caregiver portal automatically evaluates the currently scanned label against Maya's thresholds!
   - If sugar exceeds 12g, a prominent alert appears with exact extracted grams and configured limit.
5. Incompatible Unit Safety:
   - If a threshold is entered with incompatible units (e.g. calories vs milligrams) or missing serving basis, it safely flags `UNCERTAIN` instead of producing a corrupted calculation.

---

## 3. Mission 3 & Caregiver Requirement Verification Matrix

| Requirement | Code Implementation | Test File / Scenarios | UI Location |
| :--- | :--- | :--- | :--- |
| **Req 1: Evidence-Grounded Comparisons** | `src/lib/dietary/comparisonEngine.ts` | `comparisonEngine.test.ts` (Scenarios 1, 2) | `/analysis` Alerts Deck |
| **Req 2: Exact Extracted Evidence** | `src/components/analysis/EvidenceGroundedAlerts.tsx` | `comparisonEngine.test.ts` (Scenarios 1, 11) | Exact Evidence Card Block |
| **Req 3: Traceable Evidence Links** | `src/app/analysis/page.tsx` (`handleNavigateToEvidence`) | `comparisonEngine.test.ts` (Scenarios 12, 13) | `🔍 View Label Evidence` |
| **Req 4: Contradiction Detection** | `src/lib/dietary/comparisonEngine.ts` | `comparisonEngine.test.ts` (Scenarios 3, 4, 8) | Status: `UNRESOLVED_CONTRADICTION` |
| **Req 5: User Confirmation Flow** | `src/components/analysis/EvidenceGroundedAlerts.tsx` | `comparisonEngine.test.ts` (Scenarios 5, 14) | `⚠️ Review & Resolve` Modal |
| **Req 6: Explicit Result Statuses** | `src/types/comparison.ts` | `comparisonEngine.test.ts` (Scenarios 1–8) | Distinct Color/Icon Badges |
| **Req 7: Fail-Safe Guardrails** | `src/lib/dietary/comparisonEngine.ts` | `comparisonEngine.test.ts` (Scenarios 6, 7, 15) | Invariance Warning Banners |
| **Req 8: 15 Automated Test Scenarios** | `src/lib/dietary/comparisonEngine.test.ts` | All 15 Scenarios Passing | Vitest CLI |
| **Req 9: Documentation & Auditing** | `OCR_RELIABILITY.md`, `TESTING_GUIDE.md` | Full repository review | Project Root |
| **Caregiver Req 1: Portal & Plan** | `src/app/caregiver/page.tsx` | `caregiver.test.ts` (Cases 1, 2, 3) | `/caregiver` Profile Manager |
| **Caregiver Req 2: Nutrition Thresholds** | `src/lib/dietary/comparisonEngine.ts` | `caregiver.test.ts` (Cases 5, 6, 7, 9) | Thresholds Table & Form |
| **Caregiver Req 3: Persistence & Ownership** | `src/lib/storage/local.ts` | `caregiver.test.ts` (Cases 1, 2, 3) | `llg.caregiverProfiles` |
| **Caregiver Req 4: Automatic Scan Alerts** | `src/stores/useGuardianStore.ts` | `caregiver.test.ts` (Cases 4, 5, 8, 10) | Live Product Verification |
| **Caregiver Req 5: Evidence-Linked Alerts** | `src/components/analysis/EvidenceGroundedAlerts.tsx` | `caregiver.test.ts` (Case 11) | Exact Units & Values |
| **Caregiver Req 9: 15 Caregiver Tests** | `src/lib/caregiver/caregiver.test.ts` | All 15 Cases Passing | Vitest CLI |

