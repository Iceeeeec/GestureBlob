import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { GameStatus, Language } from '../types';
import { translations } from '../i18n';
import { gameSocket } from '../network/socket';
import { GameStateSnapshot, PlayerInput, BlobEntity, FoodEntity } from '../network/protocol';

// 常量
const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 3000;
const GRID_SIZE = 100;
const MOVEMENT_SMOOTHING = 0.85;
const INPUT_MAX_SPEED_DISTANCE = 60;
const GESTURE_HOLD_THRESHOLD_MS = 120;
const EJECT_COOLDOWN_MS = 150;

const COLOR_GRID = 'rgba(255, 255, 255, 0.1)';
const COLOR_PLAYER_BORDER = '#0891b2';

interface OnlineGameCanvasProps {
  playerId: string;
  onScoreUpdate: (score: number) => void;
  onStatusChange: (status: GameStatus) => void;
  onLeaderboardUpdate: (leaderboard: any[]) => void;
  gameStatus: GameStatus;
  lang: Language;
  onGameOver?: (winner: string) => void;
}

interface Camera {
  x: number;
  y: number;
  scale: number;
}

interface Point {
  x: number;
  y: number;
}

export const OnlineGameCanvas: React.FC<OnlineGameCanvasProps> = ({
  playerId,
  onScoreUpdate,
  onStatusChange,
  onLeaderboardUpdate,
  gameStatus,
  lang,
  onGameOver
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const langRef = useRef<Language>(lang);

  // MediaPipe
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);

  // 游戏状态（从服务器接收）
  const gameStateRef = useRef<GameStateSnapshot | null>(null);
  const cameraRef = useRef<Camera>({ x: 0, y: 0, scale: 1 });
  const lastFingerPosRef = useRef<Point>({ x: 0, y: 0 });
  const timeRef = useRef<number>(0);

  // 插值平滑：存储渲染用的位置（平滑过渡）
  const interpolatedPositions = useRef<Map<string, { x: number; y: number }>>(new Map());
  const INTERPOLATION_SPEED = 0.3; // 插值速度，越大越快跟上服务器位置

  // 输入状态
  const lastEjectTimeRef = useRef<number>(0);
  const lastSplitTimeRef = useRef<number>(0);
  const gestureHoldStartRef = useRef<number>(0);
  const currentInputRef = useRef<PlayerInput>({ angle: 0, throttle: 0, action: 'none' });
  const lastInputSendTime = useRef<number>(0);
  const INPUT_SEND_INTERVAL = 50; // 每 50ms 发送一次输入（20fps）

  // 键盘/触摸输入状态
  const keysRef = useRef<Set<string>>(new Set());
  const joystickRef = useRef<{ active: boolean; dx: number; dy: number }>({ active: false, dx: 0, dy: 0 });
  const joystickStartRef = useRef<Point>({ x: 0, y: 0 });
  const keyboardSplitRef = useRef<boolean>(false);
  const keyboardEjectRef = useRef<boolean>(false);

  // Audio
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const prevMassRef = useRef<number>(0); // 追踪上一帧的质量，用于检测吃食物

  const initInProgress = useRef(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  // 初始化音频
  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
      }
    }
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    // 初始化背景音乐
    if (!bgmRef.current) {
      bgmRef.current = new Audio('/music/background.mp3');
      bgmRef.current.loop = true;
      bgmRef.current.volume = 0.3;
    }
  };

  const startBgm = () => {
    initAudio();
    if (bgmRef.current && bgmRef.current.paused) {
      bgmRef.current.play().catch(() => { });
    }
  };

  const stopBgm = () => {
    if (bgmRef.current && !bgmRef.current.paused) {
      bgmRef.current.pause();
      bgmRef.current.currentTime = 0;
    }
  };

  const playEatSound = (radius: number) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    const baseFreq = Math.max(200, 800 - radius * 2);
    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq + 200, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  };

  // 初始化 MediaPipe
  useEffect(() => {
    if (handLandmarkerRef.current || initInProgress.current) return;

    const initMediaPipe = async () => {
      initInProgress.current = true;
      try {
        onStatusChange(GameStatus.LOADING_MODEL);
        // 使用本地资源
        const wasmPath = "/mediapipe";
        const modelPath = "/mediapipe/hand_landmarker.task";

        const vision = await FilesetResolver.forVisionTasks(wasmPath);
        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelPath,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        handLandmarkerRef.current = handLandmarker;
        await startCamera();
      } catch (error: any) {
        console.error("Error loading MediaPipe:", error);
        setErrorMsg("Failed to load AI Model");
        initInProgress.current = false;
      }
    };
    initMediaPipe();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  const startCamera = async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      });
      videoRef.current.srcObject = stream;
      await new Promise<void>(resolve => {
        if (videoRef.current) videoRef.current.onloadedmetadata = () => resolve();
      });
      await videoRef.current.play();
      onStatusChange(GameStatus.PLAYING);
      initAudio();
    } catch (err) {
      console.warn("Camera failed, trying fallback...", err);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          onStatusChange(GameStatus.PLAYING);
        }
      } catch (e) {
        setErrorMsg("Camera Permission Denied");
      }
    }
  };

  // 监听服务器游戏状态
  useEffect(() => {
    const handleGameState = (state: GameStateSnapshot) => {
      gameStateRef.current = state;

      // 更新排行榜
      onLeaderboardUpdate(state.leaderboard);

      // 计算自己的分数
      const myPlayer = state.players.find(p => p.id === playerId);
      if (myPlayer) {
        const mass = myPlayer.blobs.reduce((sum, b) => sum + b.radius, 0);

        // 检测质量增加，播放吃食物音效
        if (mass > prevMassRef.current + 1) {
          playEatSound(mass);
        }
        prevMassRef.current = mass;

        onScoreUpdate(mass);

        // 不再自动设置 GAME_OVER，让玩家可以观战和重生
      }
    };

    const handlePlayerDied = (diedPlayerId: string) => {
      if (diedPlayerId === playerId) {
        // 自己死亡，显示重生按钮
        onStatusChange(GameStatus.GAME_OVER);
      }
    };

    const handleGameOver = (winner: string) => {
      onGameOver?.(winner);
    };

    // 注册回调
    gameSocket.connect({
      onGameState: handleGameState,
      onPlayerDied: handlePlayerDied,
      onGameOver: handleGameOver
    });
  }, [playerId]);

  // 键盘控制
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysRef.current.add(key);
      if (key === 'j') keyboardSplitRef.current = true;
      if (key === 'k') keyboardEjectRef.current = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // 手势检测辅助
  const isFingerExtended = (landmarks: NormalizedLandmark[], tipIdx: number, pipIdx: number, wristIdx: number) => {
    const wrist = landmarks[wristIdx];
    const pip = landmarks[pipIdx];
    const tip = landmarks[tipIdx];
    const dWristPip = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
    const dWristTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
    return dWristTip > dWristPip * 1.2;
  };

  const worldToScreen = (wx: number, wy: number): Point => {
    return {
      x: wx - cameraRef.current.x,
      y: wy - cameraRef.current.y
    };
  };

  const getCentroid = (blobs: BlobEntity[]): Point => {
    if (blobs.length === 0) return { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
    let tx = 0, ty = 0, mass = 0;
    blobs.forEach(b => {
      tx += b.x * b.radius;
      ty += b.y * b.radius;
      mass += b.radius;
    });
    return { x: tx / mass, y: ty / mass };
  };

  // 主渲染循环
  const animate = () => {
    // 即使死亡也继续渲染（观战模式）
    if (gameStatus === GameStatus.PLAYING || gameStatus === GameStatus.GAME_OVER) {
      requestRef.current = requestAnimationFrame(animate);
    }
    if (!canvasRef.current || !videoRef.current || !handLandmarkerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cw = canvas.width;
    const ch = canvas.height;

    timeRef.current += 1;

    // --- 1. 输入处理 ---
    const startTimeMs = performance.now();
    let targetAngle = 0;
    let throttle = 0;
    let hasHand = false;
    let gestureType: 'NONE' | 'EJECT' | 'SPLIT' = 'NONE';

    try {
      const results = handLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
      if (results.landmarks && results.landmarks.length > 0) {
        hasHand = true;
        const landmarks = results.landmarks[0];
        const palmCenter = landmarks[9];

        const rawX = (1 - palmCenter.x) * cw;
        const rawY = palmCenter.y * ch;
        lastFingerPosRef.current = {
          x: lastFingerPosRef.current.x + (rawX - lastFingerPosRef.current.x) * MOVEMENT_SMOOTHING,
          y: lastFingerPosRef.current.y + (rawY - lastFingerPosRef.current.y) * MOVEMENT_SMOOTHING
        };

        // 手势检测
        const indexExt = isFingerExtended(landmarks, 8, 6, 0);
        const midExt = isFingerExtended(landmarks, 12, 10, 0);
        const ringExt = isFingerExtended(landmarks, 16, 14, 0);
        const pinkyExt = isFingerExtended(landmarks, 20, 18, 0);

        if (indexExt && midExt && !ringExt && !pinkyExt) {
          gestureType = 'SPLIT';
        } else if (midExt && ringExt && pinkyExt) {
          gestureType = 'EJECT';
        }

        const cx = cw / 2;
        const cy = ch / 2;
        const dx = lastFingerPosRef.current.x - cx;
        const dy = lastFingerPosRef.current.y - cy;
        const dist = Math.hypot(dx, dy);
        throttle = Math.min(dist / INPUT_MAX_SPEED_DISTANCE, 1.0);
        targetAngle = Math.atan2(dy, dx);
      }
    } catch (e) { }

    // 如果没有检测到手势，使用键盘/摇杆输入
    if (!hasHand) {
      let kbDx = 0;
      let kbDy = 0;

      // WASD 或 方向键
      if (keysRef.current.has('w') || keysRef.current.has('arrowup')) kbDy -= 1;
      if (keysRef.current.has('s') || keysRef.current.has('arrowdown')) kbDy += 1;
      if (keysRef.current.has('a') || keysRef.current.has('arrowleft')) kbDx -= 1;
      if (keysRef.current.has('d') || keysRef.current.has('arrowright')) kbDx += 1;

      // 触摸摇杆
      if (joystickRef.current.active) {
        kbDx = joystickRef.current.dx;
        kbDy = joystickRef.current.dy;
      }

      const kbDist = Math.hypot(kbDx, kbDy);
      if (kbDist > 0.1) {
        // 键盘控制使用全速
        throttle = Math.min(kbDist, 1.0);
        targetAngle = Math.atan2(kbDy, kbDx);
        // 更新 lastFingerPosRef 用于分裂/吐孢子方向
        lastFingerPosRef.current = {
          x: cw / 2 + Math.cos(targetAngle) * 100,
          y: ch / 2 + Math.sin(targetAngle) * 100
        };
      }

      // 键盘分裂/吐孢子
      if (keyboardSplitRef.current) gestureType = 'SPLIT';
      if (keyboardEjectRef.current) gestureType = 'EJECT';
    }

    // 处理动作
    const now = Date.now();
    let action: 'none' | 'eject' | 'split' = 'none';

    if (gestureType !== 'NONE') {
      if (gestureHoldStartRef.current === 0) {
        gestureHoldStartRef.current = now;
      } else if (now - gestureHoldStartRef.current > GESTURE_HOLD_THRESHOLD_MS) {
        if (gestureType === 'EJECT' && now - lastEjectTimeRef.current > EJECT_COOLDOWN_MS) {
          action = 'eject';
          lastEjectTimeRef.current = now;
          keyboardEjectRef.current = false;
        } else if (gestureType === 'SPLIT' && now - lastSplitTimeRef.current > 500) {
          action = 'split';
          lastSplitTimeRef.current = now;
          keyboardSplitRef.current = false;
        }
      }
    } else {
      gestureHoldStartRef.current = 0;
    }

    // 键盘按下立即触发（无需 hold）
    if (!hasHand) {
      if (keyboardSplitRef.current && now - lastSplitTimeRef.current > 500) {
        action = 'split';
        lastSplitTimeRef.current = now;
        keyboardSplitRef.current = false;
      }
      if (keyboardEjectRef.current && now - lastEjectTimeRef.current > EJECT_COOLDOWN_MS) {
        action = 'eject';
        lastEjectTimeRef.current = now;
        keyboardEjectRef.current = false;
      }
    }

    // 发送输入到服务器（节流：每 50ms 一次，或有动作时立即发送）
    const input: PlayerInput = { angle: targetAngle, throttle, action };

    // If split action, add hand world coordinates
    if (action === 'split') {
      input.splitTargetX = lastFingerPosRef.current.x + cameraRef.current.x;
      input.splitTargetY = lastFingerPosRef.current.y + cameraRef.current.y;
    }

    // If eject action, add hand world coordinates
    if (action === 'eject') {
      input.ejectTargetX = lastFingerPosRef.current.x + cameraRef.current.x;
      input.ejectTargetY = lastFingerPosRef.current.y + cameraRef.current.y;
    }

    currentInputRef.current = input;

    if (action !== 'none' || now - lastInputSendTime.current > INPUT_SEND_INTERVAL) {
      gameSocket.sendInput(input);
      lastInputSendTime.current = now;
    }

    // --- 2. 渲染 ---
    const state = gameStateRef.current;

    // 绘制视频背景
    ctx.save();
    ctx.translate(cw, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, 0, 0, cw, ch);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, cw, ch);
    ctx.restore();

    if (!state) return;

    // 更新相机位置
    const myPlayer = state.players.find(p => p.id === playerId);
    if (myPlayer && myPlayer.blobs.length > 0) {
      const center = getCentroid(myPlayer.blobs);
      const targetCamX = center.x - cw / 2;
      const targetCamY = center.y - ch / 2;
      cameraRef.current.x += (targetCamX - cameraRef.current.x) * 0.1;
      cameraRef.current.y += (targetCamY - cameraRef.current.y) * 0.1;
    }

    // 绘制网格
    ctx.beginPath();
    ctx.strokeStyle = COLOR_GRID;
    ctx.lineWidth = 1;
    const startGridX = Math.floor(cameraRef.current.x / GRID_SIZE) * GRID_SIZE;
    const startGridY = Math.floor(cameraRef.current.y / GRID_SIZE) * GRID_SIZE;
    for (let gx = startGridX; gx < cameraRef.current.x + cw + GRID_SIZE; gx += GRID_SIZE) {
      const sx = gx - cameraRef.current.x;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, ch);
    }
    for (let gy = startGridY; gy < cameraRef.current.y + ch + GRID_SIZE; gy += GRID_SIZE) {
      const sy = gy - cameraRef.current.y;
      ctx.moveTo(0, sy);
      ctx.lineTo(cw, sy);
    }
    ctx.stroke();

    // 绘制边界
    const tl = worldToScreen(0, 0);
    const br = worldToScreen(WORLD_WIDTH, WORLD_HEIGHT);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 5;
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

    // 绘制食物
    state.foods.forEach(food => {
      const sp = worldToScreen(food.x, food.y);
      if (sp.x > -50 && sp.x < cw + 50 && sp.y > -50 && sp.y < ch + 50) {
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, food.radius, 0, Math.PI * 2);
        ctx.fillStyle = food.color;
        ctx.fill();
      }
    });

    // 绘制所有玩家（使用插值平滑）
    state.players.forEach(player => {
      if (!player.isAlive) return;
      const isMe = player.id === playerId;

      player.blobs.forEach(blob => {
        // 获取或初始化插值位置
        const key = blob.id;
        let interpPos = interpolatedPositions.current.get(key);

        if (!interpPos) {
          // 首次出现，直接使用服务器位置
          interpPos = { x: blob.x, y: blob.y };
          interpolatedPositions.current.set(key, interpPos);
        } else {
          // 插值平滑过渡到服务器位置
          interpPos.x += (blob.x - interpPos.x) * INTERPOLATION_SPEED;
          interpPos.y += (blob.y - interpPos.y) * INTERPOLATION_SPEED;
        }

        // 使用插值位置绘制
        const smoothBlob = { ...blob, x: interpPos.x, y: interpPos.y };
        drawBlob(ctx, smoothBlob, isMe, player.name);
      });
    });

    // 绘制控制线
    if (hasHand) {
      const fPos = lastFingerPosRef.current;
      const screenCenter = { x: cw / 2, y: ch / 2 };

      ctx.beginPath();
      ctx.moveTo(screenCenter.x, screenCenter.y);
      ctx.lineTo(fPos.x, fPos.y);

      let color = 'rgba(34, 211, 238, 0.3)';
      if (gestureType === 'EJECT') color = 'rgba(244, 63, 94, 0.6)';
      if (gestureType === 'SPLIT') color = 'rgba(250, 204, 21, 0.6)';

      ctx.strokeStyle = color;
      ctx.lineWidth = gestureType === 'NONE' ? 2 : 4;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(fPos.x, fPos.y, 16, 0, Math.PI * 2);
      let fillColor = 'rgba(34, 211, 238, 0.2)';
      if (gestureType === 'EJECT') fillColor = 'rgba(244, 63, 94, 0.3)';
      if (gestureType === 'SPLIT') fillColor = 'rgba(250, 204, 21, 0.3)';
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = color.replace('0.6', '0.8').replace('0.3', '0.8');
      ctx.stroke();

      if (gestureType === 'EJECT') {
        ctx.fillStyle = '#f43f5e';
        ctx.font = 'bold 12px "Inter"';
        ctx.textAlign = 'center';
        ctx.fillText('EJECT', fPos.x, fPos.y - 26);
      } else if (gestureType === 'SPLIT') {
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 12px "Inter"';
        ctx.textAlign = 'center';
        ctx.fillText('SPLIT', fPos.x, fPos.y - 26);
      }
    }
  };

  const drawBlob = (ctx: CanvasRenderingContext2D, blob: BlobEntity, isMe: boolean, playerName: string) => {
    ctx.beginPath();
    const segments = 20;
    const time = timeRef.current;

    if (blob.radius > 10) {
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const distortion = Math.sin(theta * 6 + time * 0.1 + (blob.x * 0.01)) * (blob.radius * 0.03);
        const r = blob.radius + distortion;
        const px = blob.x + Math.cos(theta) * r;
        const py = blob.y + Math.sin(theta) * r;
        const sp = worldToScreen(px, py);
        if (i === 0) ctx.moveTo(sp.x, sp.y);
        else ctx.lineTo(sp.x, sp.y);
      }
    } else {
      const sp = worldToScreen(blob.x, blob.y);
      ctx.arc(sp.x, sp.y, blob.radius, 0, Math.PI * 2);
    }

    ctx.closePath();
    ctx.fillStyle = blob.color;
    ctx.fill();

    const spCenter = worldToScreen(blob.x, blob.y);

    ctx.lineWidth = 3;
    ctx.strokeStyle = isMe ? COLOR_PLAYER_BORDER : 'rgba(0,0,0,0.3)';
    ctx.stroke();

    if (blob.radius > 8) {
      ctx.beginPath();
      ctx.arc(spCenter.x - blob.radius * 0.3, spCenter.y - blob.radius * 0.3, blob.radius * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fill();
    }

    if (blob.radius > 15) {
      ctx.fillStyle = 'white';
      ctx.font = `bold ${Math.max(10, blob.radius * 0.4)}px "Inter"`;
      ctx.textAlign = 'center';
      const currentT = translations[langRef.current];
      const displayName = isMe ? currentT.you : playerName;
      ctx.fillText(displayName, spCenter.x, spCenter.y + 4);
    }
  };

  // 启动游戏循环 & 背景音乐
  useEffect(() => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    if (gameStatus === GameStatus.PLAYING) {
      requestRef.current = requestAnimationFrame(animate);
      startBgm();
    } else if (gameStatus === GameStatus.GAME_OVER) {
      stopBgm();
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameStatus]);

  // 触摸处理
  const handleTouchStart = (e: React.TouchEvent) => {
    initAudio();
    const touch = e.touches[0];
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = touch.clientX - rect.left;
    // 左半屏作为摇杆区域
    if (x < rect.width / 2) {
      joystickStartRef.current = { x: touch.clientX, y: touch.clientY };
      joystickRef.current = { active: true, dx: 0, dy: 0 };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!joystickRef.current.active) return;
    const touch = e.touches[0];
    const maxDist = 50;
    let dx = (touch.clientX - joystickStartRef.current.x) / maxDist;
    let dy = (touch.clientY - joystickStartRef.current.y) / maxDist;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) {
      dx /= dist;
      dy /= dist;
    }
    joystickRef.current.dx = dx;
    joystickRef.current.dy = dy;
  };

  const handleTouchEnd = () => {
    joystickRef.current = { active: false, dx: 0, dy: 0 };
  };

  const handleSplitButton = () => {
    keyboardSplitRef.current = true;
  };

  const handleEjectButton = () => {
    keyboardEjectRef.current = true;
  };

  const t = translations[lang];

  return (
    <div className="relative w-full h-full bg-black rounded-3xl overflow-hidden border border-slate-700 shadow-2xl">
      <video ref={videoRef} className="hidden" autoPlay playsInline muted />
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        className="w-full h-full object-cover"
        onClick={initAudio}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* 手机端操作按钮 */}
      <div className="absolute bottom-4 right-4 flex gap-3 sm:hidden">
        <button
          onTouchStart={handleSplitButton}
          className="w-16 h-16 bg-yellow-500/80 rounded-full text-white font-bold text-xl shadow-lg active:scale-90 transition-transform"
        >
          J
        </button>
        <button
          onTouchStart={handleEjectButton}
          className="w-16 h-16 bg-rose-500/80 rounded-full text-white font-bold text-xl shadow-lg active:scale-90 transition-transform"
        >
          K
        </button>
      </div>

      {/* 键盘操作提示 */}
      {gameStatus === GameStatus.PLAYING && (
        <div className="absolute bottom-4 left-4 hidden sm:block">
          <div className="bg-black/50 backdrop-blur px-3 py-2 rounded-lg border border-white/10 text-xs text-slate-400">
            <div>WASD: 移动 | J: 分裂 | K: 吐孢子</div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 p-8 z-50">
          <div className="max-w-md text-center">
            <div className="text-rose-500 text-5xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold text-white mb-2">{t.error}</h3>
            <p className="text-rose-300 mb-6">{errorMsg}</p>
            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-full text-white">
              {t.reload}
            </button>
          </div>
        </div>
      )}

      {gameStatus === GameStatus.LOADING_MODEL && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-40">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-cyan-400 font-mono animate-pulse">{t.initializing}</p>
        </div>
      )}
    </div>
  );
};
