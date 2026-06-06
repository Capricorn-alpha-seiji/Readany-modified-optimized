param(
  [string]$Architecture = "arm64-v8a"
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Local = Join-Path $Root ".local"
$Sdk = Join-Path $Local "android-sdk"
$JavaHome = Join-Path $Local "jdk"
$NodeHome = Join-Path $Local "node"
$PnpmEntry = Join-Path $Local "npm-global\node_modules\pnpm\bin\pnpm.cjs"
$AndroidDir = Join-Path $Root "packages\app-expo\android"

New-Item -ItemType Directory -Path (Join-Path $Local "tmp") -Force | Out-Null

$env:JAVA_HOME = $JavaHome
$env:ANDROID_HOME = $Sdk
$env:ANDROID_SDK_ROOT = $Sdk
$env:ANDROID_USER_HOME = Join-Path $Local ".android"
$env:GRADLE_USER_HOME = Join-Path $Local "gradle"
$env:NPM_CONFIG_CACHE = Join-Path $Local "npm-cache"
$env:PNPM_HOME = Join-Path $Local "pnpm-home"
$env:COREPACK_HOME = Join-Path $Local "corepack"
$env:TEMP = Join-Path $Local "tmp"
$env:TMP = Join-Path $Local "tmp"
$env:APP_VARIANT = "production"
$env:EXPO_NO_TELEMETRY = "1"
$env:EXPO_NO_METRO_WORKSPACE_ROOT = "1"
$env:Path = "$NodeHome;$(Join-Path $Local "npm-global");$(Join-Path $JavaHome "bin");$(Join-Path $Sdk "cmdline-tools\latest\bin");$(Join-Path $Sdk "platform-tools");$env:Path"

Set-Content -LiteralPath (Join-Path $AndroidDir "local.properties") -Value ("sdk.dir=" + ($Sdk -replace "\\", "/")) -Encoding ASCII

& (Join-Path $NodeHome "node.exe") $PnpmEntry --filter "@readany/app-expo" run build:reader
& (Join-Path $AndroidDir "gradlew.bat") -p $AndroidDir ":app:assembleRelease" "-PreactNativeArchitectures=$Architecture" "--no-daemon" "--stacktrace"
