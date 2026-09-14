(() => {
  // Where form submissions are sent. Replace with your real address.
  const TO_EMAIL = "[Email Address]";

  const form = document.getElementById("contact-form");
  if (!form) return;
  const status = form.querySelector(".form__status");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const name = (data.get("name") || "").trim();
    const email = (data.get("email") || "").trim();
    const message = (data.get("message") || "").trim();

    if (!name || !email || !message) {
      status.textContent = "Please add your name, email, and a few words about the project.";
      form.querySelector(":invalid, input:placeholder-shown[required], textarea:placeholder-shown[required]")?.focus();
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      status.textContent = "That email address doesn't look quite right.";
      form.email.focus();
      return;
    }

    const services = data.getAll("service");
    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${data.get("phone") || "-"}`,
      `Town: ${data.get("town") || "-"}`,
      `Services: ${services.length ? services.join(", ") : "-"}`,
      "",
      message,
    ].join("\n");

    const subject = `Project inquiry from ${name}`;
    window.location.href = `mailto:${TO_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    status.textContent = "Opening your email app. Thanks for reaching out!";
  });
})();
