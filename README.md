<p align="center">
  <img src="./media/logo.png" alt="LobeHub Markdown Editor Logo" width="128" height="128" />
</p>

# LobeHub Markdown Editor for VS Code

<p align="center">
  <a href="https://open-vsx.org/extension/joey-41/lobehub-markdown-editor">
    <img src="https://img.shields.io/open-vsx/v/joey-41/lobehub-markdown-editor?color=blue&label=Open%20VSX" alt="Open VSX Version" />
  </a>
  <a href="https://open-vsx.org/extension/joey-41/lobehub-markdown-editor">
    <img src="https://img.shields.io/open-vsx/dt/joey-41/lobehub-markdown-editor?color=green&label=Downloads" alt="Open VSX Downloads" />
  </a>
  <a href="https://github.com/joey-41/vscode-markdown-editor-lobehub/blob/main/LICENSE.txt">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" />
  </a>
</p>

<p align="center">
  <a href="#-中文说明">中文说明</a> | <a href="#-english">English</a>
</p>

---

## 📖 中文说明

### 💡 产品简介

**LobeHub Markdown Editor** 是一款专为 VS Code 打造的现代富文本风格 Markdown 可视化编辑器。

告别传统 Markdown 左右分屏对照预览的割裂体验，LobeHub Markdown Editor 将类 Notion 的沉浸式所见即所得（WYSIWYG）体验带入 VS Code。无论是撰写技术文档、个人笔记还是产品方案，都能享受到流畅、优雅且直观的排版创作体验，同时与 VS Code 本地文件保持原生双向同步。

---

### 🛒 市场下载与安装

