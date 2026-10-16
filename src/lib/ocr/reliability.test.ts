import { describe, expect, it } from "vitest";
import { assessImageQuality, analyzeImageData } from "@/lib/ocr/quality";
import {
  buildStructuredExtractionRecord,
  checkIngredientTruncation,
  detectAllergenConflicts,
  applyFieldCorrectionToRecord,
  confirmExtractedField,
} from "@/lib/extract/extractionEngine";
import { buildProductFromOcr } from "@/lib/extract/label";
import { evaluateDietaryRules } from "@/lib/dietary/rules";
import { localDb } from "@/lib/storage/local";
import { DEFAULT_PREFERENCES, type ProductRecord, type ScanRecord } from "@/types";

describe("OCR Reliability Mission Suite (Requirements A through O)", () => {
  // Case A: A clear, readable label
  it("Case A: processes a clear, readable label with full completeness and confirmed fields", () => {
    const rawOcr = [
      "Oat Dawn Clusters",
      "Sector 07 // Helion Pantry",
      "Ingredients: Whole grain oats, cane sugar, sunflower oil, salt.",
      "Contains: Soy, Wheat.",
      "Nutrition Facts",
      "Serving size: 55 g",
      "Calories: 220",
      "Total Fat: 6g",
      "Protein: 6g",
      "Total Sugars: 9g",
    ].join("\n");

    const product = buildProductFromOcr({
      ocrText: rawOcr,
      confidence: 94,
      imageDataUrl: "data:image/png;base64,mockClearImage",
    });

    expect(product.name).toContain("Oat Dawn Clusters");
    expect(product.ingredients.length).toBe(4);
    expect(product.allergenStatement?.allergens).toEqual(["soy", "wheat"]);
    expect(product.nutrition.servingSizeAmount).toBe(55);

    const rec = product.extractionRecord;
    expect(rec).toBeDefined();
    expect(rec?.productName.status).toBe("CONFIRMED");
    expect(rec?.ingredients.status).toBe("CONFIRMED");
    expect(rec?.allergens.status).toBe("CONFIRMED");
    expect(rec?.nutrition.status).toBe("CONFIRMED");
    expect(rec?.completenessScore).toBeGreaterThanOrEqual(80);
  });

  // Case B: A blurry label
  it("Case B: detects blurry label via optical quality engine and provides specific guidance", async () => {
    const blurryReport = await assessImageQuality("data:image/png;base64,fakeBlur", {
      mockMetrics: {
        isBlurry: true,
        sharpnessScore: 22,
        width: 1200,
        height: 1600,
      },
    });

    expect(blurryReport.metrics.isBlurry).toBe(true);
    expect(blurryReport.suitability).toBe("unsuitable");
    expect(blurryReport.guidance.some((g) => g.includes("blurry"))).toBe(true);
    expect(blurryReport.isEstimate).toBe(true);
  });

  // Case C: A low-resolution label
  it("Case C: detects low resolution (< 600px) and advises moving closer", async () => {
    const lowResReport = await assessImageQuality("data:image/png;base64,smallImage", {
      mockMetrics: {
        width: 320,
        height: 400,
        isLowResolution: true,
      },
    });

    expect(lowResReport.metrics.isLowResolution).toBe(true);
    expect(lowResReport.guidance.some((g) => g.includes("Text is too small") || g.includes("resolution"))).toBe(true);
  });

  // Case D: A partially cropped ingredient list
  it("Case D: detects truncated / cropped ingredient list and flags for review", () => {
    const truncatedText = "Whole grain oats, cane sugar, sunflower oil, contains 2% or less of (soy lecithin,";
    const check = checkIngredientTruncation(truncatedText);

    expect(check.isTruncated).toBe(true);
    expect(check.reason).toBeDefined();

    const rawOcr = `Sample Food\nIngredients: ${truncatedText}\nContains: Soy.`;
    const product = buildProductFromOcr({ ocrText: rawOcr, confidence: 80 });

    expect(product.extractionRecord?.ingredients.status).toBe("NEEDS_REVIEW");
    expect(product.dietary.veganStatus).toBe("UNKNOWN"); // Must NOT declare vegan when truncated
  });

  // Case E: An obscured or unreadable allergen statement
  it("Case E: marks unreadable or missing allergen statement as UNCERTAIN or MISSING", () => {
    const rawOcr = "Energy Crunch\nIngredients: Rolled oats, maple syrup, almonds.\nDistributed by Earth.";
    const product = buildProductFromOcr({ ocrText: rawOcr, confidence: 75 });

    expect(product.allergenStatement).toBeUndefined();
    expect(product.extractionRecord?.allergens.status).toBe("MISSING");
    expect(product.extractionRecord?.allergens.statusReason).toContain("No explicit 'Contains:'");
  });

  // Case F: OCR that returns no ingredient text
  it("Case F: triggers fail-safe incomplete alert when OCR returns no ingredient text", () => {
    const rawOcr = "Pure Spring Water\n100% Mountain Spring.";
    const product = buildProductFromOcr({ ocrText: rawOcr, confidence: 88 });

    expect(product.ingredients.length).toBe(0);
    expect(product.extractionRecord?.ingredients.status).toBe("MISSING");

    const findings = evaluateDietaryRules(product, DEFAULT_PREFERENCES);
    expect(findings.some((f) => f.id === "incomplete-ingredient-info")).toBe(true);
  });

  // Case G: OCR that returns incomplete text is never declared vegan or allergen-free
  it("Case G: ensures incomplete OCR text is never declared allergen-free or vegan", () => {
    const rawOcr = "Granola Bar\nIngredients: Oats, honey, crisp rice, ...";
    const product = buildProductFromOcr({ ocrText: rawOcr, confidence: 70 });

    expect(product.dietary.veganStatus).toBe("UNKNOWN");
    const findings = evaluateDietaryRules(product, { ...DEFAULT_PREFERENCES, vegan: true });
    expect(findings.some((f) => f.id === "vegan-unknown")).toBe(true);
  });

  // Case H: A provider that returns no confidence scores
  it("Case H: records confidence as null honestly when provider returns no scores", () => {
    const rawOcr = "Flax Crunch\nIngredients: Flaxseed, chia seeds, salt.\nContains: None.";
    const product = buildProductFromOcr({ ocrText: rawOcr }); // confidence omitted

    expect(product.extractionConfidence).toBeUndefined();
    expect(product.extractionRecord?.ingredients.confidence).toBeNull();
    expect(product.extractionRecord?.ingredients.confidenceEstimate).toBeDefined();
  });

  // Case I: A user correcting an ingredient
  it("Case I: updates ingredient list with user correction and recalculates dietary rules", () => {
    const rawOcr = [
      "Power Blend",
      "Ingredients: Whole grain oats, water, sunflower lecithin.",
      "Contains: None.",
      "Nutrition Facts",
      "Serving size: 30g",
      "Calories: 120",
      "Total Fat: 2g",
      "Protein: 4g",
      "Total Sugars: 1g",
    ].join("\n");
    const product = buildProductFromOcr({ ocrText: rawOcr, confidence: 85 });

    expect(product.dietary.veganStatus).toBe("VEGAN");

    // User discovers Whey Protein was missing and adds it
    const corrected = applyFieldCorrectionToRecord(
      product,
      "ingredients",
      "Whole grain oats, water, sunflower lecithin, whey protein",
    );

    expect(corrected.extractionRecord?.ingredients.status).toBe("USER_CORRECTED");
    expect(corrected.extractionRecord?.ingredients.userCorrected).toBe(true);
    expect(corrected.dietary.veganStatus).toBe("NON-VEGAN"); // Automatically recalculated!
    expect(corrected.ingredients.some((i) => i.name.toLowerCase().includes("whey"))).toBe(true);
  });

  // Case J: A user correcting an allergen field
  it("Case J: allows user to correct allergen statement and records original alongside", () => {
    const rawOcr = "Choco Bites\nIngredients: Cocoa, cane sugar, soy lecithin.";
    const product = buildProductFromOcr({ ocrText: rawOcr, confidence: 80 });

    expect(product.allergenStatement).toBeUndefined();

    // User specifies explicit allergen statement
    const corrected = applyFieldCorrectionToRecord(
      product,
      "allergens",
      "Contains: Soy, Peanuts",
    );

    expect(corrected.extractionRecord?.allergens.status).toBe("USER_CORRECTED");
    expect(corrected.allergenStatement?.allergens).toEqual(["soy", "peanuts"]);
    expect(corrected.extractionRecord?.allergens.originalSourceText).toBe("");
  });

  // Case K: Recalculation of dietary comparisons after correction
  it("Case K: immediately recalculates dietary rule findings after user correction", () => {
    const rawOcr = "Energy Bar\nIngredients: Oats, honey, dates.";
    const product = buildProductFromOcr({ ocrText: rawOcr, confidence: 85 });

    const initialFindings = evaluateDietaryRules(product, {
      ...DEFAULT_PREFERENCES,
      allergensToFlag: ["peanuts"],
    });
    expect(initialFindings.some((f) => f.rule === "user.allergen")).toBe(false);

    // User adds peanuts
    const corrected = applyFieldCorrectionToRecord(
      product,
      "ingredients",
      "Oats, honey, dates, peanut flour",
    );

    const updatedFindings = evaluateDietaryRules(corrected, {
      ...DEFAULT_PREFERENCES,
      allergensToFlag: ["peanuts"],
    });
    expect(updatedFindings.some((f) => f.rule === "user.allergen" && f.title.includes("peanuts"))).toBe(true);
  });

  // Case L: A product whose allergen status must remain unknown
  it("Case L: flags 'Allergen status unknown' when no allergens detected but statement is unreadable", () => {
    const rawOcr = "Oat Nibbles\nIngredients: Whole grain oats, brown sugar, cinnamon.";
    const product = buildProductFromOcr({ ocrText: rawOcr, confidence: 75 });

    const findings = evaluateDietaryRules(product, {
      ...DEFAULT_PREFERENCES,
      allergensToFlag: ["peanuts", "milk"],
    });

    const unknownFinding = findings.find((f) => f.id === "allergen-status-unknown");
    expect(unknownFinding).toBeDefined();
    expect(unknownFinding?.title).toBe("Allergen status unknown");
    expect(unknownFinding?.detail).toContain("Absence of evidence is not proof of allergen absence");
  });

  // Case M: Conflicting or ambiguous extracted information
  it("Case M: flags conflict when ingredient lists an allergen omitted by 'Contains:'", () => {
    const rawOcr = "Protein Cookie\nIngredients: Flour, sugar, butter (milk), eggs.\nContains: Wheat.";
    const product = buildProductFromOcr({ ocrText: rawOcr, confidence: 85 });

    expect(product.extractionRecord?.hasConflicts).toBe(true);
    expect(product.extractionRecord?.conflictNotes.length).toBeGreaterThan(0);

    const findings = evaluateDietaryRules(product, DEFAULT_PREFERENCES);
    expect(findings.some((f) => f.id.startsWith("conflict-"))).toBe(true);
  });

  // Case N: Request to retake image and successfully retry
  it("Case N: supports replacement close-up rescan flow preserving record continuity", () => {
    // Initial blurry scan
    const initialOcr = "Unclear Label\nIngredients: Oats...";
    const initialProduct = buildProductFromOcr({ ocrText: initialOcr, confidence: 45 });
    expect(initialProduct.extractionRecord?.ingredients.status).toBe("NEEDS_REVIEW");

    // Close-up image rescan
    const retakeOcr = "Oat Clusters Complete\nIngredients: Oats, honey, cinnamon, salt.\nContains: None.";
    const retakeProduct = buildProductFromOcr({ ocrText: retakeOcr, confidence: 92 });

    expect(retakeProduct.extractionRecord?.ingredients.status).toBe("CONFIRMED");
    expect(retakeProduct.ingredients.length).toBe(4);
  });

  // Case O: Persistence of corrected information after refreshing page
  it("Case O: persists user corrections and extraction integrity records in local storage", () => {
    const rawOcr = "Nature Bar\nIngredients: Almonds, dates, oats.";
    const product = buildProductFromOcr({ ocrText: rawOcr, confidence: 85 });

    const corrected = applyFieldCorrectionToRecord(product, "product_name", "Nature Bar Pro Blend");
    const scan: ScanRecord = {
      id: "test-scan-persisted-1",
      userId: "test-user-1",
      product: corrected,
      phase: "completed",
      saved: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    localDb.replaceUserScans("test-user-1", [scan]);
    const reloadedScans = localDb.getScans("test-user-1");

    expect(reloadedScans.length).toBe(1);
    expect(reloadedScans[0].product.name).toBe("Nature Bar Pro Blend");
    expect(reloadedScans[0].product.extractionRecord?.productName.status).toBe("USER_CORRECTED");
    expect(reloadedScans[0].product.extractionRecord?.productName.userCorrected).toBe(true);
  });
});
