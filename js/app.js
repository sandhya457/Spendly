/* Spendly application client. No localStorage authentication or fake seed data. */
const Spendly = (() => {
  let snapshot = null,
    revision = 0,
    token = "",
    account = null;
  const navItems = [
    ["dashboard", "Overview", "dashboard.html", "▦"],
    ["add-expense", "Add expense", "add-expense.html", "↗"],
    ["income", "Add income", "income.html", "↙"],
    ["budget", "Budgets", "budget.html", "◫"],
    ["reports", "Reports", "reports.html", "▥"],
    // ["goals", "Savings goals", "goals.html", "◎"],
    // ["vault", "Savings vaults", "vault.html", "◈"],
    ["categories", "Categories", "categories.html", "▤"],
    ["settings", "Settings", "settings.html", "⚙"],
  ];
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const escape = (x) =>
    String(x ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  function today() {
    const d = new Date();
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }
  function money(value) {
    return (
      "Rs. " +
      Number(value || 0).toLocaleString("en-NP", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }
  function totalExpenses(data = getData()) {
    return data.expenses.reduce((n, e) => n + Number(e.amount), 0);
  }
  function totalIncome(data = getData()) {
    return data.incomes.reduce((n, i) => n + Number(i.amount), 0);
  }
  function monthEntries(entries) {
    // en-CA may vary by browser; construct the date in local time instead.
    const d = new Date(),
      month = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    return entries.filter((e) => e.date?.startsWith(month));
  }
  function categoryColor(name, data = getData()) {
    return data.categories.find((x) => x.name === name)?.color || "#7b8493";
  }
  function toast(message, isError = false) {
    let n = document.getElementById("toast");
    if (!n) {
      n = document.createElement("div");
      n.id = "toast";
      n.className = "toast";
      document.body.append(n);
    }
    n.textContent = message;
    n.classList.toggle("error", isError);
    n.classList.add("show");
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => n.classList.remove("show"), 4200);
  }
  async function api(action, method = "GET", value) {
    const options = {
      method,
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    };
    if (method !== "GET") {
      options.headers["Content-Type"] = "application/json";
      options.headers["X-CSRF-Token"] = token;
      options.body = JSON.stringify(value ?? {});
    }
    let response;
    try {
      response = await fetch(
        "api/index.php?action=" + encodeURIComponent(action),
        options,
      );
    } catch {
      throw new Error(
        "Cannot reach Spendly server. Check your PHP/MySQL setup.",
      );
    }
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error(
        "Unexpected server response. Run the site through PHP, not Live Server.",
      );
    }
    if (!response.ok) {
      if (response.status === 401 && action !== "login")
        location.replace("login.html");
      throw new Error(result.error || "Request failed.");
    }
    return result;
  }
  function getData() {
    if (!snapshot) throw new Error("Data has not loaded.");
    return clone(snapshot);
  }
  async function saveData(data) {
    try {
      const result = await api("data", "PUT", { data, version: revision });
      snapshot = clone(data);
      revision = result.version;
      document.body.classList.toggle("dark-mode", !!data.settings.darkMode);
      return true;
    } catch (err) {
      toast(err.message, true);
      // Avoid displaying unsaved state after an API failure.
      throw err;
    }
  }
  function openModal(id) {
    document.getElementById(id)?.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeModal(id) {
    document.getElementById(id)?.classList.remove("open");
    document.body.style.overflow = "";
  }
  function setupModalEvents() {
    document
      .querySelectorAll("[data-close-modal]")
      .forEach((b) =>
        b.addEventListener("click", () => closeModal(b.dataset.closeModal)),
      );
    document.querySelectorAll(".modal-backdrop").forEach((b) =>
      b.addEventListener("click", (e) => {
        if (e.target === b) closeModal(b.id);
      }),
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape")
        document
          .querySelectorAll(".modal-backdrop.open")
          .forEach((m) => closeModal(m.id));
    });
  }
  function renderShell() {
    const page = document.body.dataset.page,
      data = getData();
    document.body.classList.toggle("dark-mode", !!data.settings.darkMode);
    const sidebar = document.getElementById("sidebarMount");
    const topbar = document.getElementById("topbarMount");
    if (!sidebar || !topbar) return;
    sidebar.innerHTML =
      '<aside class="sidebar" id="sidebar">' +
      '<a class="sidebar-brand" href="dashboard.html"><span class="brand-mark">S</span>Spendly</a>' +
      '<p class="sidebar-label">WORKSPACE</p><nav class="sidebar-nav">' +
      navItems
        .map(
          ([key, label, href, ico]) =>
            '<a class="sidebar-link ' +
            (page === key ? "active" : "") +
            '" href="' +
            href +
            '"><span class="nav-glyph" aria-hidden="true">' +
            ico +
            "</span><span>" +
            label +
            "</span></a>",
        )
        .join("") +
      '<button class="logout-link" id="logoutButton"><span class="nav-glyph">↪</span><span>Sign out</span></button></nav>' +
      '<div class="sidebar-note">A clearer picture of your money.<small>© 2026 Spendly</small></div></aside>';
    const h = new Date().getHours();
    const greet =
      h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
    topbar.innerHTML =
      '<header class="topbar"><div class="topbar-actions">' +
      '<button class="menu-button" id="menuButton" aria-label="Open navigation">☰</button>' +
      '<div class="greeting"><strong>' +
      greet +
      ", " +
      escape(data.profile.name.split(" ")[0]) +
      "</strong><span>Manage your money with confidence</span></div></div>" +
      '<div class="topbar-actions"><span class="currency-chip">NPR · Nepalese Rupee</span>' +
      '<div class="top-user"><button class="top-user-button" id="topUserButton" aria-expanded="false">' +
      '<img src="' +
      escape(data.profile.avatar) +
      '" alt=""><span>' +
      escape(data.profile.name) +
      '</span><span class="chevron">⌄</span></button>' +
      '<div class="user-dropdown" id="userDropdown"><a href="profile.html">My profile</a><a href="settings.html">Settings</a><button id="dropdownLogout">Sign out</button></div></div></div></header>';
    document
      .getElementById("menuButton")
      ?.addEventListener("click", () =>
        document.getElementById("sidebar")?.classList.toggle("open"),
      );
    document.getElementById("topUserButton")?.addEventListener("click", (e) => {
      e.stopPropagation();
      document.getElementById("userDropdown")?.classList.toggle("open");
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".top-user"))
        document.getElementById("userDropdown")?.classList.remove("open");
    });
    document.getElementById("logoutButton")?.addEventListener("click", logout);
    document
      .getElementById("dropdownLogout")
      ?.addEventListener("click", logout);
  }
  async function logout() {
    try {
      await api("logout", "POST", {});
    } finally {
      location.replace("login.html");
    }
  }
  async function init() {
    try {
      const session = await api("session");
      token = session.csrf;
      account = session.user;
      if (!session.authenticated) {
        sessionStorage.setItem(
          "spendlyRequestedPage",
          location.pathname.split("/").pop(),
        );
        location.replace("login.html");
        return;
      }
      const response = await api("data");
      snapshot = response.data;
      revision = response.version;
      renderShell();
      setupModalEvents();
      document.dispatchEvent(new Event("spendly:ready"));
    } catch (err) {
      console.error(err);
      const area = document.querySelector(".page-content") || document.body;
      area.insertAdjacentHTML(
        "afterbegin",
        '<div class="load-error" role="alert">' +
          escape(err.message) +
          ' <a href="index.html">Return home</a></div>',
      );
    }
  }
  document.addEventListener("DOMContentLoaded", init);
  return {
    api,
    getData,
    saveData,
    money,
    today,
    totalExpenses,
    totalIncome,
    monthEntries,
    categoryColor,
    toast,
    openModal,
    closeModal,
    renderShell,
    escape,
    logout,
  };
})();
