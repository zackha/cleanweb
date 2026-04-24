/**
 * @name popup.js
 * @title Allow user to update GAB settings via popup modal
 * @description
 *   - Displays popup modal with current GAB settings
 *   - If user updates settings: (1) settings saved (2) updated settings sent to tab.js to update active tab blur CSS.
 *
 */

/*------------------------------------------------------------------
  Initialize Defaults & Add Listeners
-------------------------------------------------------------------*/

var settings = null;
var currentDomain = null;

/* debounce - Delays fn execution until after `delay` ms have passed since the last call */
function debounce(fn, delay) {
  var timer;
  return function () {
    clearTimeout(timer);
    timer = setTimeout(fn, delay);
  };
}

document.addEventListener("DOMContentLoaded", function () {
  initPopup();
});

/*------------------------------------------------------------------
  Implementation -- Main Functions
-------------------------------------------------------------------*/

/* initPopup - (1) Gets local storage settings (2) After DOM load, displays settings in modal & adds listeners to receive user input */
function initPopup() {
  loadTheme();

  getSettings().then(function () {
    if (document.readyState === "complete" || "interactive") {
      displaySettings(settings);
      addListeners();
    } else {
      document.addEventListener("DOMContentLoaded", function () {
        displaySettings(settings);
        addListeners();
      });
    }
  });

  checkForUpdate().then(function (update_status) {
    if (update_status === true) {
      displayUpdate();
    }
  });

  checkPauseState();
}

/*------------------------------------------------------------------
  Implementation -- Helper Functions
-------------------------------------------------------------------*/

/* getSettings - (1) Gets local storage settings, (2) sets local settings var to local storage settings, (3) resolves promise when complete  */
function getSettings() {
  return new Promise(function (resolve) {
    chrome.storage.sync.get(["settings"], function (storage) {
      settings = storage.settings;
      if (settings && settings.status !== true) {
        settings.status = true;
        chrome.storage.sync.set({ settings: settings });
      }
      resolve();
    });
  });
}

function checkForUpdate() {
  return new Promise(function (resolve) {
    chrome.storage.sync.get(["update"], function (storage) {
      resolve(storage.update);
    });
  });
}

/* displaySettings - Update popup modal with local storage settings */
function displaySettings(settings) {
  document.querySelector("input[name=blurEnabled]").checked =
    settings.blurEnabled;
  document.querySelector("input[name=images]").checked = settings.images;
  document.querySelector("input[name=bgimages]").checked = settings.bgImages;
  document.querySelector("input[name=videos]").checked = settings.videos;
  document.querySelector("input[name=iframes]").checked = settings.iframes;
  document.querySelector("input[name=bluramt]").value = settings.blurAmt;
  document.querySelector("span[name=bluramttext]").textContent =
    settings.blurAmt + "px";
  document.querySelector("input[name=grayscale]").checked = settings.grayscale;
  document.querySelector("input[name=darkenamt]").value = settings.darkenAmt;
  document.querySelector("span[name=darkenamttext]").textContent =
    settings.darkenAmt + "%";
  document.querySelector("input[name=hideVideos]").checked =
    settings.hideVideos || false;

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var url = new URL(tabs[0].url);
    currentDomain = url.hostname;

    var isWhitelisted = settings.ignoredDomains.indexOf(currentDomain) !== -1;

    document.querySelector("#current-domain").textContent = currentDomain;
    document.querySelector("#btn-whitelist-add").style.display = isWhitelisted
      ? "none"
      : "initial";
    document.querySelector("#btn-whitelist-remove").style.display =
      isWhitelisted ? "initial" : "none";
  });
}

