const copyButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-copy-value]"));
const feedback = document.querySelector<HTMLElement>("[data-donation-feedback]");

const copyText = async (value: string) => {
  if (!navigator.clipboard || !window.isSecureContext) {
    throw new Error("El portapapeles no está disponible");
  }

  await Promise.race([
    navigator.clipboard.writeText(value),
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error("El portapapeles no respondió")), 2000);
    })
  ]);
};

copyButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const value = button.dataset.copyValue;
    const name = button.dataset.copyName ?? "Dato";
    const label = button.querySelector<HTMLElement>("[data-copy-button-label]");
    const idleLabel = label?.textContent ?? "Copiar";

    if (!value) return;

    try {
      await copyText(value);
      if (label) label.textContent = "Copiado";
      if (feedback) feedback.textContent = `${name} copiado. Ahora abre la aplicación de tu banco.`;

      window.setTimeout(() => {
        if (label) label.textContent = idleLabel;
      }, 1800);
    } catch {
      if (feedback) {
        feedback.textContent = "No se pudo copiar automáticamente. Mantén presionado el dato para copiarlo.";
      }
    }
  });
});
