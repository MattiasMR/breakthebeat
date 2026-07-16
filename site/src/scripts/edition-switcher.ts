const EDITIONS = new Set(["1", "2", "3"]);
const DEFAULT_EDITION = "3";

const panels = Array.from(document.querySelectorAll<HTMLElement>("[data-edition-panel]"));
const selectors = Array.from(document.querySelectorAll<HTMLSelectElement>("[data-edition-select]"));

function editionFromUrl() {
  const requested = new URL(window.location.href).searchParams.get("edicion");
  return requested && EDITIONS.has(requested) ? requested : DEFAULT_EDITION;
}

function showEdition(editionId: string, updateUrl = true) {
  const activeId = EDITIONS.has(editionId) ? editionId : DEFAULT_EDITION;

  panels.forEach((panel) => {
    const isActive = panel.dataset.editionPanel === activeId;
    panel.hidden = !isActive;
    if (isActive) {
      panel.removeAttribute("aria-hidden");
    } else {
      panel.setAttribute("aria-hidden", "true");
    }
  });

  selectors.forEach((selector) => {
    selector.value = activeId;
  });

  document.documentElement.dataset.edition = activeId;

  const titlePanel = panels.find(
    (panel) => panel.dataset.editionPanel === activeId && panel.dataset.pageTitle
  );
  if (titlePanel?.dataset.pageTitle) {
    document.title = titlePanel.dataset.pageTitle;
  }

  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set("edicion", activeId);
    window.history.replaceState({ editionId: activeId }, "", url);
  }

  document.dispatchEvent(new CustomEvent("breakthebeat:edition-change", { detail: { editionId: activeId } }));
}

selectors.forEach((selector) => {
  selector.addEventListener("change", () => showEdition(selector.value));
});

window.addEventListener("popstate", () => showEdition(editionFromUrl(), false));

showEdition(editionFromUrl());
