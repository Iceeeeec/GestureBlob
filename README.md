# GestureBlob

<div align="center">
  <img src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" alt="GestureBlob Banner" width="100%" />
  
  <p align="center">
    <h3>🖐️ 用手势控制你的细胞！</h3>
    <br />
    <a href="https://blob.shuwu.site/"><strong>🔴 在线演示</strong></a>
    &nbsp;&nbsp;|&nbsp;&nbsp;
    <a href="#-功能特性"><strong>✨ 功能特性</strong></a>
    &nbsp;&nbsp;|&nbsp;&nbsp;
    <a href="#-技术栈"><strong>🛠️ 技术栈</strong></a>
  </p>
</div>

---

## 📖 项目简介

**GestureBlob** 是一款创新的多人在线网页游戏，将经典的"大鱼吃小鱼"玩法（类似 Agar.io）与 **AI 手势识别技术** 相结合，带来全新的游戏体验。

抛开键盘和鼠标——用你的摄像头来操控！基于 **Google MediaPipe** 技术，游戏可以实时追踪你的手部动作，让你通过简单的手势来控制方向、分裂和射出孢子。无论是单人练习还是与其他玩家实时对战，GestureBlob 都能为你带来独特而沉浸式的游戏体验。

## ✨ 功能特性

- **👋 AI 手势控制**：
  - **移动**：移动手掌来控制细胞的移动方向
  - **分裂 (✌️)**：做出"剪刀手"手势，细胞将分裂并向前冲刺
  - **吐孢子 (✋)**：做出"张开手掌"手势，向外射出质量
- **🕹️ 双控制模式**：可在 **手势模式**（摄像头）和 **经典模式**（键盘/鼠标/摇杆）之间无缝切换
- **🌍 实时多人对战**：通过低延迟的 Socket.IO 连接，加入房间与全球玩家一决高下
- **🤖 智能 AI 机器人**：与在地图上漫游的 AI 机器人进行练习对战
- **📱 全端响应式适配**：针对桌面端和移动端进行了优化（支持横屏锁定）
- **🌐 多语言支持**：原生支持中文和英文

## 🛠️ 技术栈

- **前端**：[React 19](https://react.dev/)、[Vite](https://vitejs.dev/)、[TailwindCSS](https://tailwindcss.com/)
- **AI 与计算机视觉**：[MediaPipe Tasks Vision](https://developers.google.com/mediapipe)（手部地标检测）
- **后端**：[Node.js](https://nodejs.org/)、[Express](https://expressjs.com/)、[Socket.IO](https://socket.io/)
- **开发语言**：[TypeScript](https://www.typescriptlang.org/)

## 🚀 快速开始

按照以下步骤在本地运行 GestureBlob。

### 环境要求

- **Node.js**（推荐 v18 及以上版本）
- **npm** 或 **yarn**

### 安装步骤

1. **克隆仓库**
   ```bash
   git clone https://github.com/yourusername/GestureBlob.git
   cd GestureBlob
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```
   应用将在 `http://localhost:5173` 启动。

4. **（可选）启动后端服务器**
   如果需要本地运行多人对战服务器：
   ```bash
   cd server
   npm install
   npm run dev
   ```

## 🎮 游戏指南

### 手势模式 🖐️
1. 允许浏览器访问摄像头权限。
2. **移动**：举起手掌，手掌相对于屏幕中心的位置决定了移动方向。
3. **速度**：手掌离中心越远，移动速度越快。
4. **分裂**：做出 **剪刀手 (✌️)** 手势。
5. **吐孢子**：做出 **张开手掌 (✋)** 手势。

### 经典模式 🕹️
- **移动**：使用 `W`、`A`、`S`、`D` 或方向键。
- **移动端**：使用屏幕上的虚拟摇杆。

## 🤝 贡献

欢迎贡献代码！请随时提交 Pull Request。

## 📄 许可证

本项目基于 MIT 许可证开源。
