function badge(text, tone) {
  const el = document.createElement("div");
  el.className = `llg-badge llg-${tone}`;
  el.textContent = text;
  return el;
}

async function run() {
  const prefs = await chrome.storage.sync.get({ vegan: false, peanuts: true, milk: true });
  document.querySelectorAll("[data-llg-product]").forEach((node) => {
    node.querySelectorAll(".llg-badge").forEach((b) => b.remove());
    const allergens = (node.getAttribute("data-llg-allergens") || "").toLowerCase();
    const vegan = node.getAttribute("data-llg-vegan") || "UNKNOWN";
    const ingredients = (node.getAttribute("data-llg-ingredients") || "").toLowerCase();
    let hit = false;
    if (prefs.peanuts && (allergens.includes("peanut") || ingredients.includes("peanut"))) {
      node.appendChild(badge("Warning: peanuts evidenced on this demo card", "alert"));
      hit = true;
    }
    if (prefs.milk && (allergens.includes("milk") || ingredients.includes("whey") || ingredients.includes("milk"))) {
      node.appendChild(badge("Warning: milk evidenced on this demo card", "alert"));
      hit = true;
    }
    if (prefs.vegan && vegan === "NON-VEGAN") {
      node.appendChild(badge("Warning: vegan preference conflict (evidenced non-vegan)", "alert"));
      hit = true;
    }
    if (prefs.vegan && vegan === "UNKNOWN") {
      node.appendChild(badge("UNKNOWN: vegan status cannot be confirmed", "unknown"));
      hit = true;
    }
    if (!hit) {
      node.appendChild(badge("No configured conflict on disclosed fields", "ok"));
    }
    const link = document.createElement("a");
    link.href = "http://localhost:3000/analysis";
    link.className = "llg-link";
    link.textContent = "Open LabelLens Guardian analysis";
    node.appendChild(link);
  });
}

run();
chrome.storage.onChanged.addListener(run);
