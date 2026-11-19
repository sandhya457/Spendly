document.addEventListener("spendly:ready", () => {
  const form = document.getElementById("budgetForm"),
    input = document.getElementById("monthlyBudget"),
    list = document.getElementById("budgetCategories"),
    editForm = document.getElementById("budgetLimitForm");
  let editing = null;
  function render() {
    const d = Spendly.getData(),
      totals = {};
    Spendly.monthEntries(d.expenses).forEach(
      (x) =>
        (totals[x.category] = (totals[x.category] || 0) + Number(x.amount)),
    );
    input.value = d.budget.total;
    list.innerHTML = d.categories
      .map((c) => {
        const spent = totals[c.name] || 0,
          limit = Number(d.budget.categories[c.name] || 0);
        return (
          '<article class="goal-card"><span class="category-symbol" style="background:' +
          c.color +
          '">' +
          Spendly.escape(c.symbol) +
          "</span>" +
          '<div class="goal-main"><h3>' +
          Spendly.escape(c.name) +
          "</h3><p>" +
          Spendly.money(spent) +
          " of " +
          Spendly.money(limit) +
          " this month</p>" +
          '<div class="goal-progress"><span style="width:' +
          (limit ? Math.min(100, (spent / limit) * 100) : 0) +
          '%"></span></div></div>' +
          '<button type="button" class="table-action edit-budget" data-name="' +
          Spendly.escape(c.name) +
          '">Edit limit</button></article>'
        );
      })
      .join("");
  }
  list.addEventListener("click", (e) => {
    const btn = e.target.closest("button.edit-budget");
    if (!btn) return;
    editing = btn.dataset.name;
    document.getElementById("budgetLimitTitle").textContent =
      "Budget for " + editing;
    document.getElementById("budgetLimitAmount").value =
      Spendly.getData().budget.categories[editing] || 0;
    Spendly.openModal("budgetLimitModal");
  });
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!editing) return;
    const value = Number(document.getElementById("budgetLimitAmount").value);
    if (!Number.isFinite(value) || value < 0)
      return Spendly.toast("Enter a valid budget", true);
    const d = Spendly.getData();
    d.budget.categories[editing] = value;
    const btn = editForm.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      await Spendly.saveData(d);
      Spendly.closeModal("budgetLimitModal");
      render();
      Spendly.toast("Category limit updated");
    } catch {
    } finally {
      btn.disabled = false;
    }
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Spendly.getData();
    d.budget.total = Number(input.value);
    if (!Number.isFinite(d.budget.total) || d.budget.total < 0)
      return Spendly.toast("Invalid budget", true);
    const btn = form.querySelector("button");
    btn.disabled = true;
    try {
      await Spendly.saveData(d);
      render();
      Spendly.toast("Monthly budget updated");
    } catch {
    } finally {
      btn.disabled = false;
    }
  });
  render();
});