/* addListeners - (1) Listen for changes to popup modal inputs (2) route to appropriate function  */
function addListeners() {
  document
    .querySelector("input[name=blurEnabled]")
    .addEventListener("change", updateBlurEnabled);
  document
    .querySelector("input[name=bluramt]")
    .addEventListener("input", updateBluramt);
  document
    .querySelector("input[name=grayscale]")
    .addEventListener("change", updateGrayscale);
  document
    .querySelector("input[name=darkenamt]")
    .addEventListener("input", updateDarkenAmt);
  document
    .querySelector("input[name=images]")
    .addEventListener("change", updateImages);
  document
    .querySelector("input[name=bgimages]")
    .addEventListener("change", updateBGImages);
  document
    .querySelector("input[name=videos]")
    .addEventListener("change", updateVideos);
  document
    .querySelector("input[name=iframes]")
    .addEventListener("change", updateIframes);
  document
    .querySelector("button[name=readmore]")
    .addEventListener("click", loadFullUpdateMessage);
  document
    .querySelector("button[name=dismiss]")
    .addEventListener("click", dismissUpdate);
  document
    .querySelector("#btn-whitelist-add")
    .addEventListener("click", addToWhitelist);
  document
    .querySelector("#btn-whitelist-remove")
    .addEventListener("click", removeFromWhitelist);
  document
    .querySelector("#btn-pause")
    .addEventListener("click", pauseForFiveMinutes);
  document.querySelector("#btn-resume").addEventListener("click", resumeNow);
  document.querySelector("#btn-theme").addEventListener("click", toggleTheme);
  document
    .querySelector("input[name=hideVideos]")
    .addEventListener("change", updateHideVideos);
}

/* updateBlurEnabled - Toggle blur on/off */
function updateBlurEnabled() {
  settings.blurEnabled = document.querySelector(
    "input[name=blurEnabled]",
  ).checked;
  chrome.storage.sync.set({ settings: settings });
  sendUpdatedSettings();
}

/* updateBlurAmt - UI updates immediately; storage + tab message debounced to avoid quota errors */
var saveBluramt = debounce(function () {
  chrome.storage.sync.set({ settings: settings });
  sendUpdatedSettings();
}, 300);

function updateBluramt() {
  settings.blurAmt = document.querySelector("input[name=bluramt]").value;
  document.querySelector("span[name=bluramttext]").textContent =
    settings.blurAmt + "px";
  saveBluramt();
}

/* updateGrayscale - (1) Update "grayscale" settings with user input (2) save settings (3) send updated settings to tab.js to modify active tab blur css */
function updateGrayscale() {
  settings.grayscale = document.querySelector("input[name=grayscale]").checked;
  chrome.storage.sync.set({ settings: settings });
  sendUpdatedSettings();
}

/* updateDarkenAmt - UI updates immediately; storage + tab message debounced to avoid quota errors */
var saveDarkenAmt = debounce(function () {
  chrome.storage.sync.set({ settings: settings });
  sendUpdatedSettings();
}, 300);

function updateDarkenAmt() {
  settings.darkenAmt = parseInt(
    document.querySelector("input[name=darkenamt]").value,
    10,
  );
  document.querySelector("span[name=darkenamttext]").textContent =
    settings.darkenAmt + "%";
  saveDarkenAmt();
}

/* updateStatus - (1) Update "images" settings with user input (2) save settings (3) send updated settings to tab.js to modify active tab blur css */
function updateImages() {
  settings.images = document.querySelector("input[name=images]").checked;
  chrome.storage.sync.set({ settings: settings });
  sendUpdatedSettings();
}

/* updateVideos - (1) Update "videos" settings with user input (2) save settings (3) send updated settings to tab.js to modify active tab blur css */
function updateVideos() {
  settings.videos = document.querySelector("input[name=videos]").checked;
  chrome.storage.sync.set({ settings: settings });
  sendUpdatedSettings();
}

/* updateHideVideos - Toggle video removal feature */
function updateHideVideos() {
  settings.hideVideos = document.querySelector(
    "input[name=hideVideos]",
  ).checked;
  chrome.storage.sync.set({ settings: settings });
  sendUpdatedSettings();
}

/* updateStatus - (1) Update "iframes" settings with user input (2) save settings (3) send updated settings to tab.js to modify active tab blur css */
function updateIframes() {
  settings.iframes = document.querySelector("input[name=iframes]").checked;
  chrome.storage.sync.set({ settings: settings });
  sendUpdatedSettings();
}

/* updateBgImages - (1) Update "iframes" settings with user input (2) save settings (3) send updated settings to tab.js to modify active tab blur css */
function updateBGImages() {
  settings.bgImages = document.querySelector("input[name=bgimages]").checked;
  chrome.storage.sync.set({ settings: settings });
  sendUpdatedSettings();
}

