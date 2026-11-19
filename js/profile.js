document.addEventListener("spendly:ready", () => {
  const byId = (id) => document.getElementById(id);
  function render() {
    const p = Spendly.getData().profile;
    byId("profileAvatar").src = p.avatar;
    for (const [id, val] of Object.entries({
      profileName: p.name,
      profileEmail: p.email,
      infoName: p.name,
      infoEmail: p.email,
      infoPhone: p.phone || "—",
      infoStudentId: p.studentId || "—",
      infoCourse: p.course || "—",
      infoYear: p.year || "—",
    }))
      byId(id).textContent = val;
  }
  byId("editProfileButton").addEventListener("click", () => {
    const p = Spendly.getData().profile;
    for (const [id, key] of Object.entries({
      editName: "name",
      editEmail: "email",
      editPhone: "phone",
      editStudentId: "studentId",
      editCourse: "course",
      editYear: "year",
    }))
      byId(id).value = p[key] || "";
    Spendly.openModal("profileModal");
  });
  byId("profileForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Spendly.getData();
    for (const [id, key] of Object.entries({
      editName: "name",
      editEmail: "email",
      editPhone: "phone",
      editStudentId: "studentId",
      editCourse: "course",
      editYear: "year",
    }))
      d.profile[key] = byId(id).value.trim();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await Spendly.saveData(d);
      Spendly.closeModal("profileModal");
      render();
      Spendly.renderShell();
      Spendly.toast("Profile updated");
    } catch {
    } finally {
      btn.disabled = false;
    }
  });
  byId("cameraButton").addEventListener("click", () =>
    byId("avatarInput").click(),
  );
  byId("avatarInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 6 * 1024 * 1024
    )
      return Spendly.toast("Use PNG, JPEG or WebP under 6 MB", true);
    const image = new Image(),
      url = URL.createObjectURL(file);
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
      });
      const canvas = document.createElement("canvas"),
        ctx = canvas.getContext("2d");
      canvas.width = 320;
      canvas.height = 320;
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      ctx.drawImage(
        image,
        (image.naturalWidth - side) / 2,
        (image.naturalHeight - side) / 2,
        side,
        side,
        0,
        0,
        320,
        320,
      );
      const data = Spendly.getData();
      data.profile.avatar = canvas.toDataURL("image/jpeg", 0.75);
      await Spendly.saveData(data);
      render();
      Spendly.renderShell();
      Spendly.toast("Photo updated");
    } catch (err) {
      Spendly.toast(err.message || "Could not save image", true);
    } finally {
      URL.revokeObjectURL(url);
      e.target.value = "";
    }
  });
  byId("changeEmailButton").addEventListener("click", () => {
    byId("newEmail").value = Spendly.getData().profile.email;
    Spendly.openModal("emailModal");
  });
  byId("emailForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await Spendly.api("change-email", "POST", {
        email: byId("newEmail").value.trim(),
        current: byId("emailCurrentPassword").value,
      });
      location.reload();
    } catch (err) {
      Spendly.toast(err.message, true);
      btn.disabled = false;
    }
  });
  byId("changePasswordButton").addEventListener("click", () =>
    Spendly.openModal("passwordModal"),
  );
  byId("passwordForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fields = e.target.querySelectorAll('input[type="password"]');
    const [current, password, confirmed] = [...fields].map((x) => x.value);
    if (password !== confirmed)
      return Spendly.toast("New passwords do not match", true);
    if (password.length < 8)
      return Spendly.toast("Password must be at least 8 characters", true);
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await Spendly.api("change-password", "POST", { current, password });
      e.target.reset();
      Spendly.closeModal("passwordModal");
      Spendly.toast("Password changed");
    } catch (err) {
      Spendly.toast(err.message, true);
    } finally {
      btn.disabled = false;
    }
  });
  render();
});
