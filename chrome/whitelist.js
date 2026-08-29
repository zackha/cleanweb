let domains = [];
let kosherDomains = [];
let kosherEditable = false;
let query = "";
const isBlockedList = window.location.hash === "#blocked";
const domainKey = isBlockedList ? "blockedDomains" : "ignoredDomains";
let listName = isBlockedList ? "Custom Blocked Sites" : "Allowed Sites";

document.addEventListener("DOMContentLoaded", init);

async function init() {
  applyTheme(await getLocal("theme"));
  const settings = await getSync("settings");
  updateBlockedMode(settings);
  domains = Array.isArray(settings?.[domainKey]) ? [...settings[domainKey]] : [];
  kosherDomains = Array.isArray(settings?.kosherDomains)
    ? [...settings.kosherDomains]
    : [...KOSHER_BLOCKED_DOMAINS];
  render();
  bindEvents();
}

function bindEvents() {
  const searchInput = $("searchInput");
  const searchClear = $("searchClear");
  const addInput = $("addInput");
  const addBtn = $("addBtn");

  window.addEventListener("scroll", () => {
    $("nav").toggleAttribute("data-scrolled", window.scrollY > 2);
  }, { passive: true });

  searchInput.addEventListener("input", () => {
    query = searchInput.value.trim().toLowerCase();
    searchClear.classList.toggle("visible", !!query);
    render();
  });

  searchClear.addEventListener("click", () => {
    searchInput.value = "";
    query = "";
    searchClear.classList.remove("visible");
    searchInput.focus();
    render();
  });

  addInput.addEventListener("input", () => {
    addBtn.disabled = !addInput.value.trim();
    $("errorMsg").textContent = "";
  });

  addInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !addBtn.disabled) addDomain();
  });

  addBtn.addEventListener("click", addDomain);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.settings) {
      updateBlockedMode(changes.settings.newValue);
      domains = Array.isArray(changes.settings.newValue?.[domainKey])
        ? [...changes.settings.newValue[domainKey]]
        : [];
      kosherDomains = Array.isArray(changes.settings.newValue?.kosherDomains)
        ? [...changes.settings.newValue.kosherDomains]
        : [...KOSHER_BLOCKED_DOMAINS];
      render();
    }
  });
}

async function addDomain() {
  const raw = $("addInput").value.trim().toLowerCase();
  const domain = raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!domain) return;

  if (
    isBlockedList &&
    !kosherEditable &&
    KOSHER_BLOCKED_DOMAINS.includes(domain)
  ) {
    $("errorMsg").textContent = `"${domain}" is always blocked.`;
    return;
  }

  if (getVisibleDomains().includes(domain)) {
    $("errorMsg").textContent = `"${domain}" is already in the list.`;
    return;
  }

  domains = [...domains, domain].sort();
  $("addInput").value = "";
  $("addBtn").disabled = true;
  $("errorMsg").textContent = "";
  await save();
  render();
}

async function removeDomain(domain) {
  if (kosherEditable && kosherDomains.includes(domain)) {
    kosherDomains = kosherDomains.filter((item) => item !== domain);
  } else {
    domains = domains.filter((item) => item !== domain);
  }
  await save();
  render();
}

async function save() {
  const settings = (await getSync("settings")) || {};
  await setSync({
    settings: {
      ...settings,
      [domainKey]: domains,
      kosherDomains,
    },
  });
}

function render() {
  const visibleDomains = getVisibleDomains();
  const filtered = query
    ? visibleDomains.filter((domain) => domain.includes(query))
    : visibleDomains;

  $("navCount").textContent = visibleDomains.length
    ? `${visibleDomains.length} site${visibleDomains.length === 1 ? "" : "s"}`
    : "";

  $("listTitle").textContent = query ? "Results" : "Domains";

  const group = $("listGroup");
  group.innerHTML = "";

  if (!visibleDomains.length) {
    group.innerHTML = `
      <div class="empty">
        <div class="empty-icon-wrap">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2 3 6v6c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V6L12 2Zm-1 13-3-3 1.41-1.41L11 12.17l4.59-4.58L17 9l-6 6Z"/>
          </svg>
        </div>
        <p class="empty-title">No ${isBlockedList ? "blocked" : "allowed"} sites</p>
        <p class="empty-body">${isBlockedList ? "Add a domain above to block it." : "All sites are currently protected.<br>Add a domain above to allow it."}</p>
      </div>`;
    return;
  }

  if (query && !filtered.length) {
    const noResults = document.createElement("div");
    noResults.className = "no-results";
    noResults.appendChild(document.createTextNode('No results for "'));
    const strong = document.createElement("strong");
    strong.textContent = query;
    noResults.appendChild(strong);
    noResults.appendChild(document.createTextNode('"'));
    group.appendChild(noResults);
    return;
  }

  filtered.forEach((domain, index) => {
    const row = document.createElement("div");
    row.className = "domain-row";
    row.style.animationDelay = `${Math.min(index * 0.03, 0.15)}s`;

    const text = document.createElement("span");
    text.className = "domain-text";
    text.textContent = domain;

    const btn = document.createElement("button");
    btn.className = "remove-btn";
    btn.setAttribute("aria-label", `Remove ${domain}`);
    btn.textContent = "×";
    btn.addEventListener("click", () => removeDomain(domain));

    row.appendChild(text);
    row.appendChild(btn);
    group.appendChild(row);
  });
}

function updateBlockedMode(settings) {
  kosherEditable = isBlockedList && settings?.kosherProtectionLocked === false;
  listName = kosherEditable
    ? "Blocked Sites"
    : isBlockedList
      ? "Custom Blocked Sites"
      : "Allowed Sites";
  document.title = `${listName} — CleanWeb`;
  $("pageTitle").textContent = listName;
  $("addTitle").textContent = `Add ${isBlockedList ? "Blocked" : "Allowed"} Domain`;
}

function getVisibleDomains() {
  if (!kosherEditable) return domains;
  return [...new Set([...kosherDomains, ...domains])].sort();
}

function applyTheme(theme) {
  const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
  document.documentElement.dataset.theme =
    theme === "dark" || theme === "light" ? theme : preferred;
}

function $(id) {
  return document.getElementById(id);
}

function getSync(key) {
  return new Promise((resolve) =>
    chrome.storage.sync.get([key], (r) => resolve(r[key])),
  );
}

function getLocal(key) {
  return new Promise((resolve) =>
    chrome.storage.local.get([key], (r) => resolve(r[key])),
  );
}

function setSync(value) {
  return new Promise((resolve) => chrome.storage.sync.set(value, resolve));
}
