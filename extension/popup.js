const defaults = { vegan: false, peanuts: true, milk: true };

async function load() {
  const stored = await chrome.storage.sync.get(defaults);
  document.getElementById("vegan").checked = stored.vegan;
  document.getElementById("peanuts").checked = stored.peanuts;
  document.getElementById("milk").checked = stored.milk;
  document.getElementById("status").textContent = "Preferences synced (local Chrome storage).";
}

["vegan", "peanuts", "milk"].forEach((id) => {
  document.getElementById(id).addEventListener("change", async () => {
    await chrome.storage.sync.set({
      vegan: document.getElementById("vegan").checked,
      peanuts: document.getElementById("peanuts").checked,
      milk: document.getElementById("milk").checked,
    });
    document.getElementById("status").textContent = "Saved.";
  });
});

load();
