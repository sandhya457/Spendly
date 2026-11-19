document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("loginForm");
  const email = document.getElementById("email");
  const password = document.getElementById("password");
  const status = document.getElementById("loginToast");
  let csrf = "";
  function notify(msg, error = true) {
    status.textContent = msg;
    status.classList.toggle("error", error);
    status.classList.add("show");
  }
  try {
    const response = await fetch("api/index.php?action=session", {
      credentials: "same-origin",
    });
    const data = await response.json();
    csrf = data.csrf || "";
    if (data.authenticated) location.replace("dashboard.html");
  } catch {
    notify("Server unavailable. Run Spendly using PHP and MySQL.");
  }
  document.getElementById("passwordToggle")?.addEventListener("click", () => {
    password.type = password.type === "password" ? "text" : "password";
  });
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      const response = await fetch("api/index.php?action=login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({
          email: email.value.trim(),
          password: password.value,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Login failed.");
      const allowed = [
        "dashboard.html",
        "add-expense.html",
        "income.html",
        "budget.html",
        "reports.html",
        "goals.html",
        "categories.html",
        "settings.html",
        "profile.html",
      ];
      const wanted = sessionStorage.getItem("spendlyRequestedPage");
      sessionStorage.removeItem("spendlyRequestedPage");
      location.replace(allowed.includes(wanted) ? wanted : "dashboard.html");
    } catch (err) {
      notify(err.message);
      btn.disabled = false;
    }
  });
  document
    .getElementById("signupButton")
    ?.addEventListener("click", () => location.assign("signup.html"));
  document
    .getElementById("forgotPassword")
    ?.addEventListener("click", (event) => {
      event.preventDefault();
      notify(
        "Password reset by email isn't configured yet. Contact the site administrator.",
      );
    });
});
