# ReadAny Windows 桌面版

这是 ReadAny 的 Windows Tauri 桌面端源码分支。

仓库中 Android 与 Windows 版本采用分支共存：

- `main`：Android / Expo 版本，保留原有移动端发布历史。
- `windows`：Windows / Tauri 桌面版，独立维护源码、构建脚本和 Release。
- Windows 发布标签统一使用 `win-` 前缀，例如 `win-v1.0.0`，避免与 Android 标签混淆。

## 当前版本

- 应用名称：ReadAny
- Windows 版本：`1.0.0`
- Release 标签：`win-v1.0.0`
- 安装包：`ReadAny_1.0.0_x64-setup.exe`
- 平台：Windows x64
- 框架：Tauri 2 + React + TypeScript + Vite + Rust

## 本版重点

### 纯净化处理

- 移除了原开发团队相关的更新入口、帮助中心、备案信息和反馈通道。
- 移除了发送到原开发团队服务端的相关路径。
- 保留用户主动配置的能力，例如 AI Provider、WebDAV、局域网同步等。
- 设置中提供联网许可控制，用于控制非必要联网行为。

### 阅读体验

- 支持在阅读状态下按 `Esc` 关闭当前阅读书籍。
- 阅读页右键不再弹出 WebView 默认菜单，而是进入阅读菜单逻辑。
- 阅读状态下全局 TabBar 与窗口控制会进入沉浸隐藏，避免遮挡正文。
- 修复禁用联网时本地文件导入无法打开文件选择器的问题。
- 修复未导入书籍时顶部窗口控制无法最小化、最大化、关闭的问题。

### 动效优化

- 页面切换、弹窗、浮层、按钮、卡片、Tab、工具栏和进度反馈已升级为轻量微交互。
- 动画只使用 `transform` 与 `opacity`，避免 `width`、`height`、`top`、`left`、`padding` 等重排属性。
- 主要动效曲线：
  - `cubic-bezier(0.16, 1, 0.3, 1)`：页面切换、淡入淡出、工具栏隐藏。
  - `cubic-bezier(0.34, 1.56, 0.64, 1)`：按钮按压、浮层、弹窗微回弹。

## 安装包

Windows 安装包在 GitHub Release 中发布：

```text
ReadAny_1.0.0_x64-setup.exe
```

SHA256：

```text
DA4BB5321FEF1E751A89FBCCA5E31E3CC90D743EE0C6AF5B7F2FC79DA01C0CD4
```

## 开发环境

需要准备：

- Node.js
- pnpm
- Rust 工具链
- Windows GNU 或 MSVC 构建环境
- Tauri CLI

安装依赖：

```powershell
pnpm install
```

前端构建：

```powershell
pnpm --filter app build
```

Windows NSIS 安装包构建：

```powershell
pnpm --filter app tauri build --target x86_64-pc-windows-gnu --bundles nsis --ci --no-sign --ignore-version-mismatches
```

构建完成后，安装包通常位于：

```text
packages/app/src-tauri/target/x86_64-pc-windows-gnu/release/bundle/nsis/
```

程序本体通常位于：

```text
packages/app/src-tauri/target/x86_64-pc-windows-gnu/release/app.exe
```


## 已验证

本次 `win-v1.0.0` 发布前已通过：

```text
pnpm --filter app build
pnpm --filter app tauri build --target x86_64-pc-windows-gnu --bundles nsis --ci --no-sign --ignore-version-mismatches
```

构建中可能仍会看到 Tauri 包版本提示、Vite 大 chunk 提示或浏览器兼容外部化提示；这些是警告，不是编译阻断。
