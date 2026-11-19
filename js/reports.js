document.addEventListener("spendly:ready", () => {
  const $ = (id) => document.getElementById(id),
    table = $("expenseTable");
  let editing = null;
  const toolbar = document.createElement("div");
  toolbar.className = "report-toolbar";
  toolbar.innerHTML =
    '<button type="button" class="secondary-button" id="exportExpenses">Export filtered CSV</button><button type="button" class="secondary-button" id="exportIncome">Export income CSV</button>';
  table.closest(".card").querySelector(".section-header")?.append(toolbar);
  for (const c of Spendly.getData().categories) {
    const o = document.createElement("option");
    o.value = c.name;
    o.textContent = c.name;
    $("reportCategory").append(o);
    $("expenseEditCategory").append(o.cloneNode(true));
  }
  const filters = ["reportSearch", "reportCategory", "reportFrom", "reportTo"];
  function filtered() {
    const query = $("reportSearch").value.trim().toLowerCase(),
      category = $("reportCategory").value;
    const from = $("reportFrom").value,
      to = $("reportTo").value;
    return Spendly.getData().expenses.filter(
      (e) =>
        (!query ||
          [e.category, e.description].some((x) =>
            String(x).toLowerCase().includes(query),
          )) &&
        (!category || e.category === category) &&
        (!from || e.date >= from) &&
        (!to || e.date <= to),
    );
  }
  function render() {
    const d = Spendly.getData(),
      rows = filtered(),
      total = rows.reduce((s, e) => s + Number(e.amount), 0);
    $("reportTotal").textContent = Spendly.money(total);
    $("reportAverage").textContent = Spendly.money(
      rows.length ? total / rows.length : 0,
    );
    $("reportHighest").textContent = Spendly.money(
      rows.reduce((m, e) => Math.max(m, Number(e.amount)), 0),
    );
    const totals = {};
    rows.forEach(
      (e) =>
        (totals[e.category] = (totals[e.category] || 0) + Number(e.amount)),
    );
    const max = Math.max(1, ...Object.values(totals));
    $("reportBars").innerHTML = d.categories
      .map((c) => {
        const n = totals[c.name] || 0;
        return (
          '<div class="bar-item"><strong>' +
          Spendly.money(n) +
          '</strong><div class="bar" style="height:' +
          Math.max(4, (n / max) * 148) +
          "px;background:" +
          c.color +
          '"></div><span>' +
          Spendly.escape(c.name) +
          "</span></div>"
        );
      })
      .join("");
    table.innerHTML = rows.length
      ? rows
          .slice()
          .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
          .map(
            (e) =>
              "<tr><td>" +
              Spendly.escape(e.date) +
              "</td><td>" +
              Spendly.escape(e.category) +
              "</td><td>" +
              Spendly.escape(e.description) +
              "</td><td>" +
              Spendly.money(e.amount) +
              "</td>" +
              '<td><div class="transaction-actions"><button type="button" class="table-action edit-expense" data-id="' +
              e.id +
              '">Edit</button><button type="button" class="table-action delete-expense" data-id="' +
              e.id +
              '">Delete</button></div></td></tr>',
          )
          .join("")
      : '<tr><td colspan="5" class="empty-state">No matching expenses.</td></tr>';
  }
  filters.forEach((id) =>
    $(id).addEventListener(id === "reportSearch" ? "input" : "change", render),
  );
  $("resetReportFilters").addEventListener("click", () => {
    filters.forEach((id) => ($(id).value = ""));
    render();
  });
  table.addEventListener("click", async (event) => {
    const b = event.target.closest("button[data-id]");
    if (!b) return;
    const item = Spendly.getData().expenses.find(
      (e) => String(e.id) === b.dataset.id,
    );
    if (!item) return;
    if (b.classList.contains("edit-expense")) {
      editing = item.id;
      $("expenseEditDate").value = item.date;
      $("expenseEditCategory").value = item.category;
      $("expenseEditDescription").value = item.description;
      $("expenseEditAmount").value = item.amount;
      Spendly.openModal("expenseEditModal");
      return;
    }
    if (b.classList.contains("delete-expense")) {
      if (!confirm("Delete this expense?")) return;
      const d = Spendly.getData();
      d.expenses = d.expenses.filter((e) => e.id !== item.id);
      b.disabled = true;
      try {
        await Spendly.saveData(d);
        render();
        Spendly.toast("Expense deleted");
      } catch {
        b.disabled = false;
      }
    }
  });
  $("expenseEditForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const d = Spendly.getData(),
      item = d.expenses.find((e) => e.id === editing);
    if (!item) return;
    const amount = Number($("expenseEditAmount").value);
    if (!Number.isFinite(amount) || amount <= 0)
      return Spendly.toast("Enter a positive amount", true);
    item.date = $("expenseEditDate").value;
    item.category = $("expenseEditCategory").value;
    item.description = $("expenseEditDescription").value.trim();
    item.amount = amount;
    const btn = event.target.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      await Spendly.saveData(d);
      Spendly.closeModal("expenseEditModal");
      render();
      Spendly.toast("Expense updated");
    } catch {
    } finally {
      btn.disabled = false;
    }
  });
  function exportCsv(rows, cols, name) {
    const quote = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
    const csv = [
      cols.map(quote).join(","),
      ...rows.map((r) => r.map(quote).join(",")),
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $("exportExpenses").addEventListener("click", () =>
    exportCsv(
      filtered().map((e) => [e.date, e.category, e.description, e.amount]),
      ["Date", "Category", "Description", "Amount (NPR)"],
      "spendly-expenses.csv",
    ),
  );
  $("exportIncome").addEventListener("click", () =>
    exportCsv(
      Spendly.getData().incomes.map((i) => [i.date, i.source, i.amount]),
      ["Date", "Source", "Amount (NPR)"],
      "spendly-income.csv",
    ),
  );
  render();
});
