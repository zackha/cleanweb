/**
 * @name background.js
 * @title Initialize extension & listen for user input via key commands
 * @description
 *   - On extension installation, create default local storage settings
 *   - On extension load, add listeners for key commands & sends appropriate messages to tab.js
        - Listens for "Alt+K", if detected, sends "toggle_selected" message to tab.js
        - Listens for "Alt+W", if detected, toggles the active page in whitelist
 */

/* On extension installation, create default local storage settings. On extension update, ensure settings.ignoredDomains exists (update 1.0.4) set update to true in local storage. */
chrome.runtime.onInstalled.addListener(function (obj) {
  if (obj.reason === "install") {
    const settings = {
      type: "settings",
      status: true,
      images: true,
      videos: true,
      iframes: true,
      blurAmt: 20,
      grayscale: true,
      bgImages: true,
      blurEnabled: true,
      darkenAmt: 0,
      ignoredDomains: [],
      hideVideos: false,
    };
    chrome.storage.sync.set({ settings: settings });
  }

  if (obj.reason === "update") {
    chrome.storage.sync.get(["settings"], function (storage) {
      const settings = storage.settings || {};
      if (!settings.ignoredDomains) {
        settings.ignoredDomains = [];
      }
      if (!settings.type) {
        settings.type = "settings";
      }
      if (settings.blurEnabled === undefined) {
        settings.blurEnabled = true;
      }
      if (settings.darkenAmt === undefined) {
        settings.darkenAmt = settings.darken === true ? 90 : 0;
        delete settings.darken;
      }
      if (settings.hideVideos === undefined) {
        settings.hideVideos = false;
      }
      settings.status = true;
      chrome.storage.sync.set({ settings: settings });
    });

    chrome.storage.sync.set({ update: true });
    chrome.action.setIcon({ path: "assets/img/icon128.png" });
  }
});

/* On extension load, add listeners for user key commands: Alt+K, Alt+P, Alt+W */
chrome.commands.onCommand.addListener(function (command) {
  if (command === "toggle_selected") {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs
        .sendMessage(tabs[0].id, { message: "toggle_selected" })
        .catch(() => {
          console.log("Error sending message to tab.js");
        });
    });
  }
  if (command === "pause_5min") {
    activatePause();
  }
  if (command === "toggle_whitelist") {
    toggleWhitelistForActiveTab();
  }
});

/* activatePause - Saves pausedUntil timestamp and creates a 5-min alarm to auto-resume */
function activatePause() {
  var pausedUntil = Date.now() + 5 * 60 * 1000;
  chrome.storage.local.set({ pausedUntil: pausedUntil });
  chrome.alarms.create("tahir_resume", { delayInMinutes: 5 });
}

/* deactivatePause - Clears pausedUntil and cancels any pending alarm */
function deactivatePause() {
  chrome.storage.local.remove("pausedUntil");
  chrome.alarms.clear("tahir_resume");
}

/* Listen for pause/resume messages from popup.js */
chrome.runtime.onMessage.addListener(function (request) {
  if (request.action === "pause_5min") {
    activatePause();
  }
  if (request.action === "resume") {
    deactivatePause();
  }
});

/* Auto-resume when alarm fires */
chrome.alarms.onAlarm.addListener(function (alarm) {
  if (alarm.name === "tahir_resume") {
    deactivatePause();
  }
});

function toggleWhitelistForActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var activeTab = tabs[0];
    if (!activeTab || !activeTab.url) {
      return;
    }

    var hostname;
    try {
      hostname = new URL(activeTab.url).hostname;
    } catch {
      return;
    }

    if (!hostname) {
      return;
    }

    chrome.storage.sync.get(["settings"], function (storage) {
      var settings = storage.settings;
      if (!settings) {
        return;
      }

      var ignoredDomains = settings.ignoredDomains || [];
      var isWhitelisted = ignoredDomains.indexOf(hostname) !== -1;

      settings.ignoredDomains = isWhitelisted
        ? ignoredDomains.filter(function (domain) {
            return domain !== hostname;
          })
        : ignoredDomains.concat(hostname);

      chrome.storage.sync.set({ settings: settings });
      chrome.tabs.sendMessage(activeTab.id, { message: settings }).catch(() => {
        console.log("Error sending message to tab.js");
      });
    });
  });
}