- **Open VSX 插件市场**：[https://open-vsx.org/extension/joey-41/lobehub-markdown-editor](https://open-vsx.org/extension/joey-41/lobehub-markdown-editor)
- **VS Code / Cursor / VSCodium 内一键安装**：
  在扩展市场搜索框输入 `LobeHub Markdown Editor` 或 `joey-41`，点击 **Install** 即可。
- **离线 VSIX 安装**：
  在 Release 页面下载最新 `.vsix` 文件，在 VS Code 扩展面板右上角点击 `...` -> 选择 `Install from VSIX...` 完成安装。

---

### ✨ 核心功能与产品特色

- 🖋️ **现代所见即所得排版**
  - **斜杠命令（Slash `/`）**：按下 `/` 即可快捷唤出所有块级元素（各级标题、无序/有序列表、任务清单、引用、分割线、代码块、表格、数学公式等）。
  - **气泡浮动工具栏**：选中文字即刻唤出高阶排版气泡（加粗、斜体、下划线、删除线、行内代码、超链接、文字高亮）。
  - **富文本表格可视化编辑**：支持单元格选中、行列快速增删与键盘方向键导航，告别手写 Markdown 语法对齐的繁琐。

- 📊 **交互式 Mermaid 图表引擎**
  - 代码块语言声明为 `mermaid`（或 `mmd`）时，实时在下方渲染流程图、时序图、架构图等。
  - **无级缩放与平移**：提供工具栏缩放按钮（20% ~ 400%）、`Ctrl/Cmd + 鼠标滚轮` 平滑缩放，以及鼠标左键抓取平移（Pan），超大复杂图表局部细节清晰可见。
  - **独立全屏沉浸模式**：一键切换至全屏视口沉浸式查看大型架构图，按 `Esc` 轻松退出。
  - **默认折叠源码**：优先呈现高清图表视图，整洁不遮挡，需要时可随时手动展开编辑源码。

- ⚡ **原生级双向数据同步**
  - 完美契合 VS Code `Custom Editor` 规范，编辑内容与底层 `.md` 文件实时同步。
  - 完整支持快捷键 `Cmd/Ctrl + S` 随手保存，防止意外丢失。
  - 随时可在可视化富文本编辑器与 VS Code 原生纯文本编辑器之间无缝切换。

- 📑 **智能目录（TOC）与长文导航**
  - 根据文档标题层级自动生成导航目录树。
  - 支持多级展开/折叠与精准锚点点击跳转，长篇大作浏览定位更轻松。

- 🖼️ **本地图片直接粘贴与无缝落盘**
  - 截图后可直接粘贴（`Ctrl/Cmd + V`）至文档中。
  - 自动将图片安全落盘至当前文档所在目录或媒体目录，并在 Markdown 中自动引用相对路径。

- 🎨 **深度自适应 VS Code 原生主题**
  - 深度适配 VS Code 浅色（Light）、深色（Dark）及高对比度主题。
  - 自适应融入当前编辑器的背景底色、文字颜色与边框样式，原生感十足。

---

### 🚀 快速上手

1. **打开文件**：
   在资源管理器中右键任意 `.md` 或 `.markdown` 文件，选择 **「打开方式... (Open With)」** -> 选择 **「LobeHub Markdown Editor」**。
2. **设为默认打开方式（推荐）**：
   在「打开方式...」弹窗中点击「配置默认编辑器」，选择 **LobeHub Markdown Editor**，后续双击 Markdown 文件将直接进入所见即所得富文本模式。
3. **切换回纯文本模式**：
   随时点击编辑器右上角的「...」或右键标签页选择「使用...打开」->「文本编辑器 (Text Editor)」即可切回代码视图。

---

### ⚙️ 个性化配置

在 VS Code `settings.json` 中支持以下个性化配置：

```json
{
  // 是否自动使用 VS Code 当前主题颜色（推荐开启，视觉浑然一体）
  "lobehub-markdown-editor.useVscodeThemeColor": true,

  // 编辑器正文区域的最大宽度限制（px），默认 780，支持 560 ~ 1200
  "lobehub-markdown-editor.editorMaxWidth": 780
}
```

---

## 🌐 English

### 💡 Overview

**LobeHub Markdown Editor** is a modern, Notion-like WYSIWYG Markdown visual editor designed for VS Code.

Say goodbye to split-pane preview fatigue. LobeHub Markdown Editor brings an elegant, visual, and distraction-free writing experience directly into VS Code, while maintaining native, millisecond-level two-way synchronization with your local Markdown files.

---

### 🛒 Download & Installation

- **Open VSX Registry**: [https://open-vsx.org/extension/joey-41/lobehub-markdown-editor](https://open-vsx.org/extension/joey-41/lobehub-markdown-editor)
- **In VS Code / Cursor / VSCodium**:
  Search for `LobeHub Markdown Editor` or `joey-41` in the Extensions marketplace and click **Install**.
- **Manual VSIX Installation**:
  Download the latest `.vsix` package from Releases, open the Extensions view in VS Code, click `...` -> select `Install from VSIX...`.

---

### ✨ Key Features

- 🖋️ **Modern WYSIWYG Editing**
  - **Slash Commands (`/`)**: Type `/` to insert any block element instantly (headings, lists, task lists, quotes, dividers, code blocks, tables, math formulas).
  - **Floating Bubble Toolbar**: Select text to format (bold, italic, strikethrough, underline, inline code, link, highlight).
  - **Interactive Rich Tables**: Visual cell selection, row/column operations, and arrow-key navigation without tedious manual alignment.

- 📊 **Interactive Mermaid Diagram Viewer**
  - Live preview for any code block with language `mermaid` or `mmd`.
  - **Interactive Zoom & Pan**: Toolbar zoom buttons (20% – 400%), `Ctrl/Cmd + Wheel` smooth zooming, and drag-to-pan support for inspecting complex charts.
  - **Fullscreen Mode**: Inspect intricate architecture diagrams in an expansive fullscreen overlay (press `Esc` to exit).
  - **Collapsed by Default**: Code is tucked away by default to prioritize diagrams, while remaining editable on demand.

- ⚡ **Seamless Two-Way Document Sync**
  - Native integration with VS Code's `CustomTextEditorProvider`.
  - Full support for `Cmd/Ctrl + S` saving.
  - Effortlessly toggle between visual editor and plain text editor anytime.

- 📑 **Smart Table of Contents (TOC)**
  - Auto-generated hierarchical navigation based on heading levels.
  - Supports expand/collapse and instant jump navigation for long-form writing.

- 🖼️ **Image Paste & Local Management**
  - Paste images directly from clipboard (`Ctrl/Cmd + V`).
  - Automatically saves images to your workspace directory and links them via relative paths.

- 🎨 **Adaptive VS Code Theme Integration**
  - Harmonious integration with VS Code dark, light, and high-contrast color themes.

---

### 🚀 Getting Started

1. Right-click any `.md` or `.markdown` file in the Explorer.
2. Select **Open With...** -> **LobeHub Markdown Editor**.
3. (Optional) Select **Configure default editor for '*.md'** to open Markdown files in LobeHub by default.

---

### ⚙️ Settings

Customize in VS Code `settings.json`:

```json
{
  "lobehub-markdown-editor.useVscodeThemeColor": true,
  "lobehub-markdown-editor.editorMaxWidth": 780
}
```

---

## License

[MIT](LICENSE.txt)
