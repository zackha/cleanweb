importScripts("defaults.js");

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
  blockedDomains: [],
  kosherDomains: KOSHER_BLOCKED_DOMAINS,
  kosherProtectionLocked: true,
  pauseDurationMinutes: 1,
};

function normalizeSettings(settings) {
  const normalized = Object.assign({}, DEFAULT_SETTINGS, settings || {});

  if (!Array.isArray(normalized.ignoredDomains)) {
    normalized.ignoredDomains = [];
  }

  if (!Array.isArray(normalized.blockedDomains)) {
    normalized.blockedDomains = [];
  }

  if (!Array.isArray(normalized.kosherDomains)) {
    normalized.kosherDomains = KOSHER_BLOCKED_DOMAINS;
  }

  normalized.kosherProtectionLocked = normalized.kosherProtectionLocked !== false;

  if (
    Number(settings && settings.blockedDomainsVersion) <
    DEFAULT_BLOCKED_DOMAINS_VERSION
  ) {
    normalized.blockedDomains = normalized.blockedDomains.filter(
      (domain) =>
        !KOSHER_BLOCKED_DOMAINS.includes(domain) &&
        !REMOVED_DEFAULT_BLOCKED_DOMAINS.includes(domain),
    );
    normalized.blockedDomainsVersion = DEFAULT_BLOCKED_DOMAINS_VERSION;
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
  normalized.hideVideos = normalized.hideVideos !== false;
  normalized.pauseDurationMinutes = normalizePauseDuration(
    normalized.pauseDurationMinutes,
  );

  delete normalized.status;
  delete normalized.darken;

  return normalized;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizePauseDuration(value) {
  const minutes = Number(value);
  return [1, 5, 15, 30, 60].includes(minutes) ? minutes : 1;
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
    togglePause();
  }

  if (command === "toggle_whitelist") {
    toggleWhitelistForActiveTab();
  }

  if (command === "add_to_blacklist") {
    addActiveTabToBlacklist();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.action === "pause_protection") {
    pauseProtection(sendResponse);
    return true;
  }

  if (request && request.action === "resume") {
    resumeNow(sendResponse);
    return true;
  }

  if (request && request.action === "blocked_site" && sender.tab && sender.tab.id) {
    chrome.tabs.remove(sender.tab.id);
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "cleanweb_resume") {
    resumeNow();
  }
});

function pauseProtection(callback) {
  saveNormalizedSettings((settings) => {
    const durationMinutes = settings.pauseDurationMinutes;
    const pausedUntil = Date.now() + durationMinutes * 60 * 1000;

    chrome.storage.local.set({ pausedUntil }, () => {
      chrome.alarms.create("cleanweb_resume", {
        delayInMinutes: durationMinutes,
      });
      if (callback) callback({ pausedUntil });
    });
  });
}

function resumeNow(callback) {
  chrome.storage.local.remove("pausedUntil", () => {
    chrome.alarms.clear("cleanweb_resume");
    if (callback) callback({ pausedUntil: null });
  });
}

function togglePause() {
  chrome.storage.local.get(["pausedUntil"], ({ pausedUntil }) => {
    if (Number(pausedUntil || 0) > Date.now()) {
      resumeNow();
      return;
    }

    pauseProtection();
  });
}

function toggleWhitelistForActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab || !tab.id) return;

    chrome.tabs.sendMessage(tab.id, { action: "get_hostname" }, (response) => {
      if (chrome.runtime.lastError) return;

      const hostname = response && response.hostname;
      if (!hostname) return;

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
  });
}

function addActiveTabToBlacklist() {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab || !tab.id) return;

    chrome.tabs.sendMessage(tab.id, { action: "get_hostname" }, (response) => {
      if (chrome.runtime.lastError) return;

      const hostname = response && response.hostname;
      if (!hostname) return;

      saveNormalizedSettings((settings) => {
        if (
          getKosherDomains(settings).includes(hostname) ||
          settings.blockedDomains.includes(hostname)
        ) {
          return;
        }

        settings.blockedDomains = settings.blockedDomains.concat(hostname).sort();
        chrome.storage.sync.set({ settings });
      });
    });
  });
}

function getKosherDomains(settings) {
  return settings.kosherProtectionLocked
    ? KOSHER_BLOCKED_DOMAINS
    : settings.kosherDomains;
}
