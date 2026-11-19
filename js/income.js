document.addEventListener("spendly:ready", () => {
  const form = document.getElementById("incomeForm"),
    date = document.getElementById("incomeDate"),
    table = document.getElementById("incomeTable"),
    source = document.getElementById("incomeSource"),
    amountInput = document.getElementById("incomeAmount"),
    save = document.getElementById("incomeSave"),
    cancel = document.getElementById("cancelIncomeEdit");
  let editing = null;
  function resetForm() {
    editing = null;
    form.reset();
    date.value = Spendly.today();
    save.textContent = "Save income";
    cancel.hidden = true;
  }
  cancel.addEventListener("click", resetForm);
  function render() {
    const d = Spendly.getData();
    table.innerHTML = d.incomes.length
      ? d.incomes
          .slice()
          .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
          .map(
            (i) =>
              "<tr><td>" +
              Spendly.escape(i.date) +
              "</td><td>" +
              Spendly.escape(i.source) +
              "</td><td>" +
              Spendly.money(i.amount) +
              "</td>" +
              '<td><div class="transaction-actions"><button type="button" class="table-action edit-income" data-id="' +
              i.id +
              '">Edit</button><button type="button" class="table-action remove-income" data-id="' +
              i.id +
              '">Delete</button></div></td></tr>',
          )
          .join("")
      : '<tr><td colspan="4" class="empty-state">No income recorded yet.</td></tr>';
  }
  table.addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-id]");
    if (!b) return;
    const d = Spendly.getData(),
      entry = d.incomes.find((i) => String(i.id) === b.dataset.id);
    if (!entry) return;
    if (b.classList.contains("edit-income")) {
      editing = entry.id;
      date.value = entry.date;
      source.value = entry.source;
      amountInput.value = entry.amount;
      save.textContent = "Update income";
      cancel.hidden = false;
      form.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (b.classList.contains("remove-income")) {
      if (!confirm("Delete this income entry?")) return;
      d.incomes = d.incomes.filter((i) => i.id !== entry.id);
      b.disabled = true;
      try {
        await Spendly.saveData(d);
        if (editing === entry.id) resetForm();
        render();
        Spendly.toast("Income removed");
      } catch {
        b.disabled = false;
      }
    }
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const amount = Number(amountInput.value),
      name = source.value.trim();
    if (!name || !Number.isFinite(amount) || amount <= 0)
      return Spendly.toast("Enter a source and positive amount", true);
    const d = Spendly.getData();
    if (editing !== null) {
      const entry = d.incomes.find((i) => i.id === editing);
      if (!entry) return Spendly.toast("The entry no longer exists", true);
      entry.date = date.value;
      entry.source = name;
      entry.amount = amount;
    } else
      d.incomes.push({
        id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
        date: date.value,
        source: name,
        amount,
      });
    save.disabled = true;
    try {
      await Spendly.saveData(d);
      resetForm();
      render();
      Spendly.toast("Income saved");
    } catch {
    } finally {
      save.disabled = false;
    }
  });
  resetForm();
  render();
});
