document.addEventListener("spendly:ready", () => {
  const list = document.getElementById("categoryList"),
    form = document.getElementById("categoryForm");
  function render() {
    const d = Spendly.getData();
    list.innerHTML = d.categories
      .map(
        (c) =>
          '<div class="category-item"><span class="category-symbol" style="background:' +
          c.color +
          '">' +
          Spendly.escape(c.symbol) +
          "</span>" +
          '<div class="category-copy"><h3>' +
          Spendly.escape(c.name) +
          "</h3><p>Organize your transactions</p></div>" +
          '<button class="table-action remove-category" data-name="' +
          Spendly.escape(c.name) +
          '">Remove</button></div>',
      )
      .join("");
    list.querySelectorAll(".remove-category").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const d = Spendly.getData(),
          name = btn.dataset.name;
        if (d.categories.length <= 1)
          return Spendly.toast("Keep at least one category", true);
        if (d.expenses.some((e) => e.category === name))
          return Spendly.toast(
            "This category has expenses. Reassign them before removing it.",
            true,
          );
        if (!confirm("Remove the " + name + " category?")) return;
        d.categories = d.categories.filter((c) => c.name !== name);
        delete d.budget.categories[name];
        btn.disabled = true;
        try {
          await Spendly.saveData(d);
          render();
          Spendly.toast("Category removed");
        } catch {
          btn.disabled = false;
        }
      }),
    );
  }
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Spendly.getData(),
      name = document.getElementById("categoryName").value.trim();
    if (!name || name.length > 50)
      return Spendly.toast("Enter a category name under 50 characters", true);
    if (d.categories.some((c) => c.name.toLowerCase() === name.toLowerCase()))
      return Spendly.toast("Category already exists", true);
    d.categories.push({
      name,
      color: document.getElementById("categoryColor").value,
      symbol: name[0].toUpperCase(),
    });
    d.budget.categories[name] = 0;
    const btn = form.querySelector("button");
    btn.disabled = true;
    try {
      await Spendly.saveData(d);
      form.reset();
      render();
      Spendly.toast("Category added");
    } catch {
    } finally {
      btn.disabled = false;
    }
  });
  render();
});
