# CleanWeb Chrome Web Store Notes

## Short description

Filter images, videos, iframes, and background media with clean temporary browsing controls.

## Detailed description

CleanWeb is a minimal Chrome extension for cleaner browsing. It can blur, grayscale, and darken protected media across the web, hide videos and common embedded players, pause protection temporarily for 60 seconds, and allow or protect the current site with a shortcut or popup control.

The popup is designed as a simple grouped settings panel with clear controls for filter strength, media types, strict video hiding, per-site access, and dark mode.

## Permissions justification

Storage: Saves CleanWeb settings, theme preference, allowed sites, and the temporary pause timer.

Active tab: Applies the current settings to the active page and supports the current-site allow/protect control.

Alarms: Automatically resumes protection when the 60-second pause ends.

## Package

Upload `dist/cleanweb-4.0.0.zip` to the Chrome Web Store developer dashboard.
