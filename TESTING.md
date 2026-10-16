# Testing guide

## Automated

```bash
npm test
npx playwright install chromium
npm run test:e2e
```

### Unit coverage

- Serving-size scaling, zero/invalid units, missing nutrients
- Vegan UNKNOWN for glycerin / D3 / stearates; NON-VEGAN for gelatin
- OCR text extraction without invented bounding boxes
- Label radar honey addition on demo v2
- Nutrition compare does not coerce missing to zero
- Search / dietary preference rules
- Grounded chatbot citations

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
