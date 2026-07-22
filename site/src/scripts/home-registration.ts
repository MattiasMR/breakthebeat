const dialog = document.querySelector<HTMLDialogElement>("[data-registration-dialog]");
const openers = document.querySelectorAll<HTMLAnchorElement>("[data-registration-open]");

if (dialog) {
  const closeButton = dialog.querySelector<HTMLButtonElement>("[data-registration-close]");
  const openDialog = (event: Event) => {
    if (typeof dialog.showModal !== "function") return;
    event.preventDefault();
    if (!dialog.open) dialog.showModal();
    document.documentElement.classList.add("has-registration-dialog");
    dialog.querySelector<HTMLElement>(".home-registration-dialog-scroll")?.scrollTo({ top: 0 });
    closeButton?.focus();
  };

  openers.forEach((opener) => opener.addEventListener("click", openDialog));
  closeButton?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => document.documentElement.classList.remove("has-registration-dialog"));
}
