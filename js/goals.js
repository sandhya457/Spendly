document.addEventListener("spendly:ready", () => {
  const $ = (id) => document.getElementById(id),
    list = $("goalList");
  let editing = null;
  function render() {
    const d = Spendly.getData();
    list.innerHTML = d.goals.length
      ? d.goals
          .map((g) => {
            const percentage = Math.min(
              100,
              (Number(g.saved) / Math.max(1, Number(g.target))) * 100,
            );
            return (
              '<div class="goal-card"><div class="goal-main"><h3>' +
              Spendly.escape(g.title) +
              "</h3>" +
              "<p>" +
              Spendly.money(g.saved) +
              " saved of " +
              Spendly.money(g.target) +
              " · Target " +
              Spendly.escape(g.due) +
              "</p>" +
              '<div class="goal-progress"><span style="width:' +
              percentage +
              '%"></span></div></div>' +
              '<button type="button" class="table-action update-goal" data-id="' +
              g.id +
              '">Add savings</button>' +
              '<button type="button" class="table-action delete-goal" data-id="' +
              g.id +
              '">Delete</button></div>'
            );
          })
          .join("")
      : '<div class="empty-state">No goals yet. Create one to start planning.</div>';
  }
  list.addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-id]");
    if (!b) return;
    const d = Spendly.getData(),
      g = d.goals.find((x) => String(x.id) === b.dataset.id);
    if (!g) return;
    if (b.classList.contains("update-goal")) {
      editing = g.id;
      $("goalSavingsAmount").value = "";
      $("goalSavingsTitle").textContent = "Add savings to " + g.title;
      $("goalSavingsAmount").max = String(
        Math.max(0, Number(g.target) - Number(g.saved)),
      );
      if (Number(g.saved) >= Number(g.target))
        return Spendly.toast("Goal already completed");
      Spendly.openModal("goalSavingsModal");
      return;
    }
    if (b.classList.contains("delete-goal")) {
      if (!confirm("Delete this savings goal?")) return;
      d.goals = d.goals.filter((item) => item.id !== g.id);
      b.disabled = true;
      try {
        await Spendly.saveData(d);
        render();
        Spendly.toast("Goal deleted");
      } catch {
        b.disabled = false;
      }
    }
  });
  $("goalSavingsForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Spendly.getData(),
      g = d.goals.find((x) => x.id === editing);
    if (!g) return;
    const amount = Number($("goalSavingsAmount").value);
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > Number(g.target) - Number(g.saved)
    )
      return Spendly.toast("Amount must be within the remaining target", true);
    g.saved = Math.round((Number(g.saved) + amount) * 100) / 100;
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      await Spendly.saveData(d);
      Spendly.closeModal("goalSavingsModal");
      render();
      Spendly.toast("Goal progress updated");
    } catch {
    } finally {
      btn.disabled = false;
    }
  });
  $("openGoalModal").addEventListener("click", () =>
    Spendly.openModal("goalModal"),
  );
  $("goalForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Spendly.getData(),
      target = Number($("goalTarget").value),
      saved = Number($("goalSaved").value || 0);
    if (
      !Number.isFinite(target) ||
      target <= 0 ||
      !Number.isFinite(saved) ||
      saved < 0 ||
      saved > target
    )
      return Spendly.toast("Check target and saved amounts", true);
    d.goals.push({
      id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
      title: $("goalTitle").value.trim(),
      target,
      saved,
      due: $("goalDue").value,
    });
    const btn = e.target.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      await Spendly.saveData(d);
      e.target.reset();
      Spendly.closeModal("goalModal");
      render();
      Spendly.toast("Goal created");
    } catch {
    } finally {
      btn.disabled = false;
    }
  });
  render();
});
