const DEFAULT_SETTINGS = {
  type: "settings",
  images: true,
  videos: true,
  iframes: true,
  bgImages: true,
  blurEnabled: true,
  blurAmt: 20,
  grayscale: true,
  darkenAmt: 0,
  hideVideos: true,
  ignoredDomains: [],
  pauseDurationMinutes: 1,
};

const GITHUB_URL = "https://github.com/zackha/cleanweb";
const COFFEE_URL = "https://buymeacoffee.com/zackha";

let settings = DEFAULT_SETTINGS;
let currentHost = "";
let countdownTimer = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  applyTheme(await getLocal("theme"));
  settings = normalizeSettings(await getSync("settings"));
  await saveSettings();
  currentHost = await getCurrentHost();

  bindEvents();
  renderSettings();
  renderDomain();
  renderPause(await getLocal("pausedUntil"));
}

function bindEvents() {
  bindToggle("blurEnabled", "blurEnabled");
  bindToggle("grayscale", "grayscale");
  bindToggle("hideVideos", "hideVideos");
  bindToggle("images", "images");
  bindToggle("videos", "videos");
  bindToggle("iframes", "iframes");
  bindToggle("bgImages", "bgImages");

  bindRange("blurAmt", "blurValue", "px");
  bindRange("darkenAmt", "darkenValue", "%");

  $("pauseDuration").addEventListener("change", updatePauseDuration);
  $("protectionSwitch").addEventListener("change", toggleProtectionSwitch);
  $("domainSwitch").addEventListener("change", toggleCurrentDomain);
  $("timerResumeButton").addEventListener("click", resumeNow);
  $("themeButton").addEventListener("click", toggleTheme);
  $("supportLink").addEventListener("click", openCoffee);
  $("githubLink").addEventListener("click", openGithub);
  document.addEventListener("keydown", handleKeyboardShortcut);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.settings) {
      settings = normalizeSettings(changes.settings.newValue);
      renderSettings();
      renderDomain();
    }

    if (area === "local" && changes.pausedUntil) {
      renderPause(changes.pausedUntil.newValue);
    }
  });
}

function bindToggle(id, key) {
  $(id).addEventListener("change", async (event) => {
    settings[key] = event.target.checked;
    await persistAndSync();
    renderDomain();
  });
}

function bindRange(id, valueId, unit) {
  const input = $(id);
  const value = $(valueId);
  const save = debounce(async () => {
    settings[id] = Number(input.value);
    await persistAndSync();
  }, 180);

  input.addEventListener("input", () => {
    value.textContent = `${input.value}${unit}`;
    save();
  });
}

function renderSettings() {
  $("blurEnabled").checked = settings.blurEnabled;
  $("grayscale").checked = settings.grayscale;
  $("hideVideos").checked = settings.hideVideos;
  $("images").checked = settings.images;
  $("videos").checked = settings.videos;
  $("iframes").checked = settings.iframes;
  $("bgImages").checked = settings.bgImages;

  $("blurAmt").value = settings.blurAmt;
  $("blurValue").textContent = `${settings.blurAmt}px`;
  $("darkenAmt").value = settings.darkenAmt;
  $("darkenValue").textContent = `${settings.darkenAmt}%`;
  $("pauseDuration").value = String(settings.pauseDurationMinutes);
  $("pauseShortcutText").textContent = `Pause ${formatDuration(
    settings.pauseDurationMinutes,
  )}`;
}

function renderDomain() {
  const isIgnored =
    currentHost && settings.ignoredDomains.includes(currentHost);
  $("domainName").textContent = currentHost || "This page cannot be changed";
  $("domainStatus").textContent = isIgnored ? "Allowed site" : "Protected site";
  $("domainSwitch").checked = !isIgnored;
  $("domainSwitch").disabled = !currentHost;
}

function renderPause(pausedUntil) {
  const until = Number(pausedUntil || 0);
  const paused = until > Date.now();

  document.documentElement.dataset.paused = paused ? "true" : "false";
  $("statusTitle").textContent = "Protection";
  $("statusText").textContent = paused
    ? "Resumes automatically."
    : "Active on protected sites.";
  $("protectionSwitch").checked = !paused;
  $("timerOverlay").hidden = !paused;

  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }

  if (!paused) {
    $("timerCountdown").textContent = "";
    return;
  }

  updateCountdown(until);
  countdownTimer = setInterval(() => {
    if (until <= Date.now()) {
      renderPause(0);
      return;
    }

    updateCountdown(until);
  }, 1000);
}

