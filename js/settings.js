document.addEventListener("spendly:ready", () => {
  const dark = document.getElementById("darkMode"),
    alerts = document.getElementById("budgetAlerts");
  const data = Spendly.getData();
  dark.checked = !!data.settings.darkMode;
  alerts.checked = !!data.settings.budgetAlerts;
  [dark, alerts].forEach((el) =>
    el.addEventListener("change", async () => {
      const d = Spendly.getData();
      d.settings.darkMode = dark.checked;
      d.settings.budgetAlerts = alerts.checked;
      try {
        await Spendly.saveData(d);
        Spendly.toast("Preferences saved");
      } catch {
        const last = Spendly.getData().settings;
        dark.checked = !!last.darkMode;
        alerts.checked = !!last.budgetAlerts;
      }
    }),
  );
  document.getElementById("exportData").addEventListener("click", async () => {
    try {
      const data = await Spendly.api("export-account");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "spendly-my-data.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      Spendly.toast("Account data downloaded");
    } catch (err) {
      Spendly.toast(err.message, true);
    }
  });
  document
    .getElementById("deleteAccountButton")
    .addEventListener("click", () => Spendly.openModal("accountDeleteModal"));
  document
    .getElementById("deleteAccountForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        await Spendly.api("delete-account", "POST", {
          current: document.getElementById("deletePassword").value,
          confirmation: document.getElementById("deleteConfirm").value,
        });
        location.replace("index.html");
      } catch (err) {
        Spendly.toast(err.message, true);
        btn.disabled = false;
      }
    });
  document.getElementById("resetData").addEventListener("click", async () => {
    if (
      !confirm(
        "Permanently delete your expenses, income, goals and budgets? This cannot be undone.",
      )
    )
      return;
    try {
      await Spendly.api("reset-data", "POST", {});
      location.reload();
    } catch (err) {
      Spendly.toast(err.message, true);
    }
  });
});
