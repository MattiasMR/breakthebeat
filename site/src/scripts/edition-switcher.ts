const editionPanels = Array.from(document.querySelectorAll<HTMLElement>("[data-home-edition-panel]"));
const editionOptions = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-home-edition-option]"));
const editionStage = document.querySelector<HTMLElement>("[data-home-edition-transition]");
const infoTabs = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-home-info-tab]"));
const infoPanes = Array.from(document.querySelectorAll<HTMLElement>("[data-home-info-pane]"));

const editionIds = new Set(editionOptions.map((option) => option.dataset.homeEditionOption ?? ""));
const defaultEdition = editionOptions.find((option) => option.getAttribute("aria-selected") === "true")
  ?.dataset.homeEditionOption ?? "3";
const fadeOutMs = 150;
let activeEdition = defaultEdition;
let transitionTimer: number | undefined;

function editionFromUrl() {
  const requested = new URL(window.location.href).searchParams.get("edicion");
  return requested && editionIds.has(requested) ? requested : defaultEdition;
}

function renderEdition(editionId: string, moveIntoView = false) {
  editionPanels.forEach((panel) => {
    const isActive = panel.dataset.homeEditionPanel === editionId;
    panel.hidden = !isActive;
    panel.setAttribute("aria-hidden", String(!isActive));
  });

  editionOptions.forEach((option) => {
    const isActive = option.dataset.homeEditionOption === editionId;
    option.setAttribute("aria-selected", String(isActive));
    option.tabIndex = isActive ? 0 : -1;

    if (isActive && moveIntoView) {
      option.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  });

  document.documentElement.dataset.edition = editionId;

  const activePanel = editionPanels.find((panel) => panel.dataset.homeEditionPanel === editionId);
  if (activePanel?.dataset.pageTitle) document.title = activePanel.dataset.pageTitle;

  activeEdition = editionId;
  document.dispatchEvent(new CustomEvent("breakthebeat:edition-change", { detail: { editionId } }));
}

function showEdition(editionId: string, updateUrl = true, animate = true, moveIntoView = true) {
  const nextEdition = editionIds.has(editionId) ? editionId : defaultEdition;

  if (updateUrl) {
    const url = new URL(window.location.href);
    if (nextEdition === defaultEdition) {
      url.searchParams.delete("edicion");
    } else {
      url.searchParams.set("edicion", nextEdition);
    }
    window.history.replaceState({ editionId: nextEdition }, "", url);
  }

  if (!animate || nextEdition === activeEdition || !editionStage) {
    if (transitionTimer) window.clearTimeout(transitionTimer);
    transitionTimer = undefined;
    editionStage?.classList.remove("is-edition-fading");
    editionStage?.removeAttribute("aria-busy");
    renderEdition(nextEdition, moveIntoView);
    return;
  }

  if (transitionTimer) window.clearTimeout(transitionTimer);
  editionStage.classList.add("is-edition-fading");
  editionStage.setAttribute("aria-busy", "true");

  transitionTimer = window.setTimeout(() => {
    renderEdition(nextEdition, moveIntoView);
    window.requestAnimationFrame(() => {
      editionStage.classList.remove("is-edition-fading");
      editionStage.removeAttribute("aria-busy");
    });
    transitionTimer = undefined;
  }, fadeOutMs);
}

editionOptions.forEach((option, index) => {
  option.addEventListener("click", () => showEdition(option.dataset.homeEditionOption ?? defaultEdition));
  option.addEventListener("keydown", (event) => {
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % editionOptions.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + editionOptions.length) % editionOptions.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = editionOptions.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    const nextOption = editionOptions[nextIndex];
    nextOption.focus();
    showEdition(nextOption.dataset.homeEditionOption ?? defaultEdition);
  });
});

function showInfoPane(name: string, updateUrl = true) {
  const nextName = name === "rules" ? "rules" : "event";

  infoTabs.forEach((tab) => {
    const isActive = tab.dataset.homeInfoTab === nextName;
    tab.setAttribute("aria-selected", String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
  });

  infoPanes.forEach((pane) => {
    const isActive = pane.dataset.homeInfoPane === nextName;
    pane.hidden = !isActive;
    pane.setAttribute("aria-hidden", String(!isActive));
  });

  if (updateUrl) {
    const url = new URL(window.location.href);
    url.hash = nextName === "rules" ? "reglas" : "informacion";
    window.history.replaceState(window.history.state, "", url);
  }
}

infoTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => showInfoPane(tab.dataset.homeInfoTab ?? "event"));
  tab.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextTab = infoTabs[(index + direction + infoTabs.length) % infoTabs.length];
    nextTab.focus();
    showInfoPane(nextTab.dataset.homeInfoTab ?? "event");
  });
});

window.addEventListener("popstate", () => {
  showEdition(editionFromUrl(), false);
  showInfoPane(window.location.hash === "#reglas" ? "rules" : "event", false);
});

window.addEventListener("hashchange", () => {
  showInfoPane(window.location.hash === "#reglas" ? "rules" : "event", false);
});

showEdition(editionFromUrl(), false, false, false);
showInfoPane(window.location.hash === "#reglas" ? "rules" : "event", false);
