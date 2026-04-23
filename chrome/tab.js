/**
 * @name tab.js
 * @title Modify DOM of active tab
 * @description
 * 	 - On tab load: (1) loads local storage settings & (2) generates & applies blur CSS
 *   - Listens to popup.js (popup modal) & background.js (key commands) for updates & modifies blur CSS as needed.
 *
 *
 */

/*------------------------------------------------------------------
  Initialize Defaults & Add Listeners
-------------------------------------------------------------------*/

var settings = null;
var clipObserver = null;

initTab();

/*------------------------------------------------------------------
  Implementation -- Main Wrapper Function
-------------------------------------------------------------------*/

/* initTab - On document start: (1) gets local storage settings (2) generates & applies blur CSS (3) sets up listeners to receive and act on messages from popup.js/background.js */
function initTab() {
  getSettings().then(function () {
    chrome.storage.local.get(["pausedUntil"], function (data) {
      var isPaused = data.pausedUntil && data.pausedUntil > Date.now();
      if (settings.status === true && !isDomainIgnored() && !isPaused) {
        injectBlurCSS();
      }
      addListeners();
    });
  });
}

/*------------------------------------------------------------------
  Implementation -- Helper Functions 
-------------------------------------------------------------------*/

/* getSettings - (1) Gets local storage settings, (2) sets local settings var to local storage settings, (3) resolves promise when complete  */
function getSettings() {
  return new Promise(function (resolve) {
    chrome.storage.sync.get(["settings"], function (storage) {
      settings = storage.settings;
      resolve();
    });
  });
}

function isDomainIgnored() {
  var list = settings.ignoredDomains;
  return list.indexOf(window.location.host) >= 0;
}

/* addListeners - (1) adds message listeners to receive specific messages from popup.js (popup modal) & background.js (key commands) & (2) routes to appropriate functions on receipt */
function addListeners() {
  chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
      if (request.message === "reverse_status") {
        reverseStatus();
      } else if (request.message === "toggle_selected") {
        toggleSelected();
      } else if (request.message.type === "settings") {
        updateCSS(request.message);
      }
    },
  );

  /* Listen for pause/resume via storage changes (works for keyboard shortcut too) */
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== "local" || !changes.pausedUntil) return;
    var newVal = changes.pausedUntil.newValue;
    if (newVal && newVal > Date.now()) {
      removeBlurCSS();
    } else {
      if (settings && settings.status === true && !isDomainIgnored()) {
        injectBlurCSS();
      }
    }
  });
}

/* injectBlurCSS - Appends generated blur CSS to head */
function injectBlurCSS() {
  const style = document.createElement("style");
  style.type = "text/css";
  style.rel = "stylesheet";
  style.id = "tahir";
  style.textContent = generateCssRules();
  style.async = false;
  document.documentElement.appendChild(style);
  applyClipPaths();
  startClipObserver();
}

/* removeBlurCSS - Removes injected blur CSS */
function removeBlurCSS() {
  const css = document.getElementById("tahir");
  if (css) {
    css.parentNode.removeChild(css);
  }
  removeClipPaths();
  stopClipObserver();
}

/* generateCssRules - Generates custom blur CSS based on user local storage settings */
function generateCssRules() {
  var cssRules = "";
  var blurAmt = "blur(" + settings.blurAmt + "px) ";
  var grayscale = settings.grayscale == true ? "grayscale(100%) " : "";
  var darkenBrightness =
    settings.darkenAmt > 0
      ? "brightness(" + ((100 - settings.darkenAmt) / 100).toFixed(2) + ") "
      : "";
  var filterVal =
    (settings.blurEnabled !== false ? blurAmt : "") +
    grayscale +
    darkenBrightness;
  var transition = "transition: filter 0.3s ease !important; ";

  if (settings.images === true) {
    cssRules +=
      "img { filter: " + filterVal + "!important; " + transition + "} ";
  }
  if (settings.videos === true) {
    cssRules +=
      "video { filter: " + filterVal + "!important; " + transition + "} ";
  }
  if (settings.iframes === true) {
    cssRules +=
      "iframe { filter: " + filterVal + "!important; " + transition + "} ";
  }
  if (settings.bgImages === true) {
    cssRules +=
      "div[style*='url'], section[style*='url'], header[style*='url'], main[style*='url'], article[style*='url'], span[style*='url'], a[style*='url'], i[style*='url'], li[style*='url'], p[style*='url'] { filter: " +
      filterVal +
      "!important; " +
      transition +
      "} ";
  }

  return cssRules;
}

/* BG_SEL - Inline background-image selectors, consistent with generateCssRules */
var BG_SEL =
  "div[style*='url'], section[style*='url'], header[style*='url'], main[style*='url'], article[style*='url'], span[style*='url'], a[style*='url'], i[style*='url'], li[style*='url'], p[style*='url']";

/* getBlurSelector - Returns a combined CSS selector for all currently blurred element types */
function getBlurSelector() {
  var parts = [];
  if (settings && settings.images) parts.push("img");
  if (settings && settings.videos) parts.push("video");
  if (settings && settings.iframes) parts.push("iframe");
  if (settings && settings.bgImages) parts.push(BG_SEL);
  return parts.join(", ");
}

