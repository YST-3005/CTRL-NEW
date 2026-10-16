import { expect, test } from "@playwright/test";

async function enterDemo(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Enter demo mode" }).click();
  await page.waitForURL("**/scanner");
}

test.describe("LabelLens Guardian journeys", () => {
  test("A: demo login, sample scan, review evidence", async ({ page }) => {
    await enterDemo(page);
    await page.getByTestId("sample-sample-oat-dawn").click();
    await page.waitForURL("**/analysis");
    await expect(page.getByRole("heading", { name: "Oat Dawn Clusters" })).toBeVisible();
    await page.getByRole("button", { name: /natural flavors/i }).click();
    await expect(page.getByText(/undisclosed/i)).toBeVisible();
  });

  test("B: forced OCR failure control is wired", async ({ page }) => {
    await enterDemo(page);
    await page.getByLabel(/Force next OCR failure/i).check();
    await expect(page.getByLabel(/Force next OCR failure/i)).toBeChecked();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  test("C: serving size calculator", async ({ page }) => {
    await enterDemo(page);
    await page.getByTestId("sample-sample-oat-dawn").click();
    await page.waitForURL("**/analysis");
    await page.getByTestId("serving-amount").fill("110");
    await expect(page.getByTestId("serving-factor")).toContainText("2.000");
  });

  test("D: compare two products", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/compare");
    await page.getByTestId("compare-left").selectOption("sample-oat-dawn");
    await page.getByTestId("compare-right").selectOption("sample-nova-whey");
    await expect(page.getByTestId("compare-chart")).toBeVisible();
    await expect(page.getByText("Accessible table alternative")).toBeVisible();
  });

  test("E: chatbot follow-up", async ({ page }) => {
    await enterDemo(page);
    await page.getByTestId("sample-sample-oat-dawn").click();
    await page.goto("/chat");
    await page.getByTestId("chat-input").fill("Does this product contain added sugar?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByTestId("chat-log")).toContainText(/Added Sugars|8/i);
    await page.getByTestId("chat-input").fill("Why was this ingredient flagged?");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByTestId("chat-log")).toContainText(/natural flavors|cane sugar|UNKNOWN|NON-VEGAN/i);
  });

  test("F: search, save, persist after reload", async ({ page }) => {
    await enterDemo(page);
    await page.getByTestId("sample-sample-oat-dawn").click();
    await page.goto("/history");
    await page.getByTestId("history-search").fill("Oat");
    const save = page.getByRole("button", { name: /^Save$/ });
    if (await save.count()) await save.click();
    await page.reload();
    await expect(page.getByText("Oat Dawn Clusters")).toBeVisible();
    await expect(page.getByText(/saved/i).first()).toBeVisible();
  });

  test("G: vegan preference updates rules", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/preferences");
    await page.getByTestId("pref-vegan").check();
    await page.goto("/scanner");
    await page.getByTestId("sample-sample-nova-whey").click();
    await expect(page.getByText(/Conflicts with vegan preference/i)).toBeVisible();
  });

  test("H: glycerin remains UNKNOWN", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/vegan");
    await page.getByRole("textbox").fill("glycerin");
    await page.getByRole("button", { name: "Classify" }).click();
    await expect(page.getByText("UNKNOWN").first()).toBeVisible();
  });

  test("I: radar highlights honey add", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/radar");
    await expect(page.getByTestId("radar-changes")).toContainText(/honey/i);
  });

  test("J: mock storefront warning", async ({ page }) => {
    await enterDemo(page);
    await page.goto("/store");
    await expect(page.getByTestId("store-warnings-sample-peanut-vector")).toContainText(/peanut/i);
  });

  test("K: caregiver simulation status", async ({ page }) => {
    await enterDemo(page);
    await page.getByTestId("sample-sample-peanut-vector").click();
    await page.goto("/caregiver");
    await page.getByTestId("caregiver-optin").check();
    const fields = page.locator("#content input:not([type='checkbox'])");
    await fields.nth(0).fill("Alex");
    await fields.nth(1).fill("alex@example.test");
    await page.getByRole("button", { name: "Save contact" }).click();
    await page.getByTestId("trigger-alert").click();
    await expect(page.getByTestId("alert-list")).toContainText("simulated");
    await expect(page.getByTestId("alert-list")).not.toContainText("delivered");
  });

  test("L: navigation destinations exist", async ({ page }) => {
    await enterDemo(page);
    const hrefs = [
      "/",
      "/scanner",
      "/analysis",
      "/compare",
      "/vegan",
      "/chat",
      "/history",
      "/radar",
      "/preferences",
      "/caregiver",
      "/store",
    ];
    for (const href of hrefs) {
      await page.goto(href);
      await expect(page.locator("#content")).toBeVisible();
    }
  });
});
