(() => {
  // Where the email-app fallback sends form submissions.
  const TO_EMAIL = "cleo@cleovalentinebuilds.com";

  const form = document.getElementById("contact-form");
  if (!form) return;
  const status = form.querySelector(".form__status");
  const note = form.querySelector("[data-form-note]");
  const submit = form.querySelector("[type=submit]");

  // The form posts to Formspree once a real endpoint is pasted into its action attribute;
  // until then (or if Formspree fails) it falls back to opening the visitor's email app.
  const endpoint = form.getAttribute("action") || "";
  const useFormspree = /^https:\/\/formspree\.io\//.test(endpoint);
  if (useFormspree && note) note.textContent = "I usually reply within one business day.";

  function openMailto(fields) {
    const body = [
      `Name: ${fields.name}`,
      `Email: ${fields.email}`,
      `Phone: ${fields.phone || "-"}`,
      `Town: ${fields.town || "-"}`,
      `Job size: ${fields.size || "-"}`,
      `Timeframe: ${fields.timeframe || "-"}`,
      `Services: ${fields.services || "-"}`,
      "",
      fields.message,
    ].join("\n");
    const subject = `Project inquiry from ${fields.name}`;
    window.location.href = `mailto:${TO_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    status.textContent = "Opening your email app. Thanks for reaching out!";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const get = (k) => (data.get(k) || "").trim();
    const fields = {
      name: get("name"),
      email: get("email"),
      phone: get("phone"),
      town: get("town"),
      size: get("size"),
      timeframe: get("timeframe"),
      services: data.getAll("service").join(", "),
      message: get("message"),
    };

    if (!fields.name || !fields.email || !fields.message) {
      status.textContent = "Please add your name, email, and a few words about the project.";
      form.querySelector(":invalid, input:placeholder-shown[required], textarea:placeholder-shown[required]")?.focus();
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(fields.email)) {
      status.textContent = "That email address doesn't look quite right.";
      form.email.focus();
      return;
    }

    if (!useFormspree) return openMailto(fields);

    // Send checked services as one readable field instead of repeated keys
    data.delete("service");
    data.set("services", fields.services || "-");
    submit.disabled = true;
    status.textContent = "Sending…";
    try {
      const res = await fetch(endpoint, { method: "POST", body: data, headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`Formspree responded ${res.status}`);
      form.reset();
      status.textContent = "Thanks! Your request was sent. I'll be in touch soon.";
    } catch {
      openMailto(fields);
    } finally {
      submit.disabled = false;
    }
  });
})();
