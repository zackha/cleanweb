# CleanWeb Chrome Web Store Notes

## Short description

Filter images, videos, iframes, and background media with clean temporary browsing controls.

## Detailed description

CleanWeb is a minimal Chrome extension for cleaner browsing. It can blur, grayscale, and darken protected media across the web, hide videos and common embedded players, pause protection temporarily for 60 seconds, and allow or protect the current site with a shortcut or popup control.

The popup is designed as a simple grouped settings panel with clear controls for filter strength, media types, strict video hiding, per-site access, and dark mode.

## Permissions justification

Storage: Saves CleanWeb settings, theme preference, allowed sites, and the temporary pause timer.

Alarms: Automatically resumes protection when the 60-second pause ends.

Host permission: Applies the user-selected CSS filters to page content such as images, videos, iframes, and background media. This access is used only locally in the browser and is required for CleanWeb to work on visited pages.

## Package

Upload `dist/cleanweb-4.0.0.zip` to the Chrome Web Store developer dashboard.
