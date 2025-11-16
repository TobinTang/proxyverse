![Proxyverse](./public/full-logo.svg)

[![Build Extension](https://github.com/bytevet/proxyverse/actions/workflows/build.yml/badge.svg)](https://github.com/bytevet/proxyverse/actions/workflows/build.yml)
[![Test](https://github.com/bytevet/proxyverse/actions/workflows/test.yml/badge.svg)](https://github.com/bytevet/proxyverse/actions/workflows/test.yml)

Proxyverse is a simple tool to help you switch between different proxy profiles. Proxyverse is an alternative extension to Proxy SwitchyOmega.

Proxyverse is built with the latest dev stack that complies with the latest standard of Chrome web extension.

It's still in the early development stage, and more features are still on the way, including but no limited to

- [x] Basic profile switch support
- [x] Support proxy authentication
- [x] Support auto switch rules
- [x] Support more languages
- [ ] Support customized preference
- [ ] Support Safari
- [x] Support Firefox


# How to download?

- [Chrome](https://chromewebstore.google.com/detail/proxyverse/igknmaflmijecdmjpcgollghmipkfbho)
- [Microsoft Edge](https://microsoftedge.microsoft.com/addons/detail/bpjcpinklkdfabcncofogcaigmmgjjbj)
- [Firefox](https://addons.mozilla.org/en-US/firefox/addon/proxyverse/)


# Making a Contribution

## Development

1. Fork the repository and make changes.
2. Write unit tests. If applicable, write unit tests for your changes to ensure they don't break existing functionality. Our project uses [vitest](https://vitest.dev/) for unit testing.
3. Make sure everything works perfectly before you make any pull request.


## Translation & i18n

Proxyverse is using [transifex](https://explore.transifex.com/bytevet/proxyverse/) for translations.

✅ Summary of Modifications 

This fork focuses on privacy, UI improvements, and local-only operation.
All tracking, telemetry, and remote reporting features have been fully removed.
All data now stays entirely on the user’s device.

🔐 1. Removed All Remote Upload / Telemetry Modules

Removed Sentry Vue SDK, Sentry Vite plugin, and all related code

Removed all build-time telemetry and analyzer tools

No analytics, no telemetry, no error reporting

No user data or configuration is ever uploaded anywhere

All extension logic now runs purely locally.

🖥 2. Rebuilt Popup UI (Cleaner & More Compact)

Removed old “Custom Profiles” card section

Added new simple menu structure:

Direct Connection

System Proxy

Create New Profile

Proxy profile list

Added macOS-style ultra-thin dividers

Reduced row height for a compact look

Improved highlight & hover styles

🌍 3. Added Country / City Detection with Flag Display

Each proxy profile now automatically displays:

Country flag emoji

Exit city (e.g., Tokyo, Hong Kong, Singapore)

Output is stored in chrome.storage.local

Displayed consistently in the proxy list

Previously incorrect HK detection fixed (switched to ip-api.com)

🧭 4. Added "Current Exit IP" Status Bar

Bottom of popup now shows:

Current Exit IP: 203.0.113.5 🇭🇰 Hong Kong


Auto-refreshes whenever proxy mode changes

Left-aligned for cleaner UI

🌐 5. Added IP Check Button

New “IP” button in footer

Opens https://ip.sb for manual verification

No data is uploaded; only a browser navigation

🧹 6. Removed Build-Time Visualizer Popups

Removed rollup-plugin-visualizer

No more automatic /stats.html generation

No browser popup during build

🔒 7. Local Storage Only

All profile data stored in:

chrome.storage.local


No cloud sync

No remote configuration

No remote dependencies except optional IP lookup

Completely offline-capable