/* sendUpdatedSettings - Send updated settings object to tab.js to modify active tab blur CSS */
function sendUpdatedSettings() {
  chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
    if (tabs.length === 0) {
      return;
    }

    var activeTab = tabs[0];
    chrome.tabs.sendMessage(activeTab.id, { message: settings }).catch(() => {
      console.log("Error sending message to tab.js");
    });
  });
}

function displayUpdate() {
  document.getElementById("update").style.display = "block";
}

function loadFullUpdateMessage() {
  chrome.tabs.create({ url: chrome.runtime.getURL("update.html") });
}

function dismissUpdate() {
  chrome.storage.sync.set({ update: false });
  chrome.action.setIcon({ path: "assets/img/icon128.png" });
  document.getElementById("update").style.display = "none";
}

/* checkPauseState - Reads local storage and updates pause UI accordingly */
var countdownInterval = null;

function checkPauseState() {
  chrome.storage.local.get(["pausedUntil"], function (data) {
    if (data.pausedUntil && data.pausedUntil > Date.now()) {
      showPausedState(data.pausedUntil);
    } else {
      showActiveState();
    }
  });
}

function showPausedState(pausedUntil) {
  document.getElementById("pause-active-row").style.display = "none";
  document.getElementById("pause-paused-row").style.display = "flex";
  if (countdownInterval) clearInterval(countdownInterval);
  updateCountdown(pausedUntil);
  countdownInterval = setInterval(function () {
    if (Date.now() >= pausedUntil) {
      showActiveState();
    } else {
      updateCountdown(pausedUntil);
    }
  }, 1000);
}

function updateCountdown(pausedUntil) {
  var remaining = Math.max(0, pausedUntil - Date.now());
  var minutes = Math.floor(remaining / 60000);
  var seconds = Math.floor((remaining % 60000) / 1000);
  document.getElementById("pause-countdown").textContent =
    minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
}

function showActiveState() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  document.getElementById("pause-active-row").style.display = "flex";
  document.getElementById("pause-paused-row").style.display = "none";
}

function pauseForFiveMinutes() {
  chrome.runtime.sendMessage({ action: "pause_5min" });
  showPausedState(Date.now() + 5 * 60 * 1000);
}

function resumeNow() {
  chrome.runtime.sendMessage({ action: "resume" });
  showActiveState();
}

/* addToWhitelist - (1) Adds current domain to ignored domain list */
function addToWhitelist(e) {
  e.preventDefault();
  settings.ignoredDomains.push(currentDomain);
  document.querySelector("#btn-whitelist-add").style.display = "none";
  document.querySelector("#btn-whitelist-remove").style.display = "initial";
  chrome.storage.sync.set({ settings: settings });
  sendUpdatedSettings();
}

/* removeFromWhitelist - (1) Removes current domain from ignored domain list */
function removeFromWhitelist(e) {
  e.preventDefault();
  settings.ignoredDomains = settings.ignoredDomains.filter(function (d) {
    return d !== currentDomain;
  });
  document.querySelector("#btn-whitelist-add").style.display = "initial";
  document.querySelector("#btn-whitelist-remove").style.display = "none";
  chrome.storage.sync.set({ settings: settings });
  sendUpdatedSettings();
}

/* loadTheme - Reads saved theme from local storage and applies it */
function loadTheme() {
  chrome.storage.local.get(["theme"], function (data) {
    var theme = data.theme || "dark";
    applyTheme(theme);
  });
}

/* applyTheme - Sets data-theme attribute and updates toggle button label */
function applyTheme(theme) {
  document.documentElement.setAttribute(
    "data-theme",
    theme === "dark" ? "dark" : "",
  );
  var btn = document.querySelector("#btn-theme");
  if (btn) btn.textContent = theme === "dark" ? "[ light ]" : "[ dark ]";
}

/* toggleTheme - Switches between light and dark and persists preference */
function toggleTheme() {
  var current = document.documentElement.getAttribute("data-theme");
  var next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  chrome.storage.local.set({ theme: next });
}
