document.addEventListener("spendly:ready", () => {
  const d = Spendly.getData();
  const spent = Spendly.totalExpenses(d);
  const monthly = Spendly.monthEntries(d.expenses);
  const monthSpend = monthly.reduce((n, x) => n + Number(x.amount), 0);
  const totalIncome = Spendly.totalIncome(d);
  const set = (id, text) => {
    const n = document.getElementById(id);
    if (n) n.textContent = text;
  };
  set("totalBalance", Spendly.money(totalIncome - spent));
  Spendly.api("vaults")
    .then((reply) => {
      const sum = (reply.vaults || []).reduce(
        (s, v) => s + Number(v.current_balance),
        0,
      );
      set("dashboardVaultTotal", Spendly.money(sum));
      set("totalBalance", Spendly.money(totalIncome - spent - sum));
    })
    .catch((err) => Spendly.toast(err.message, true));
  set("totalBudget", Spendly.money(d.budget.total));
  set("totalBudgetCopy", Spendly.money(d.budget.total));
  set("totalExpense", Spendly.money(spent));
  set("monthExpense", Spendly.money(monthSpend));
  set("budgetSpent", Spendly.money(monthSpend));
  set(
    "budgetRemaining",
    Spendly.money(Math.max(0, d.budget.total - monthSpend)),
  );
  set("dailyAverage", Spendly.money(monthSpend / new Date().getDate()));
  const progress = document.getElementById("budgetFill");
  if (progress)
    progress.style.width =
      (d.budget.total
        ? Math.min(100, (monthSpend / d.budget.total) * 100)
        : 0) + "%";
  const list = document.getElementById("recentTransactions");
  list.innerHTML = d.expenses.length
    ? d.expenses
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
        .slice(0, 5)
        .map(
          (x) =>
            '<div class="transaction"><span class="transaction-icon" style="background:' +
            Spendly.categoryColor(x.category, d) +
            '">' +
            Spendly.escape(x.category[0]) +
            "</span>" +
            "<div><h4>" +
            Spendly.escape(x.description || x.category) +
            "</h4><p>" +
            Spendly.escape(x.category) +
            " · " +
            Spendly.escape(x.date) +
            "</p></div>" +
            "<strong>−" +
            Spendly.money(x.amount) +
            "</strong></div>",
        )
        .join("")
    : '<div class="empty-state">No expenses yet. <a href="add-expense.html">Add your first expense</a>.</div>';
  const totals = {};
  monthly.forEach(
    (x) => (totals[x.category] = (totals[x.category] || 0) + Number(x.amount)),
  );
  const legend = document.getElementById("categoryLegend");
  legend.innerHTML = d.categories
    .map(
      (c) =>
        '<div class="legend-row"><span class="small-dot" style="background:' +
        c.color +
        '"></span>' +
        "<span>" +
        Spendly.escape(c.name) +
        "</span><strong>" +
        Spendly.money(totals[c.name] || 0) +
        "</strong></div>",
    )
    .join("");
  const donut = document.querySelector(".category-donut");
  if (donut) {
    let sum = 0;
    const portions = d.categories
      .filter((c) => (totals[c.name] || 0) > 0)
      .map((c) => {
        const start = sum;
        sum += (totals[c.name] / Math.max(1, monthSpend)) * 100;
        return c.color + " " + start.toFixed(1) + "% " + sum.toFixed(1) + "%";
      });
    donut.style.background = portions.length
      ? "conic-gradient(" + portions.join(",") + ")"
      : "conic-gradient(#e9eaf0 0% 100%)";
  }
  const chart = document.querySelector(".line-chart");
  if (chart) {
    const today = new Date(),
      y = today.getFullYear(),
      m = today.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    const values = Array.from({ length: last }, (_, i) =>
      monthly
        .filter((x) => Number(x.date.slice(8, 10)) === i + 1)
        .reduce((n, x) => n + Number(x.amount), 0),
    );
    const mx = Math.max(1, ...values),
      points = values
        .map(
          (v, i) =>
            (50 + (420 * i) / Math.max(1, last - 1)).toFixed(1) +
            "," +
            (185 - (v / mx) * 145).toFixed(1),
        )
        .join(" ");
    chart.innerHTML =
      '<line x1="45" y1="40" x2="475" y2="40" class="grid-line"/><line x1="45" y1="112" x2="475" y2="112" class="grid-line"/><line x1="45" y1="185" x2="475" y2="185" class="grid-line"/>' +
      '<polyline class="expense-line" points="' +
      points +
      '" fill="none" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<text x="45" y="205">1 ' +
      today.toLocaleString("en", { month: "short" }) +
      '</text><text x="425" y="205">' +
      last +
      " " +
      today.toLocaleString("en", { month: "short" }) +
      "</text>";
  }
});
