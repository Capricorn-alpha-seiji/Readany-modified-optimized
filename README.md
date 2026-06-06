# ReadAny Modified Optimized

An unofficial Android-focused modified build of ReadAny.

This repository keeps the app source available for the Android APK published in the releases. The current pre-release focuses on practical reading improvements, cleanup of nonessential entry points, and clearer distribution metadata.

## Current Release

- Version: `1.3.2-pre2`
- Target platform: Android
- Package name: `com.readany.app`
- Developer label: `Capricorn-alpha`
- License: `GPL-3.0-or-later`

## What Changed

- Added volume-key page turning in the Android reading screen.
- Fixed the table of contents panel so it opens near the current chapter instead of always starting from the top.
- Removed feedback, help center, update prompts, update checks, record/filing text, and original developer-facing metadata from the Android UI.
- Disabled the default non-AI update and feedback network paths.
- Added build metadata display with timestamp support.
- Kept local build dependencies isolated under `.local/` so the workspace can be cleaned by deleting that directory.

## Android APK

Download the APK from the GitHub Releases page:

[Releases](https://github.com/Capricorn-alpha-seiji/Readany-modified-optimized/releases)

The `v1.3.2-pre2` APK is a pre-release build. It is intended for testing and personal use before a stable release.

## Build From Source

The Android build is driven by the local script:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build-android-apk.ps1
```

The release APK is generated at:

```text
packages\app-expo\android\app\build\outputs\apk\release\app-release.apk
```

Local toolchains and caches should remain inside `.local/` or other ignored build/cache directories. They are intentionally not committed.

## Source Distribution

This project is distributed under `GPL-3.0-or-later`.

If you redistribute APK files or other binaries built from this repository, provide the corresponding source code under the same license.

See:

- [LICENSE](LICENSE)
- [NOTICE.md](NOTICE.md)

## Notes

This is not an official upstream build. It is a modified Android-oriented fork maintained separately.

AI-related features may still communicate with user-configured AI service providers. Other sync or import features such as WebDAV/S3 are user-configured and depend on the settings entered by the user.

## Acknowledgements

Thanks to the original ReadAny development team for the upstream project:

[codedogQBY/ReadAny](https://github.com/codedogQBY/ReadAny)
