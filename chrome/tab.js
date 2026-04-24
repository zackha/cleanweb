const STYLE_ID = "tahir-style";
const VIDEO_STYLE_ID = "tahir-video-style";
const BG_SELECTOR =
  "div[style*='url'], section[style*='url'], header[style*='url'], main[style*='url'], article[style*='url'], span[style*='url'], a[style*='url'], i[style*='url'], li[style*='url'], p[style*='url']";

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

let settings = DEFAULT_SETTINGS;
let pausedUntil = 0;
let clipObserver = null;

init();

async function init() {
  settings = normalizeSettings(await getSync("settings"));
  pausedUntil = Number((await getLocal("pausedUntil")) || 0);
  render();
  addListeners();
}

function addListeners() {
  chrome.runtime.onMessage.addListener((request) => {
    if (request && request.message && request.message.type === "settings") {
      settings = normalizeSettings(request.message);
      render();
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.settings) {
      settings = normalizeSettings(changes.settings.newValue);
      render();
    }

    if (area === "local" && changes.pausedUntil) {
      pausedUntil = Number(changes.pausedUntil.newValue || 0);
      render();
    }
  });
}

function render() {
  removeProtection();

  if (isPaused() || isCurrentDomainIgnored()) {
    return;
  }

  const filterRules = buildFilterRules();
  if (filterRules) {
    addStyle(STYLE_ID, filterRules);
    applyClipPaths();
    startClipObserver();
  }

  if (settings.hideVideos) {
    addStyle(VIDEO_STYLE_ID, buildVideoRules());
  }
}

function removeProtection() {
  removeStyle(STYLE_ID);
  removeStyle(VIDEO_STYLE_ID);
  removeClipPaths();
  stopClipObserver();
}

function buildFilterRules() {
  const filter = buildFilterValue();
  if (!filter) return "";

  const selectors = getTargetSelectors();
  if (!selectors.length) return "";

  return `${selectors.join(", ")} { filter: ${filter} !important; transition: filter 0.25s ease !important; }`;
}

function buildFilterValue() {
  const parts = [];

  if (settings.blurEnabled) {
    parts.push(`blur(${settings.blurAmt}px)`);
  }

  if (settings.grayscale) {
    parts.push("grayscale(100%)");
  }

  if (settings.darkenAmt > 0) {
    parts.push(`brightness(${((100 - settings.darkenAmt) / 100).toFixed(2)})`);
  }

  return parts.join(" ");
}

function buildVideoRules() {
  return [
    "video",
    "iframe[src*='youtube.com/embed/']",
    "iframe[src*='youtube-nocookie.com/embed/']",
    "iframe[src*='player.vimeo.com/']",
    "iframe[src*='dailymotion.com/embed/']",
    "iframe[src*='twitch.tv/']",
  ].join(", ") +
    " { display: none !important; width: 0 !important; height: 0 !important; max-width: 0 !important; max-height: 0 !important; overflow: hidden !important; pointer-events: none !important; opacity: 0 !important; }";
}

function getTargetSelectors() {
  const selectors = [];
  if (settings.images) selectors.push("img");
  if (settings.videos) selectors.push("video");
  if (settings.iframes) selectors.push("iframe");
  if (settings.bgImages) selectors.push(BG_SELECTOR);
  return selectors;
}

function addStyle(id, css) {
  if (!css) return;

  let style = document.getElementById(id);
  if (!style) {
    style = document.createElement("style");
    style.id = id;
    document.documentElement.appendChild(style);
  }

  style.textContent = css;
}

function removeStyle(id) {
  const style = document.getElementById(id);
  if (style) style.remove();
}

function isPaused() {
  return pausedUntil > Date.now();
}

function isCurrentDomainIgnored() {
  return settings.ignoredDomains.includes(window.location.hostname);
}

function applyClipPaths() {
  const selector = getTargetSelectors().join(", ");
  if (!selector) return;

  try {
    document.querySelectorAll(selector).forEach(setClipPath);
  } catch (error) {}
}

function setClipPath(element) {
  const style = window.getComputedStyle(element);
  const value = [
    style.borderTopLeftRadius,
    style.borderTopRightRadius,
    style.borderBottomRightRadius,
    style.borderBottomLeftRadius,
  ].join(" ");

  element.style.setProperty("clip-path", `inset(0 round ${value})`, "important");
}

function removeClipPaths() {
  try {
    document.querySelectorAll(`img, video, iframe, ${BG_SELECTOR}`).forEach((element) => {
      element.style.removeProperty("clip-path");
    });
  } catch (error) {}
}

function startClipObserver() {
  if (clipObserver) return;

  clipObserver = new MutationObserver((mutations) => {
    const selector = getTargetSelectors().join(", ");
    if (!selector) return;

    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        try {
          if (node.matches(selector)) setClipPath(node);
          node.querySelectorAll(selector).forEach(setClipPath);
        } catch (error) {}
      });
    });
  });

  clipObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

function stopClipObserver() {
  if (!clipObserver) return;
  clipObserver.disconnect();
  clipObserver = null;
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
  normalized.hideVideos = normalized.hideVideos === true;
  return normalized;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
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
