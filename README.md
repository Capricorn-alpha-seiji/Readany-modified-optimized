# ReadAny Windows

This branch contains the Windows Tauri desktop build of ReadAny.

The Android build is kept separately on the `main` branch. This `windows` branch is used so the Android and Windows editions can coexist in the same GitHub repository without overwriting each other.

## Build

```powershell
pnpm install
pnpm --filter app build
pnpm --filter app tauri build --target x86_64-pc-windows-gnu --bundles nsis --ci --no-sign --ignore-version-mismatches
```

## Release Artifact

Windows installers are published under tags prefixed with `win-`, for example `win-v1.0.0`.
