const EDITIONS = new Set(["1", "2", "3"]);
const DEFAULT_EDITION = "3";
const FADE_OUT_MS = 130;

const panels = Array.from(document.querySelectorAll<HTMLElement>("[data-edition-panel]"));
const selectors = Array.from(document.querySelectorAll<HTMLSelectElement>("[data-edition-select]"));
const transitionGroups = Array.from(document.querySelectorAll<HTMLElement>("[data-edition-transition]"));
let activeEdition = document.documentElement.dataset.edition ?? DEFAULT_EDITION;
let transitionTimer: number | undefined;

function editionFromUrl() {
  const requested = new URL(window.location.href).searchParams.get("edicion");
  return requested && EDITIONS.has(requested) ? requested : DEFAULT_EDITION;
}

function renderEdition(activeId: string) {
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

  activeEdition = activeId;
  document.dispatchEvent(new CustomEvent("breakthebeat:edition-change", { detail: { editionId: activeId } }));
}

function showEdition(editionId: string, updateUrl = true, animate = true) {
  const activeId = EDITIONS.has(editionId) ? editionId : DEFAULT_EDITION;

  selectors.forEach((selector) => {
    selector.value = activeId;
  });

  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set("edicion", activeId);
    window.history.replaceState({ editionId: activeId }, "", url);
  }

  if (!animate || activeId === activeEdition || transitionGroups.length === 0) {
    if (transitionTimer) window.clearTimeout(transitionTimer);
    transitionTimer = undefined;
    transitionGroups.forEach((group) => {
      group.classList.remove("is-edition-fading");
      group.removeAttribute("aria-busy");
    });
    renderEdition(activeId);
    return;
  }

  if (transitionTimer) window.clearTimeout(transitionTimer);
  transitionGroups.forEach((group) => {
    group.classList.add("is-edition-fading");
    group.setAttribute("aria-busy", "true");
  });

  transitionTimer = window.setTimeout(() => {
    renderEdition(activeId);
    window.requestAnimationFrame(() => {
      transitionGroups.forEach((group) => {
        group.classList.remove("is-edition-fading");
        group.removeAttribute("aria-busy");
      });
    });
    transitionTimer = undefined;
  }, FADE_OUT_MS);
}

selectors.forEach((selector) => {
  selector.addEventListener("change", () => showEdition(selector.value));
});

window.addEventListener("popstate", () => showEdition(editionFromUrl(), false));

showEdition(editionFromUrl(), false, false);
