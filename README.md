# LabelLens Guardian

Cinematic 3D food-intelligence laboratory for reading packaged food labels with **evidence**, **fail-safe dietary rules**, and an **auditable OCR uncertainty engine**.

> [!IMPORTANT]
> **Instructor / Evaluator Quick Start:**
> - Review the complete [OCR Reliability Architecture](OCR_RELIABILITY.md)
> - Follow the step-by-step [Instructor Testing Guide](TESTING_GUIDE.md)
> - Run the automated test suite: `npx vitest run` (39/39 passing)
> - Production server runs locally on `http://localhost:3000` with instant zero-credential demo login.

## Core Capabilities (Working without paid APIs)

- **Optical Quality Assessment HUD:** Client-side blur (Laplacian variance), low resolution, exposure, specular glare, and edge-crop heuristics with specific user retake guidance.
- **Fail-Safe Dietary Invariance:** Missing OCR output is **never** treated as proof of absence. Unreadable allergen statements flag `ALLERGEN STATUS UNKNOWN`. Incomplete ingredient lists trigger `INCOMPLETE INGREDIENT INFORMATION`.
- **Extraction Integrity & Human-in-the-Loop:** Explicit field states (`CONFIRMED`, `UNCERTAIN`, `NEEDS_REVIEW`, `MISSING`, `USER_CORRECTED`). Original OCR strings are preserved alongside user corrections with immediate dynamic rule recalculation.
- **Rescan & Close-Up Workflow:** Target panel image replacement and clearly labeled manual text entry fallback.
- **On-Device OCR & Sample Fixtures:** Real in-browser OCR (Tesseract.js) + pre-configured sample products for instant review.
- **Cinematic 3D Food Lab:** Real WebGL product chamber, interactive nodes, nutrition charts, and comparison radar.

- Demo register / login / logout / session restore (localStorage, hashed passwords)
- Scanner chamber: drag-and-drop, file picker, camera capture, preview, validation, sample products, manual text
- On-device OCR via Tesseract.js (images stay in the browser)
- Ingredient / nutrition / allergen extraction from OCR or sample payloads
- Serving-size calculator (proportional, missing values stay missing)
- Product comparison charts + accessible tables
- Ask Your Label grounded chatbot (local rules; OpenAI only if `OPENAI_API_KEY` is set)
- History, search/filter, save, delete, local persistence
- Preferences that change warnings
- Vegan explorer with VEGAN / NON-VEGAN / UNKNOWN
- Label Change Radar on two stored captures
- Caregiver **simulation** (never sent)
- Mock grocery storefront + Chrome MV3 extension (localhost only)

## What is simulated or credential-gated

| Feature | Status |
| --- | --- |
| Auth | **Demo** unless Supabase URL + anon key are set and `NEXT_PUBLIC_FORCE_DEMO_AUTH=false` |
| Persistence | **localStorage** unless you apply `supabase/schema.sql` and wire the adapter |
| OCR | **On-device Tesseract** (real). Cloud Vision unused unless `GOOGLE_VISION_API_KEY` is added later |
| LLM | **Local grounded engine**. OpenAI used only with `OPENAI_API_KEY` |
| Caregiver alerts | **Simulation only** (`status: simulated`) |
| Extension | **Helion Market** at `/store` only |

## Run locally

```bash
npm install
npx playwright install chromium
copy .env.example .env.local
npm run dev
```

Open http://localhost:3000

**Demo login:** click **Enter demo mode**  
or register any email with a password of 10+ characters.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next.js (Turbopack) |
| `npm run build` | Production build |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright journeys |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |

## Chrome extension

1. Chrome → `chrome://extensions`
2. Developer mode on
3. Load unpacked → `extension/`
4. Open http://localhost:3000/store
5. Confirm warning chips on peanut / milk products

Popup toggles vegan / peanut / milk flags (Chrome sync storage).

## Environment

See `.env.example`. Never put real secrets in git.

Optional Supabase: create a project, run `supabase/schema.sql`, set URL + anon key, set `NEXT_PUBLIC_FORCE_DEMO_AUTH=false`.

## Testing guide

See [TESTING.md](TESTING.md) and [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Safety

Not medical advice. Medicine-tablet views do not tell anyone to stop a prescription. Vegan calls are not certifications. Unknown stays unknown.
