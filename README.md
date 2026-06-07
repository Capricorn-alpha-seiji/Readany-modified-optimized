The Windows version is released independently, with its source code on the `windows` branch; the Android version remains on the `main` branch. Both versions coexist without overwriting each other.

## Branches and Tags

- Android / Expo: `main`
- Windows / Tauri: `windows`
- Windows Release Tag: `win-v1.0.0`
- App Version: `1.0.0`

## Changelog

### Cleanup and De-bloating

- Removed update entry points, help center, ICP filing information, and feedback channels related to the original development team.
- Removed paths that sent data to the original development team's servers.
- Preserved user-configurable capabilities, such as AI Provider, WebDAV, and LAN sync.
- Added a network permission toggle in Settings to control non-essential network access.

### Reading Experience

- Pressing `Esc` while reading now closes the current book.
- Right-clicking on the reading page no longer shows the default WebView context menu; instead, it triggers the reading menu logic.
- When reading, the global TabBar and window controls enter an immersive auto-hide mode to avoid covering the content.
- Fixed an issue where the file picker would not open when importing local files while network access was disabled.
- Fixed an issue where window controls (minimize, maximize, close) did not work when no book was imported.

### Animation Optimization

- Page transitions, dialogs, overlays, buttons, cards, tabs, toolbars, and progress feedback have been upgraded with lightweight micro-interactions.
- Animations now use only `transform` and `opacity`, avoiding layout-triggering properties like `width`, `height`, `top`, `left`, and `padding`.
- Page and toolbar animations use `cubic-bezier(0.16, 1, 0.3, 1)`.
- Button, overlay, and dialog animations use `cubic-bezier(0.34, 1.56, 0.64, 1)`.

## Verification

The following builds have passed:

pnpm --filter app build
pnpm --filter app tauri build --target x86_64-pc-windows-gnu --bundles nsis --ci --no-sign --ignore-version-mismatches

During the build, you may still see Tauri version mismatch warnings, Vite large chunk warnings, or externalization warnings for browser compatibility; these are warnings, not compilation errors.

## Installer Checksum

File: `ReadAny_1.0.0_x64-setup.exe`

SHA256:

DA4BB5321FEF1E751A89FBCCA5E31E3CC90D743EE0C6AF5B7F2FC79DA01C0CD4