/* setClipPath - Clips an element's blur bleed to its own boundary, preserving its border-radius */
function setClipPath(el) {
  var cs = window.getComputedStyle(el);
  var tl = cs.borderTopLeftRadius;
  var tr = cs.borderTopRightRadius;
  var br = cs.borderBottomRightRadius;
  var bl = cs.borderBottomLeftRadius;
  var clipVal = "inset(0 round " + tl + " " + tr + " " + br + " " + bl + ")";
  el.style.setProperty("clip-path", clipVal, "important");
}

/* applyClipPaths - Applies clip-path to all currently blurred elements */
function applyClipPaths() {
  var sel = getBlurSelector();
  if (!sel) return;
  try {
    document.querySelectorAll(sel).forEach(setClipPath);
  } catch (e) {}
}

/* removeClipPaths - Strips clip-path from all elements that may have received it */
function removeClipPaths() {
  try {
    document
      .querySelectorAll("img, video, iframe, " + BG_SEL)
      .forEach(function (el) {
        el.style.removeProperty("clip-path");
      });
  } catch (e) {}
}

/* startClipObserver - Watches for newly added DOM nodes and clips them */
function startClipObserver() {
  if (clipObserver) return;
  clipObserver = new MutationObserver(function (mutations) {
    var sel = getBlurSelector();
    if (!sel) return;
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        try {
          if (node.matches(sel)) setClipPath(node);
          node.querySelectorAll(sel).forEach(setClipPath);
        } catch (e) {}
      });
    });
  });
  clipObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

/* stopClipObserver - Disconnects the MutationObserver */
function stopClipObserver() {
  if (clipObserver) {
    clipObserver.disconnect();
    clipObserver = null;
  }
}

/* updateCSS - (1) Gets updated local storage settings from popup.js (2) updates blur CSS accordingly */
function updateCSS(updatedSettings) {
  settings = updatedSettings;
  removeBlurCSS();

  var ignoredDomains = settings.ignoredDomains;

  if (settings.status === true && !isDomainIgnored()) {
    injectBlurCSS();
  }
}

/* reverseStatus - (1) Reverses current status (2) saves this to settings (3) updates blur CSS accordingly  */
function reverseStatus() {
  settings.status = !settings.status;
  chrome.storage.sync.set({ settings: settings });
  removeBlurCSS();
  if (settings.status === true) {
    injectBlurCSS();
  }
}

/* toggleSelected - (1) Determines objects over hover (2) reverses blur state of objects over hover  */
function toggleSelected() {
  const hover = document.querySelectorAll(":hover"); // Determine user hover
  var imgFoundCSS = false; // Track if image found

  /* Iterate through all elements under hover. Toggle if contains IMG, IFRAME, VIDEO or inline image. */
  hover.forEach(function (selected, iterator, array) {
    toggleIfImg(selected);
  });

  /* toggleIfImg sub-method - If any element is an (1) IMG, IFRAME, VIDEO or (2) has a in-line background-url --> toggle */
  function toggleIfImg(selected) {
    if (
      selected.nodeName === "IMG" ||
      selected.nodeName === "IFRAME" ||
      selected.nodeName === "VIDEO"
    ) {
      toggle(selected);
    } else if (selected.style) {
      if (selected.style.cssText.match(/url\(([^()]+)\)/)) {
        toggle(selected);
      }
    }
  }

  /* toggle sub-method - adds forced blur or unblur as appropriate */
  function toggle(selected) {
    /* If this is fist image found */
    if (imgFoundCSS === false) {
      var cssText = selected.style.cssText;

      /* If image is blurred by default --> apply forced unblur */
      if (settings.status === true && selected.style.filter === "") {
        selected.style.cssText += ";filter: blur(0px) !important;";
      } else if (settings.status === false && selected.style.filter === "") {
        /* If image is shown by default --> apply forced reblur */
        var blurAmt = "blur(" + settings.blurAmt + "px) ";
        var grayscale = settings.grayscale == true ? "grayscale(100%) " : "";
        selected.style.cssText +=
          ";filter: " + blurAmt + grayscale + " !important;";
      } else if (
        /* If image has been force unblured, then force reblur */
        cssText.substr(cssText.length - 29) === "filter: blur(0px) !important;"
      ) {
        var blurAmt = "blur(" + settings.blurAmt + "px) ";
        var grayscale = settings.grayscale == true ? "grayscale(100%) " : "";
        selected.style.cssText +=
          ";filter: " + blurAmt + grayscale + " !important;";
      } else {
        /* If image has been forced reblured, then force unblur */
        selected.style.cssText += ";filter: blur(0px) !important;";
      }

      imgFoundCSS = selected.style.cssText;
    } else {
      /* If previous image already found, set this image to same blur to prevent opposite-blur bug (where overlaying & underlying imgs in opposite blur states) */
      selected.style.cssText += ";" + imgFoundCSS.match(/(filter.*$)/)[0];
    }
  }
}
