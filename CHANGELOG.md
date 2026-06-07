# Changelog

## win-v1.0.0 - 2026-06-07

- Added Windows Tauri desktop source tree on the dedicated `windows` branch.
- Set desktop application version to `1.0.0`.
- Removed original upstream update/help/filing/feedback traces from the Windows build.
- Added explicit network permission control while keeping user-configured providers such as AI providers and WebDAV available.
- Fixed local file import behavior when network access is disabled.
- Restored desktop window controls on non-reader screens and hid global chrome during immersive reading.
- Added `Esc` handling to close the active reader book.
- Replaced the browser context menu with reader-oriented right-click behavior.
- Upgraded page transitions, floating panels, dialogs, buttons, cards, tab items, and progress feedback to GPU-friendly `transform` and `opacity` motion.
- Built and verified the Windows NSIS installer.

Installer SHA256:

```text
DA4BB5321FEF1E751A89FBCCA5E31E3CC90D743EE0C6AF5B7F2FC79DA01C0CD4
```
