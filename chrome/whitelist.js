let domains = [];
let query = "";

document.addEventListener("DOMContentLoaded", init);

async function init() {
  applyTheme(await getLocal("theme"));
  const settings = await getSync("settings");
  domains = Array.isArray(settings?.ignoredDomains) ? [...settings.ignoredDomains] : [];
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
      domains = Array.isArray(changes.settings.newValue?.ignoredDomains)
        ? [...changes.settings.newValue.ignoredDomains]
        : [];
      render();
    }
  });
}

async function addDomain() {
  const raw = $("addInput").value.trim().toLowerCase();
  const domain = raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!domain) return;

  if (domains.includes(domain)) {
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
  domains = domains.filter((d) => d !== domain);
  await save();
  render();
}

async function save() {
  const settings = (await getSync("settings")) || {};
  await setSync({ settings: { ...settings, ignoredDomains: domains } });
}

function render() {
  const filtered = query ? domains.filter((d) => d.includes(query)) : domains;

  $("navCount").textContent = domains.length
    ? `${domains.length} site${domains.length === 1 ? "" : "s"}`
    : "";

  $("listTitle").textContent = query ? "Results" : "Domains";

  const group = $("listGroup");
  group.innerHTML = "";

  if (!domains.length) {
    group.innerHTML = `
      <div class="empty">
        <div class="empty-icon-wrap">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2 3 6v6c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V6L12 2Zm-1 13-3-3 1.41-1.41L11 12.17l4.59-4.58L17 9l-6 6Z"/>
          </svg>
        </div>
        <p class="empty-title">No allowed sites</p>
        <p class="empty-body">All sites are currently protected.<br>Add a domain above to allow it.</p>
      </div>`;
    return;
  }

  if (query && !filtered.length) {
    group.innerHTML = `<div class="no-results">No results for "<strong>${query}</strong>"</div>`;
    return;
  }

  filtered.forEach((domain, index) => {
    const row = document.createElement("div");
    row.className = "domain-row";
    row.style.animationDelay = `${Math.min(index * 0.03, 0.15)}s`;
    row.innerHTML = `
      <span class="domain-text">${domain}</span>
      <button class="remove-btn" aria-label="Remove ${domain}">×</button>`;
    row.querySelector(".remove-btn").addEventListener("click", () => removeDomain(domain));
    group.appendChild(row);
  });
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
