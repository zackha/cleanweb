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
  hideVideos: false,
  ignoredDomains: [],
};

function normalizeSettings(settings) {
  const normalized = Object.assign({}, DEFAULT_SETTINGS, settings || {});

  if (!Array.isArray(normalized.ignoredDomains)) {
    normalized.ignoredDomains = [];
  }

  normalized.type = "settings";
  normalized.blurAmt = clampNumber(normalized.blurAmt, 1, 50, 20);
  normalized.darkenAmt = clampNumber(normalized.darkenAmt, 0, 100, 0);
  normalized.images = normalized.images !== false;
  normalized.videos = normalized.videos !== false;
  normalized.iframes = normalized.iframes !== false;
  normalized.bgImages = normalized.bgImages !== false;
  normalized.blurEnabled = normalized.blurEnabled !== false;
  normalized.grayscale = normalized.grayscale !== false;
  normalized.hideVideos = normalized.hideVideos === true;

  delete normalized.status;
  delete normalized.darken;

  return normalized;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function saveNormalizedSettings(callback) {
  chrome.storage.sync.get(["settings"], ({ settings }) => {
    const normalized = normalizeSettings(settings);
    chrome.storage.sync.set({ settings: normalized }, () => {
      if (callback) callback(normalized);
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  saveNormalizedSettings();
  chrome.action.setIcon({ path: "assets/img/icon128.png" });
});

chrome.runtime.onStartup.addListener(() => {
  saveNormalizedSettings();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "pause_5min") {
    pauseForFiveMinutes();
  }

  if (command === "toggle_whitelist") {
    toggleWhitelistForActiveTab();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.action === "pause_5min") {
    pauseForFiveMinutes(sendResponse);
    return true;
  }

  if (request && request.action === "resume") {
    resumeNow(sendResponse);
    return true;
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "tahir_resume") {
    resumeNow();
  }
});

function pauseForFiveMinutes(callback) {
  const pausedUntil = Date.now() + 5 * 60 * 1000;
  chrome.storage.local.set({ pausedUntil }, () => {
    chrome.alarms.create("tahir_resume", { delayInMinutes: 5 });
    if (callback) callback({ pausedUntil });
  });
}

function resumeNow(callback) {
  chrome.storage.local.remove("pausedUntil", () => {
    chrome.alarms.clear("tahir_resume");
    if (callback) callback({ pausedUntil: null });
  });
}

function toggleWhitelistForActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    const hostname = getHostname(tab && tab.url);
    if (!hostname || !tab || !tab.id) return;

    saveNormalizedSettings((settings) => {
      const ignoredDomains = settings.ignoredDomains;
      const isIgnored = ignoredDomains.includes(hostname);

      settings.ignoredDomains = isIgnored
        ? ignoredDomains.filter((domain) => domain !== hostname)
        : ignoredDomains.concat(hostname);

      chrome.storage.sync.set({ settings }, () => {
        chrome.tabs.sendMessage(tab.id, { message: settings }).catch(() => {});
      });
    });
  });
}

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (error) {
    return "";
  }
}
