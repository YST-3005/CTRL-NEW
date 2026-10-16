# Troubleshooting

**Blank 3D panel**  
WebGL missing or blocked. A 2D fallback message should appear. The rest of the HUD still works.

**OCR slow or empty**  
Tesseract downloads a language worker on first run. Blurry photos fail honestly (empty text / low confidence). Use samples if you only need the pipeline.

**Demo session vanished**  
localStorage was cleared or you used another browser profile. Register again or click Enter demo mode.

**Playwright cannot start**  
Install browsers: `npx playwright install chromium`. Free port 3000 or set `reuseExistingServer`.

**npm install hangs**  
Use a writable cache: `npm install --cache ./.npm-cache`

**Supabase not doing anything**  
Demo auth is forced while `NEXT_PUBLIC_FORCE_DEMO_AUTH` is not `false`, or env vars are empty. This is intentional so the app is testable without credentials.

**Extension does nothing**  
It only matches `http://localhost:3000/store*`. Reload the unpacked extension after edits.

**Caregiver “delivered”**  
This build never marks simulated alerts as delivered.
