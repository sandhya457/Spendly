document.addEventListener("spendly:ready", () => {
  const select = document.getElementById("category");
  const data = Spendly.getData();
  select.innerHTML =
    '<option value="">Choose a category</option>' +
    data.categories
      .map(
        (x) =>
          '<option value="' +
          Spendly.escape(x.name) +
          '">' +
          Spendly.escape(x.name) +
          "</option>",
      )
      .join("");
  const date = document.getElementById("date");
  date.value = Spendly.today();
  document
    .getElementById("expenseForm")
    .addEventListener("submit", async (event) => {
      event.preventDefault();
      const amount = Number(document.getElementById("amount").value);
      if (!Number.isFinite(amount) || amount <= 0 || !select.value)
        return Spendly.toast("Enter a valid amount and category", true);
      const d = Spendly.getData();
      d.expenses.push({
        id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
        date: date.value,
        category: select.value,
        description: document.getElementById("description").value.trim(),
        amount,
      });
      const button = event.target.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        await Spendly.saveData(d);
        event.target.reset();
        date.value = Spendly.today();
        Spendly.toast("Expense saved");
        const spent = Spendly.monthEntries(d.expenses).reduce(
          (a, x) => a + Number(x.amount),
          0,
        );
        if (
          d.settings.budgetAlerts &&
          d.budget.total > 0 &&
          spent >= d.budget.total * 0.9
        )
          Spendly.toast(
            spent > d.budget.total
              ? "Monthly budget exceeded"
              : "You have used at least 90% of your monthly budget",
            true,
          );
      } catch {
      } finally {
        button.disabled = false;
      }
    });
});