function updateCountdown(pausedUntil) {
  const remaining = Math.max(0, pausedUntil - Date.now());
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const formatted =
    hours > 0
      ? `${hours}:${minutes < 10 ? "0" : ""}${minutes}:${
          seconds < 10 ? "0" : ""
        }${seconds}`
      : `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  $("timerCountdown").textContent = formatted;
}

async function pauseProtection() {
  const response = await sendRuntimeMessage({ action: "pause_protection" });
  renderPause(response && response.pausedUntil);
}

async function resumeNow() {
  await sendRuntimeMessage({ action: "resume" });
  renderPause(0);
}

async function toggleProtectionSwitch(event) {
  if (event.target.checked) {
    await resumeNow();
    return;
  }

  await pauseProtection();
}

async function updatePauseDuration(event) {
  settings.pauseDurationMinutes = Number(event.target.value);
  await persistAndSync();
  renderSettings();
}

async function toggleCurrentDomain() {
  if (!currentHost) return;

  const ignored = settings.ignoredDomains.includes(currentHost);
  settings.ignoredDomains = ignored
    ? settings.ignoredDomains.filter((domain) => domain !== currentHost)
    : settings.ignoredDomains.concat(currentHost);

  await persistAndSync();
  renderDomain();
}

async function handleKeyboardShortcut(event) {
  if (!event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) {
    return;
  }

  const key = event.key.toLowerCase();

  if (key === "p") {
    event.preventDefault();
    await togglePauseFromShortcut();
  }

  if (key === "w") {
    event.preventDefault();
    await toggleCurrentDomain();
  }
}

async function togglePauseFromShortcut() {
  const pausedUntil = Number((await getLocal("pausedUntil")) || 0);

  if (pausedUntil > Date.now()) {
    await resumeNow();
    return;
  }

  await pauseProtection();
}

async function persistAndSync() {
  await saveSettings();
  await sendSettingsToActiveTab();
}

async function saveSettings() {
  settings = normalizeSettings(settings);
  await setSync({ settings });
}

async function sendSettingsToActiveTab() {
  const tab = await getActiveTab();
  if (!tab || !tab.id) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { message: settings });
  } catch (error) {}
}

async function getCurrentHost() {
  const tab = await getActiveTab();
  if (!tab || !tab.id) return "";

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: "get_hostname",
    });

    return response && response.hostname ? response.hostname : "";
  } catch (error) {
    return "";
  }
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme || "light";
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  chrome.storage.local.set({ theme: next });
}

function applyTheme(theme) {
  const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
  const selected = theme === "dark" || theme === "light" ? theme : preferred;

  document.documentElement.dataset.theme = selected;
  $("themeButton").checked = selected === "dark";
}

function openGithub(event) {
  event.preventDefault();
  chrome.tabs.create({ url: GITHUB_URL });
}

function openCoffee(event) {
  event.preventDefault();
  chrome.tabs.create({ url: COFFEE_URL });
}

function normalizeSettings(value) {
  const normalized = Object.assign({}, DEFAULT_SETTINGS, value || {});
  normalized.ignoredDomains = Array.isArray(normalized.ignoredDomains)
    ? normalized.ignoredDomains
    : [];
  normalized.type = "settings";
  normalized.blurAmt = clampNumber(normalized.blurAmt, 1, 50, 20);
  normalized.darkenAmt = clampNumber(normalized.darkenAmt, 0, 100, 0);
  normalized.images = normalized.images !== false;
  normalized.videos = normalized.videos !== false;
  normalized.iframes = normalized.iframes !== false;
  normalized.bgImages = normalized.bgImages !== false;
  normalized.blurEnabled = normalized.blurEnabled !== false;
  normalized.grayscale = normalized.grayscale !== false;
  normalized.hideVideos = normalized.hideVideos !== false;
  normalized.pauseDurationMinutes = normalizePauseDuration(
    normalized.pauseDurationMinutes,
  );
  delete normalized.status;
  delete normalized.darken;
  return normalized;
}

function formatDuration(minutes) {
  return minutes === 60
    ? "1 hour"
    : `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function normalizePauseDuration(value) {
  const minutes = Number(value);
  return [1, 5, 15, 30, 60].includes(minutes) ? minutes : 1;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function debounce(fn, delay) {
  let timer = null;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, delay);
  };
}

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      resolve(tab);
    });
  });
}

function getSync(key) {
  return new Promise((resolve) => {
    chrome.storage.sync.get([key], (result) => resolve(result[key]));
  });
}

function getLocal(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => resolve(result[key]));
  });
}

function setSync(value) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(value, resolve);
  });
}

function sendRuntimeMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => resolve(response || {}));
  });
}

function $(id) {
  return document.getElementById(id);
}
