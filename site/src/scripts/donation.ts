const form = document.querySelector<HTMLFormElement>("[data-donation-form]");

if (form) {
  const customAmount = form.elements.namedItem("customAmount") as HTMLInputElement | null;
  const presetAmounts = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="donationAmount"]'));
  const feedback = form.querySelector<HTMLElement>("[data-donation-feedback]");

  presetAmounts.forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked && customAmount) customAmount.value = "";
      if (feedback) feedback.textContent = "";
    });
  });

  customAmount?.addEventListener("input", () => {
    if (customAmount.value) {
      presetAmounts.forEach((input) => {
        input.checked = false;
      });
    }
    if (feedback) feedback.textContent = "";
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const customValue = Number(customAmount?.value ?? 0);
    const selectedPreset = presetAmounts.find((input) => input.checked);
    const amount = customValue > 0 ? customValue : Number(selectedPreset?.value ?? 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      if (feedback) feedback.textContent = "Selecciona o ingresa un monto mayor a cero.";
      customAmount?.focus();
      return;
    }

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const formattedAmount = new Intl.NumberFormat("es-EC", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
    if (feedback) {
      feedback.textContent = `Demo lista: aquí continuarías al pago de USD ${formattedAmount}. No se enviaron tus datos.`;
    }
  });
}
