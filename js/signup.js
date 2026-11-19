document.addEventListener("DOMContentLoaded", async () => {
  const form = document.querySelector(".signup-form");
  const message = document.createElement("p");
  message.className = "form-feedback";
  message.setAttribute("role", "alert");
  form?.prepend(message);
  let csrf = "";
  try {
    const r = await fetch("api/index.php?action=session", {
      credentials: "same-origin",
    });
    const j = await r.json();
    csrf = j.csrf;
    if (j.authenticated) location.replace("dashboard.html");
  } catch {
    message.textContent =
      "Backend not available. Use a PHP server and configure the database.";
  }
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("fullName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;
    if (password !== document.getElementById("confirmPassword").value) {
      message.textContent = "Passwords do not match.";
      return;
    }
    if (password.length < 8) {
      message.textContent = "Use at least 8 characters for your password.";
      return;
    }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    message.textContent = "";
    try {
      const r = await fetch("api/index.php?action=register", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({ name, email, password }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Registration failed.");
      location.replace("dashboard.html");
    } catch (err) {
      message.textContent = err.message;
      btn.disabled = false;
    }
  });
});
