# GestureBlob

<div align="center">
  <img src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" alt="GestureBlob Banner" width="100%" />
  
  <p align="center">
    <h3>🖐️ Control Your Blob with Hand Gestures!</h3>
    <br />
    <a href="https://blob.shuwu.site/"><strong>🔴 Live Demo</strong></a>
    &nbsp;&nbsp;|&nbsp;&nbsp;
    <a href="#-features"><strong>✨ Features</strong></a>
    &nbsp;&nbsp;|&nbsp;&nbsp;
    <a href="#-tech-stack"><strong>🛠️ Tech Stack</strong></a>
  </p>
</div>

---

## 📖 Introduction

**GestureBlob** is an innovative multiplayer web game that brings the classic "eat-and-grow" mechanic (similar to Agar.io) to the next level with **AI-powered hand gesture controls**.

Forget the mouse and keyboard—use your webcam to navigate! Powered by **Google MediaPipe**, the game tracks your hand movements in real-time, allowing you to steer, split, and shoot spores with simple gestures. Whether you're playing solo or competing against others in real-time, GestureBlob offers a unique and immersive experience.

## ✨ Features

- **👋 AI Gesture Control**: 
  - **Navigate**: Move your hand to steer your blob.
  - **Split (✌️)**: Show a "Victory" gesture to split your blob and launch forward.
  - **Eject (✋)**: Show an "Open Hand" gesture to shoot mass and feed others (or viruses!).
- **🕹️ Dual Control Modes**: Switch seamlessly between **Gesture Mode** (Webcam) and **Classic Mode** (Keyboard/Mouse/Joystick).
- **🌍 Real-Time Multiplayer**: Join rooms and compete with players worldwide using a low-latency Socket.IO connection.
- **🤖 Smart Bots**: Practice against AI-controlled bots that roam the map.
- **📱 Fully Responsive**: Optimized for both Desktop and Mobile (with landscape lock support).
- **🌐 Multi-language**: Native support for English and Chinese (中文).

## 🛠️ Tech Stack

- **Frontend**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/), [TailwindCSS](https://tailwindcss.com/)
- **AI & Computer Vision**: [MediaPipe Tasks Vision](https://developers.google.com/mediapipe) (Hand Landmarker)
- **Backend**: [Node.js](https://nodejs.org/), [Express](https://expressjs.com/), [Socket.IO](https://socket.io/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)

## 🚀 Getting Started

Follow these steps to run GestureBlob locally.

### Prerequisites

- **Node.js** (v18+ recommended)
- **npm** or **yarn**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/GestureBlob.git
   cd GestureBlob
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the Development Server**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173`.

4. **(Optional) Start the Backend Server**
   If you want to run the multiplayer server locally:
   ```bash
   cd server
   npm install
   npm run dev
   ```

## 🎮 How to Play

### Gesture Mode 🖐️
1. Enable camera access when prompted.
2. **Move**: Hold your hand up. The position of your hand relative to the center of the screen controls the direction.
3. **Speed**: Move your hand further from the center to move faster.
4. **Split**: Make a **Victory (✌️)** sign.
5. **Shoot**: Make an **Open Hand (✋)** sign.

### Classic Mode 🕹️
- **Move**: Use `W`, `A`, `S`, `D` or Arrow Keys.
- **Mobile**: Use the on-screen joystick.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.
