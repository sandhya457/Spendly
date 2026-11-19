document.addEventListener("spendly:ready", () => {
  const $ = (id) => document.getElementById(id);
  let vaults = [],
    editing = null,
    movement = null;
  async function load() {
    const result = await Spendly.api("vaults");
    vaults = result.vaults || [];
    const total = vaults.reduce((s, v) => s + Number(v.current_balance), 0),
      data = Spendly.getData();
    $("vaultTotal").textContent = Spendly.money(total);
    $("vaultAvailable").textContent = Spendly.money(
      Spendly.totalIncome(data) - Spendly.totalExpenses(data) - total,
    );
    $("vaultCount").textContent = String(vaults.length);
    $("vaultList").innerHTML = vaults.length
      ? vaults
          .map((v) => {
            const balance = Number(v.current_balance),
              target = Number(v.target_amount),
              progress = target ? Math.min(100, (balance / target) * 100) : 0;
            const entries = v.transactions.length
              ? v.transactions
                  .map(
                    (t) =>
                      '<div class="vault-entry"><span class="vault-entry-kind ' +
                      t.kind +
                      '">' +
                      (t.kind === "deposit" ? "+" : "−") +
                      "</span><div><strong>" +
                      (t.kind === "deposit" ? "Deposit" : "Withdrawal") +
                      "</strong><small>" +
                      Spendly.escape(t.note || t.created_at) +
                      "</small></div><strong>" +
                      (t.kind === "deposit" ? "+" : "−") +
                      Spendly.money(t.amount) +
                      "</strong></div>",
                  )
                  .join("")
              : '<div class="empty-state">No transactions yet.</div>';
            return (
              '<article class="card vault-card"><div class="vault-card-top"><span class="vault-symbol">◈</span><span class="vault-options">PERSONAL VAULT</span></div><h2>' +
              Spendly.escape(v.name) +
              '</h2><p class="vault-current">' +
              Spendly.money(balance) +
              '</p><p class="vault-target">' +
              (target
                ? "of " + Spendly.money(target) + " target"
                : "No target set") +
              '</p><div class="vault-progress"><span style="width:' +
              progress +
              '%"></span></div><div class="vault-buttons"><button class="primary-button" data-action="deposit" data-id="' +
              v.id +
              '">Deposit</button><button class="secondary-button" data-action="withdraw" data-id="' +
              v.id +
              '">Withdraw</button></div><div class="vault-manage"><button type="button" data-edit="' +
              v.id +
              '">Edit</button><button type="button" data-archive="' +
              v.id +
              '">Archive</button></div><details class="vault-history"><summary>Recent activity (' +
              v.transactions.length +
              ')</summary><div class="vault-history-list">' +
              entries +
              "</div></details></article>"
            );
          })
          .join("")
      : '<div class="card vault-empty"><span class="vault-symbol">◈</span><h2>Make room for something important.</h2><p>Create a vault for an emergency fund, a laptop or your next semester.</p><button class="primary-button" id="emptyCreate">Create your first vault</button></div>';
    $("emptyCreate")?.addEventListener("click", create);
  }
  function create() {
    editing = null;
    $("vaultForm").reset();
    $("vaultTarget").value = "0";
    $("vaultModalTitle").textContent = "Create vault";
    $("vaultSubmit").textContent = "Create vault";
    Spendly.openModal("vaultModal");
  }
  $("newVault").addEventListener("click", create);
  $("vaultList").addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.action) {
      const v = vaults.find((x) => String(x.id) === b.dataset.id);
      if (!v) return;
      movement = { id: v.id, kind: b.dataset.action };
      $("vaultActionForm").reset();
      $("vaultActionTitle").textContent =
        (movement.kind === "deposit" ? "Deposit into " : "Withdraw from ") +
        v.name;
      $("vaultActionDetail").textContent =
        "Current balance: " + Spendly.money(v.current_balance);
      $("vaultActionSubmit").textContent =
        movement.kind === "deposit" ? "Deposit funds" : "Withdraw funds";
      Spendly.openModal("vaultActionModal");
    }
    if (b.dataset.edit) {
      const v = vaults.find((x) => String(x.id) === b.dataset.edit);
      if (!v) return;
      editing = v.id;
      $("vaultName").value = v.name;
      $("vaultTarget").value = v.target_amount;
      $("vaultModalTitle").textContent = "Edit vault";
      $("vaultSubmit").textContent = "Save changes";
      Spendly.openModal("vaultModal");
    }
    if (b.dataset.archive) {
      const v = vaults.find((x) => String(x.id) === b.dataset.archive);
      if (!v || !confirm('Archive "' + v.name + '"? Its balance must be zero.'))
        return;
      b.disabled = true;
      try {
        await Spendly.api("vault-archive", "POST", { id: v.id });
        await load();
        Spendly.toast("Vault archived");
      } catch (err) {
        Spendly.toast(err.message, true);
        b.disabled = false;
      }
    }
  });
  $("vaultForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const b = $("vaultSubmit");
    b.disabled = true;
    try {
      const data = {
        name: $("vaultName").value.trim(),
        target: Number($("vaultTarget").value || 0),
      };
      await Spendly.api(
        editing ? "vault-update" : "vault-create",
        "POST",
        editing ? { ...data, id: editing } : data,
      );
      Spendly.closeModal("vaultModal");
      await load();
      Spendly.toast(editing ? "Vault updated" : "Vault created");
    } catch (err) {
      Spendly.toast(err.message, true);
    } finally {
      b.disabled = false;
    }
  });
  $("vaultActionForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!movement) return;
    const b = $("vaultActionSubmit");
    b.disabled = true;
    try {
      await Spendly.api("vault-action", "POST", {
        ...movement,
        amount: Number($("vaultAmount").value),
        note: $("vaultNote").value.trim(),
      });
      Spendly.closeModal("vaultActionModal");
      await load();
      Spendly.toast("Vault transaction recorded");
    } catch (err) {
      Spendly.toast(err.message, true);
    } finally {
      b.disabled = false;
    }
  });
  load().catch((err) => {
    $("vaultList").innerHTML =
      '<div class="load-error">' + Spendly.escape(err.message) + "</div>";
  });
});
