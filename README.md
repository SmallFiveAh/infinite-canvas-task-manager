<div align="center">
  <img src="public/favicon.svg" alt="Logo" width="80" height="80" />
  <h1>Infinite Canvas Task Manager</h1>
  <p>基于 React + Vite 的无限画布任务管理器 · 仿 Excalidraw 风格的可视化协作白板</p>

  <p align="center">
    <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19" />
    <img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" alt="Vite 8" />
    <img src="https://img.shields.io/badge/Bootstrap%20Icons-1.13-7952B3?logo=bootstrap&logoColor=white" alt="Bootstrap Icons" />
    <img src="https://img.shields.io/badge/License-MIT-green" alt="License: MIT" />
  </p>
</div>

---

## ✨ 特性

- 🖼️ **无限画布** — Excalidraw 风格点阵网格，支持拖拽平移与以鼠标为中心的滚轮缩放
- 📝 **便利贴系统** — 支持矩形 / 异形（水滴、波浪、花朵、圆形、心形、齿轮）便签，8 种配色方案
- 🎨 **便签样式面板** — 单击选择便签样式，拖放快速创建，交互流畅
- 🔲 **框选与多选** — 框选多个便签，支持 Shift 追加选择，点击空白清空
- 🖱️ **右键菜单** — 支持粘贴、解锁、导入、嵌入、视图等操作
- 🔒 **工具锁定** — 可选锁定模式，工具使用后保持选中状态
- 🔍 **缩放控制** — 缩放下拉菜单支持快速跳转到预设比例，实时百分比显示
- ⌨️ **键盘快捷键** — V 切换选择模式，H 切换移动模式，Esc 清除选中
- 🎯 **顶部工具栏** — 锁定、视图模式、缩放、撤销/重做一应俱全

## 🏗️ 项目结构

```
infinite-canvas-task-manager/
├── src/
│   ├── InfiniteCanvas/    # 核心无限画布组件（网格绘制、缩放、平移、便签渲染）
│   ├── leftSidebar/       # 左侧工具栏（形状/文字/便签等工具面板）
│   ├── toolBar/           # 顶部工具栏（锁定/视图/缩放/撤销重做）
│   ├── stickyPalette/     # 便签样式面板（矩形 / 异形 / 配色）
│   ├── contextMenu/       # 右键上下文菜单
│   ├── App.jsx            # 应用入口，管理全局状态
│   └── main.jsx           # React 挂载入口
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── index.html
├── vite.config.js
└── package.json
```

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（带 HMR 热更新）
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview

# 代码检查
npm run lint
```

## 🖱️ 使用指南

### 画布操作

| 操作 | 方法 |
|------|------|
| 平移画布 | 左键按住空白区域拖拽（移动模式） / 中键拖拽（选择模式） |
| 缩放画布 | 滚轮上下滚动，以鼠标位置为中心缩放 |
| 恢复 100% | 点击右下角缩放指示器 |
| 切换模式 | 顶部工具栏按钮 / 快捷键 V（选择）、H（移动） |

### 便签操作

| 操作 | 方法 |
|------|------|
| 创建便签 | 从左侧工具栏拖放便签到画布 / 单击便签按钮选择样式 |
| 移动便签 | 左键拖拽便签 |
| 缩放便签 | 选中便签后拖拽四角圆形手柄 |
| 选择便签 | 选择模式下点击便签 |
| 多选 | Shift + 点击 / Shift + 框选 |
| 框选 | 选择模式下在空白区域拖拽形成矩形框 |
| 删除选中 | 选中后按 Esc 清空 |

### 右键菜单

在画布任意位置右键点击，可访问以下操作：
- **粘贴** — 从剪贴板粘贴内容
- **解锁全部** — 解锁所有已锁定元素
- **本地导入 / 在线嵌入 / 素材库** — 导入外部资源
- **视图** — 调整画布显示方式
- **偏好设置** — 个性化配置

## 📸 截图预览

<div align="center">
  <img src="public/favicon.svg" alt="Screenshot 1" width="400" />
  <p align="center"><em>截图占位 — 待添加应用截图</em></p>
</div>

## 🛠️ 技术栈

- **框架**: React 19
- **构建**: Vite 8
- **图标**: Bootstrap Icons 1.13
- **字体**: Caveat / Gochi Hand (Google Fonts)
- **代码规范**: Oxlint

## 📄 许可证

本项目基于 MIT 许可证开源。
