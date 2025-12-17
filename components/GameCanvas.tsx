
import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { GameStatus, Point, Particle, BlobEntity, Camera, LeaderboardEntry, Language } from '../types';
import { translations } from '../i18n';
import {
  INITIAL_PLAYER_RADIUS,
  MIN_FOOD_RADIUS,
  MAX_FOOD_RADIUS,
  FOOD_COUNT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  GRID_SIZE,
  BASE_SPEED,
  MOVEMENT_SMOOTHING,
  INPUT_MAX_SPEED_DISTANCE,
  GROWTH_FACTOR,
  FOOD_COLORS,
  COLOR_PLAYER_CORE,
  COLOR_PLAYER_BORDER,
  COLOR_GRID,
  SPORE_RADIUS,
  SPORE_SPEED,
  MIN_EJECT_RADIUS,
  EJECT_COOLDOWN_MS,
  FOOD_FRICTION,
  BOT_COUNT,
  BOT_NAMES,
  BOT_VIEW_DISTANCE,
  GESTURE_HOLD_THRESHOLD_MS,
  PLAYER_TURN_SPEED,
  MIN_SPLIT_RADIUS,
  SPLIT_FORCE,
  MAX_PLAYER_BLOBS,
  MERGE_COOLDOWN_MS,
  SELF_COLLISION_PUSH,
  MERGE_ATTRACTION,
  MERGE_OVERLAP_RATIO
} from '../constants';

interface GameCanvasProps {
  onScoreUpdate: (score: number) => void;
  onStatusChange: (status: GameStatus) => void;
  onLeaderboardUpdate: (leaderboard: LeaderboardEntry[]) => void;
  gameStatus: GameStatus;
  lang: Language;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  onScoreUpdate,
  onStatusChange,
  onLeaderboardUpdate,
  gameStatus,
  lang
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const langRef = useRef<Language>(lang);

  // Sync lang ref for game loop
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  // Logic Refs
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);

  // Game State Refs
  // Player is now an array of blobs
  const playerRef = useRef<BlobEntity[]>([]);

  const foodsRef = useRef<BlobEntity[]>([]);
  const botsRef = useRef<BlobEntity[]>([]);
  const cameraRef = useRef<Camera>({ x: 0, y: 0, scale: 1 });
  const lastFingerPosRef = useRef<Point>({ x: 0, y: 0 }); // Screen coordinates
  const particlesRef = useRef<Particle[]>([]);
  const scoreRef = useRef<number>(0);
  const timeRef = useRef<number>(0); // For wobble animation
  const lastEjectTimeRef = useRef<number>(0);
  const lastSplitTimeRef = useRef<number>(0);
  const gestureHoldStartRef = useRef<number>(0);

  // Audio Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bgmOscRef = useRef<OscillatorNode | null>(null);
  const bgmGainRef = useRef<GainNode | null>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);

  const initInProgress = useRef(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- Audio System ---
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

  const playShootSound = () => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  };

  const playSplitSound = () => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  };

  const playPopSound = () => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  };

  const startBGM = () => {
    initAudio();
    // 初始化背景音乐
    if (!bgmRef.current) {
      bgmRef.current = new Audio('/music/background.mp3');
      bgmRef.current.loop = true;
      bgmRef.current.volume = 0.3;
    }
    if (bgmRef.current.paused) {
      bgmRef.current.play().catch(() => { });
    }
  };

  const stopBGM = () => {
    if (bgmRef.current && !bgmRef.current.paused) {
      bgmRef.current.pause();
      bgmRef.current.currentTime = 0;
    }
  };

  // --- Initialization ---
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
        setErrorMsg("Failed to load AI Model. Please check your network connection.");
        initInProgress.current = false;
      }
    };
    initMediaPipe();
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      stopBGM();
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
      onStatusChange(GameStatus.IDLE);
    } catch (err) {
      console.warn("Camera failed, trying fallback...", err);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          onStatusChange(GameStatus.IDLE);
        }
      } catch (e) {
        setErrorMsg("Camera Permission Denied");
      }
    }
  };

  // --- Game Mechanics ---

  const spawnFood = (count: number) => {
    for (let i = 0; i < count; i++) {
      foodsRef.current.push({
        id: `food-${Math.random()}`,
        x: Math.random() * WORLD_WIDTH,
        y: Math.random() * WORLD_HEIGHT,
        radius: MIN_FOOD_RADIUS + Math.random() * (MAX_FOOD_RADIUS - MIN_FOOD_RADIUS),
        color: FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)],
        vx: 0,
        vy: 0
      });
    }
  };

  const spawnBots = (count: number) => {
    for (let i = 0; i < count; i++) {
      const startRadius = INITIAL_PLAYER_RADIUS * (0.8 + Math.random() * 0.8);
      // FIX: Use unique ID to prevent React rendering issues when bots respawn
      const uniqueId = `bot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      botsRef.current.push({
        id: uniqueId,
        x: Math.random() * WORLD_WIDTH,
        y: Math.random() * WORLD_HEIGHT,
        radius: startRadius,
        color: FOOD_COLORS[i % FOOD_COLORS.length],
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        isBot: true,
        name: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]
      });
    }
  };

  const spawnParticles = (x: number, y: number, color: string, count = 6) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color: color
      });
    }
  };

  const ejectSpore = (handScreenX: number, handScreenY: number) => {
    let ejected = false;

    // Convert hand screen coordinates to world coordinates
    const handWorldX = handScreenX + cameraRef.current.x;
    const handWorldY = handScreenY + cameraRef.current.y;

    // Iterate backwards to allow modifying array if needed (though we just modify radius)
    playerRef.current.forEach(blob => {
      if (blob.radius < MIN_EJECT_RADIUS) return;

      // Direction: from blob towards hand position
      const dx = handWorldX - blob.x;
      const dy = handWorldY - blob.y;
      const angle = Math.atan2(dy, dx);

      const newAreaSq = blob.radius * blob.radius - SPORE_RADIUS * SPORE_RADIUS;
      blob.radius = Math.sqrt(newAreaSq);

      const startDist = blob.radius + SPORE_RADIUS + 5;
      const spore: BlobEntity = {
        id: `spore-${Date.now()}-${Math.random()}`,
        x: blob.x + Math.cos(angle) * startDist,
        y: blob.y + Math.sin(angle) * startDist,
        vx: Math.cos(angle) * SPORE_SPEED,
        vy: Math.sin(angle) * SPORE_SPEED,
        radius: SPORE_RADIUS,
        color: blob.color
      };
      foodsRef.current.push(spore);
      ejected = true;
    });

    if (ejected) playShootSound();
  };

  const splitPlayer = (handScreenX: number, handScreenY: number) => {
    const currentBlobs = playerRef.current;
    if (currentBlobs.length >= MAX_PLAYER_BLOBS) return;

    // Convert hand screen coordinates to world coordinates
    const handWorldX = handScreenX + cameraRef.current.x;
    const handWorldY = handScreenY + cameraRef.current.y;

    const newBlobs: BlobEntity[] = [];
    let didSplit = false;

    currentBlobs.forEach(blob => {
      if (blob.radius >= MIN_SPLIT_RADIUS && (playerRef.current.length + newBlobs.length) < MAX_PLAYER_BLOBS) {
        // Calculate angle from this blob towards the hand position
        const dx = handWorldX - blob.x;
        const dy = handWorldY - blob.y;
        const angle = Math.atan2(dy, dx);

        // Halve Area: New Radius = Old Radius / sqrt(2)
        const newRadius = blob.radius / Math.SQRT2;
        blob.radius = newRadius;

        const splitBlob: BlobEntity = {
          ...blob,
          id: `player-${Date.now()}-${Math.random()}`,
          radius: newRadius,
          // Add Impulse towards hand position
          vx: blob.vx + Math.cos(angle) * SPLIT_FORCE,
          vy: blob.vy + Math.sin(angle) * SPLIT_FORCE,
          mergeTimestamp: Date.now() + MERGE_COOLDOWN_MS
        };

        // Shift position slightly forward so they don't start inside each other
        splitBlob.x += Math.cos(angle) * (newRadius * 2);
        splitBlob.y += Math.sin(angle) * (newRadius * 2);

        newBlobs.push(splitBlob);
        didSplit = true;
      }
    });

    if (didSplit) {
      playerRef.current = [...currentBlobs, ...newBlobs];
      playSplitSound();
    }
  };

  const resetGame = () => {
    const cx = WORLD_WIDTH / 2;
    const cy = WORLD_HEIGHT / 2;
    playerRef.current = [{
      id: 'player-0',
      x: cx,
      y: cy,
      radius: INITIAL_PLAYER_RADIUS,
      color: COLOR_PLAYER_CORE,
      vx: 0,
      vy: 0,
      name: 'You'
    }];
    scoreRef.current = INITIAL_PLAYER_RADIUS;
    onScoreUpdate(INITIAL_PLAYER_RADIUS);
    particlesRef.current = [];
    foodsRef.current = [];
    botsRef.current = [];
    spawnFood(FOOD_COUNT);
    spawnBots(BOT_COUNT);
    if (canvasRef.current) {
      cameraRef.current = {
        x: cx - canvasRef.current.width / 2,
        y: cy - canvasRef.current.height / 2,
        scale: 1
      };
    }
  };

  const worldToScreen = (wx: number, wy: number): Point => {
    return {
      x: wx - cameraRef.current.x,
      y: wy - cameraRef.current.y
    };
  };

  const getCentroid = (blobs: BlobEntity[]): Point => {
    if (blobs.length === 0) return { x: 0, y: 0 };
    let tx = 0, ty = 0, mass = 0;
    blobs.forEach(b => {
      tx += b.x * b.radius;
      ty += b.y * b.radius;
      mass += b.radius;
    });
    return { x: tx / mass, y: ty / mass };
  };

  // --- Helper: Gesture Detection ---
  const isFingerExtended = (landmarks: NormalizedLandmark[], tipIdx: number, pipIdx: number, wristIdx: number) => {
    const wrist = landmarks[wristIdx];
    const pip = landmarks[pipIdx];
    const tip = landmarks[tipIdx];
    const dWristPip = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
    const dWristTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
    return dWristTip > dWristPip * 1.1;
  };

  // --- AI Logic ---
  const updateBots = () => {
    const playerCentroid = getCentroid(playerRef.current);
    const playerTotalMass = playerRef.current.reduce((sum, b) => sum + b.radius, 0);

    botsRef.current.forEach(bot => {
      // 1. Find Targets (Food or smaller entities)
      let targetX = bot.x;
      let targetY = bot.y;
      let minDist = BOT_VIEW_DISTANCE;
      let bestTarget: BlobEntity | null = null;
      let dangerVector = { x: 0, y: 0 };

      // Scan Food
      foodsRef.current.forEach(food => {
        const d = Math.hypot(food.x - bot.x, food.y - bot.y);
        if (d < minDist) {
          minDist = d;
          bestTarget = food;
        }
      });

      // Scan Player (Simple check against centroid)
      const dPlayer = Math.hypot(playerCentroid.x - bot.x, playerCentroid.y - bot.y);
      if (dPlayer < BOT_VIEW_DISTANCE) {
        // Flee from player if player is bigger
        // We compare total mass approx or largest blob
        const maxPlayerBlob = Math.max(...playerRef.current.map(b => b.radius));
        if (maxPlayerBlob > bot.radius * 1.1) {
          dangerVector.x += (bot.x - playerCentroid.x) / dPlayer * 200;
          dangerVector.y += (bot.y - playerCentroid.y) / dPlayer * 200;
        } else if (maxPlayerBlob < bot.radius * 0.9) {
          if (dPlayer < minDist) {
            minDist = dPlayer;
            bestTarget = { x: playerCentroid.x, y: playerCentroid.y, radius: maxPlayerBlob } as BlobEntity;
          }
        }
      }

      // Apply Forces
      let angle = 0;
      if (dangerVector.x !== 0 || dangerVector.y !== 0) {
        angle = Math.atan2(dangerVector.y, dangerVector.x);
      } else if (bestTarget) {
        angle = Math.atan2(bestTarget.y - bot.y, bestTarget.x - bot.x);
      } else {
        // Wander
        angle = Math.atan2(bot.vy, bot.vx) + (Math.random() - 0.5) * 0.5;
      }

      const speedFactor = BASE_SPEED * (25 / Math.max(25, bot.radius)) ** 0.5 * 0.8;
      const tx = Math.cos(angle) * speedFactor;
      const ty = Math.sin(angle) * speedFactor;
      bot.vx += (tx - bot.vx) * 0.05;
      bot.vy += (ty - bot.vy) * 0.05;
      bot.x += bot.vx;
      bot.y += bot.vy;
      bot.x = Math.max(bot.radius, Math.min(WORLD_WIDTH - bot.radius, bot.x));
      bot.y = Math.max(bot.radius, Math.min(WORLD_HEIGHT - bot.radius, bot.y));
    });
  };

  // --- Leaderboard ---
  const updateLeaderboard = () => {
    // Calculate Player Mass
    let playerMass = 0;
    playerRef.current.forEach(b => playerMass += b.radius);

    // Create list
    const entries: LeaderboardEntry[] = [
      { id: 'player', name: 'You', mass: Math.floor(playerMass), isPlayer: true }
    ];

    botsRef.current.forEach(bot => {
      entries.push({ id: bot.id, name: bot.name || 'Bot', mass: Math.floor(bot.radius), isPlayer: false });
    });

    // Sort
    entries.sort((a, b) => b.mass - a.mass);

    // Update UI with FULL list, let UI handle slicing and rank calculation
    onLeaderboardUpdate(entries);
  };

  // --- Main Loop ---
  const animate = () => {
    if (gameStatus === GameStatus.PLAYING) {
      requestRef.current = requestAnimationFrame(animate);
    }
    if (!canvasRef.current || !videoRef.current || !handLandmarkerRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cw = canvas.width;
    const ch = canvas.height;

    timeRef.current += 1;

    // Update Leaderboard every 15 frames
    if (timeRef.current % 15 === 0) updateLeaderboard();

    // --- 1. INPUT ---
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

        // Detect Gestures
        const indexExt = isFingerExtended(landmarks, 8, 6, 0);
        const midExt = isFingerExtended(landmarks, 12, 10, 0);
        const ringExt = isFingerExtended(landmarks, 16, 14, 0);
        const pinkyExt = isFingerExtended(landmarks, 20, 18, 0);

        if (indexExt && midExt && !ringExt && !pinkyExt) {
          // Victory / Scissors -> SPLIT
          gestureType = 'SPLIT';
        } else if (midExt && ringExt && pinkyExt) {
          // Open Hand -> EJECT
          gestureType = 'EJECT';
        }

        // Vector Calculation
        const cx = cw / 2;
        const cy = ch / 2;
        const dx = lastFingerPosRef.current.x - cx;
        const dy = lastFingerPosRef.current.y - cy;
        const dist = Math.hypot(dx, dy);
        throttle = Math.min(dist / INPUT_MAX_SPEED_DISTANCE, 1.0);
        targetAngle = Math.atan2(dy, dx);
      }
    } catch (e) { }

    // Debounce & Trigger Actions
    const now = Date.now();
    if (gestureType !== 'NONE') {
      if (gestureHoldStartRef.current === 0) {
        gestureHoldStartRef.current = now;
      } else if (now - gestureHoldStartRef.current > GESTURE_HOLD_THRESHOLD_MS) {
        if (gestureType === 'EJECT' && now - lastEjectTimeRef.current > EJECT_COOLDOWN_MS) {
          ejectSpore(lastFingerPosRef.current.x, lastFingerPosRef.current.y);
          lastEjectTimeRef.current = now;
        } else if (gestureType === 'SPLIT' && now - lastSplitTimeRef.current > 500) {
          // Split Action - pass hand screen position
          splitPlayer(lastFingerPosRef.current.x, lastFingerPosRef.current.y);
          lastSplitTimeRef.current = now;
        }
      }
    } else {
      gestureHoldStartRef.current = 0;
    }

    // --- 2. PHYSICS ---

    // Player Movement (Multi-blob)
    playerRef.current.forEach(blob => {
      // Target velocity
      const speedFactor = BASE_SPEED * (25 / Math.max(25, blob.radius)) ** 0.5;
      const tvx = Math.cos(targetAngle) * speedFactor * throttle;
      const tvy = Math.sin(targetAngle) * speedFactor * throttle;

      blob.vx += (tvx - blob.vx) * PLAYER_TURN_SPEED;
      blob.vy += (tvy - blob.vy) * PLAYER_TURN_SPEED;
      blob.x += blob.vx;
      blob.y += blob.vy;

      // Wall Boundaries
      if (blob.x < blob.radius) { blob.x = blob.radius; blob.vx *= -0.5; }
      if (blob.x > WORLD_WIDTH - blob.radius) { blob.x = WORLD_WIDTH - blob.radius; blob.vx *= -0.5; }
      if (blob.y < blob.radius) { blob.y = blob.radius; blob.vy *= -0.5; }
      if (blob.y > WORLD_HEIGHT - blob.radius) { blob.y = WORLD_HEIGHT - blob.radius; blob.vy *= -0.5; }
    });

    // Resolve Self-Collision & Merging
    for (let i = 0; i < playerRef.current.length; i++) {
      for (let j = i + 1; j < playerRef.current.length; j++) {
        const b1 = playerRef.current[i];
        const b2 = playerRef.current[j];
        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const dist = Math.hypot(dx, dy);
        const radSum = b1.radius + b2.radius;

        if (dist < radSum) {
          // Check Re-merge capabilities
          // Merging happens if cooldown expired AND they are overlapping significantly
          const canMerge = (!b1.mergeTimestamp || b1.mergeTimestamp < now) &&
            (!b2.mergeTimestamp || b2.mergeTimestamp < now);

          // Merge Logic (Slow Squeeze)
          if (canMerge) {
            // 1. Attraction Force (Pull together based on mass)
            // Heavier blob moves less, lighter moves more to preserve centroid roughly
            const invMass1 = 1 / b1.radius;
            const invMass2 = 1 / b2.radius;
            const totalInvMass = invMass1 + invMass2;

            // How much to move? Proportional to distance, scaled by ATTRACTION
            const moveX = dx * MERGE_ATTRACTION;
            const moveY = dy * MERGE_ATTRACTION;

            // Weighted movement
            b1.x += moveX * (invMass1 / totalInvMass);
            b1.y += moveY * (invMass1 / totalInvMass);
            b2.x -= moveX * (invMass2 / totalInvMass);
            b2.y -= moveY * (invMass2 / totalInvMass);

            // 2. Final Merge Trigger
            // Only actually merge if they are very close (concentric)
            if (dist < radSum * MERGE_OVERLAP_RATIO) {
              // Conserve Mass (Area)
              const newArea = b1.radius * b1.radius + b2.radius * b2.radius;
              const newRadius = Math.sqrt(newArea);

              // Blend Velocity
              const r1Sq = b1.radius * b1.radius;
              const r2Sq = b2.radius * b2.radius;
              const totalArea = r1Sq + r2Sq;

              b1.vx = (b1.vx * r1Sq + b2.vx * r2Sq) / totalArea;
              b1.vy = (b1.vy * r1Sq + b2.vy * r2Sq) / totalArea;
              b1.radius = newRadius;

              // Position is naturally blended by the squeeze, but let's snap to weighted center
              b1.x = (b1.x * r1Sq + b2.x * r2Sq) / totalArea;
              b1.y = (b1.y * r1Sq + b2.y * r2Sq) / totalArea;

              // Remove b2
              playerRef.current.splice(j, 1);
              j--;
              playEatSound(newRadius);
            }

            // Skip Repulsion Force if merging
            continue;
          }

          // If not merging, push apart (Cell membrane tension)
          if (dist > 0) {
            const overlap = radSum - dist;
            // Stronger push if closer, but capped to avoid explosion
            const push = Math.min(overlap, 4.0) * SELF_COLLISION_PUSH;
            const nx = dx / dist;
            const ny = dy / dist;

            b1.x -= nx * push;
            b1.y -= ny * push;
            b2.x += nx * push;
            b2.y += ny * push;
          }
        }
      }
    }

    updateBots();

    // Food Physics
    for (let food of foodsRef.current) {
      if (Math.abs(food.vx) > 0.1 || Math.abs(food.vy) > 0.1) {
        food.x += food.vx;
        food.y += food.vy;
        food.vx *= FOOD_FRICTION;
        food.vy *= FOOD_FRICTION;
        if (food.x < 0 || food.x > WORLD_WIDTH) food.vx *= -1;
        if (food.y < 0 || food.y > WORLD_HEIGHT) food.vy *= -1;
      }
    }

    // Camera Follow Centroid
    const center = getCentroid(playerRef.current);
    if (playerRef.current.length === 0) {
      // If dead, keep camera roughly where we died
    } else {
      const targetCamX = center.x - cw / 2;
      const targetCamY = center.y - ch / 2;
      cameraRef.current.x += (targetCamX - cameraRef.current.x) * 0.1;
      cameraRef.current.y += (targetCamY - cameraRef.current.y) * 0.1;
    }

    // --- 3. COLLISION ---

    // 3.1 Player vs Food (Check all blobs)
    playerRef.current.forEach(blob => {
      for (let i = foodsRef.current.length - 1; i >= 0; i--) {
        const food = foodsRef.current[i];
        if (checkCollision(blob, food)) {
          const newAreaRadius = Math.sqrt(blob.radius * blob.radius + (food.radius * food.radius) * GROWTH_FACTOR);
          blob.radius = newAreaRadius;
          // Score is total mass now
          let totalScore = 0;
          playerRef.current.forEach(b => totalScore += b.radius);
          scoreRef.current = totalScore;
          onScoreUpdate(scoreRef.current);

          playEatSound(blob.radius);
          spawnParticles(food.x, food.y, food.color);
          foodsRef.current.splice(i, 1);
        }
      }
    });

    // 3.2 Bots vs Food
    botsRef.current.forEach(bot => {
      for (let i = foodsRef.current.length - 1; i >= 0; i--) {
        const food = foodsRef.current[i];
        if (checkCollision(bot, food)) {
          bot.radius = Math.sqrt(bot.radius * bot.radius + (food.radius * food.radius) * GROWTH_FACTOR);
          foodsRef.current.splice(i, 1);
        }
      }
    });

    // 3.3 Player vs Bots
    for (let i = botsRef.current.length - 1; i >= 0; i--) {
      const bot = botsRef.current[i];

      let botEaten = false;
      // Player Eats Bot
      for (let b = 0; b < playerRef.current.length; b++) {
        const pBlob = playerRef.current[b];
        if (pBlob.radius > bot.radius * 1.1 && checkCollision(pBlob, bot)) {
          pBlob.radius = Math.sqrt(pBlob.radius * pBlob.radius + (bot.radius * bot.radius));

          // Update Score
          let totalScore = 0;
          playerRef.current.forEach(cell => totalScore += cell.radius);
          scoreRef.current = totalScore;
          onScoreUpdate(scoreRef.current);

          playPopSound();
          spawnParticles(bot.x, bot.y, bot.color, 12);
          botsRef.current.splice(i, 1);
          spawnBots(1);
          botEaten = true;
          break;
        }
      }
      if (botEaten) continue;

      // Bot Eats Player (Check all player blobs)
      for (let b = playerRef.current.length - 1; b >= 0; b--) {
        const pBlob = playerRef.current[b];
        if (bot.radius > pBlob.radius * 1.1 && checkCollision(bot, pBlob)) {
          // Bot eats this specific player blob
          bot.radius = Math.sqrt(bot.radius * bot.radius + pBlob.radius * pBlob.radius);
          playerRef.current.splice(b, 1);
          playPopSound();
        }
      }
    }

    // Check Game Over
    if (playerRef.current.length === 0 && gameStatus === GameStatus.PLAYING) {
      onStatusChange(GameStatus.GAME_OVER);
    }

    // 3.4 Bot vs Bot
    for (let i = 0; i < botsRef.current.length; i++) {
      for (let j = i + 1; j < botsRef.current.length; j++) {
        const b1 = botsRef.current[i];
        const b2 = botsRef.current[j];
        if (!b1 || !b2) continue;

        if (b1.radius > b2.radius * 1.1 && checkCollision(b1, b2)) {
          b1.radius = Math.sqrt(b1.radius * b1.radius + b2.radius * b2.radius);
          botsRef.current.splice(j, 1);
          spawnBots(1);
          j--;
        } else if (b2.radius > b1.radius * 1.1 && checkCollision(b2, b1)) {
          b2.radius = Math.sqrt(b2.radius * b2.radius + b1.radius * b1.radius);
          botsRef.current.splice(i, 1);
          spawnBots(1);
          i--;
          break;
        }
      }
    }

    if (foodsRef.current.length < FOOD_COUNT) {
      spawnFood(FOOD_COUNT - foodsRef.current.length);
    }

    // --- 4. RENDER ---
    ctx.save();
    ctx.translate(cw, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, 0, 0, cw, ch);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, cw, ch);
    ctx.restore();

    // Grid
    ctx.beginPath();
    ctx.strokeStyle = COLOR_GRID;
    ctx.lineWidth = 1;
    const startGridX = Math.floor(cameraRef.current.x / GRID_SIZE) * GRID_SIZE;
    const startGridY = Math.floor(cameraRef.current.y / GRID_SIZE) * GRID_SIZE;
    for (let gx = startGridX; gx < cameraRef.current.x + cw + GRID_SIZE; gx += GRID_SIZE) {
      const sx = gx - cameraRef.current.x;
      ctx.moveTo(sx, 0); ctx.lineTo(sx, ch);
    }
    for (let gy = startGridY; gy < cameraRef.current.y + ch + GRID_SIZE; gy += GRID_SIZE) {
      const sy = gy - cameraRef.current.y;
      ctx.moveTo(0, sy); ctx.lineTo(cw, sy);
    }
    ctx.stroke();

    // Border
    const tl = worldToScreen(0, 0);
    const br = worldToScreen(WORLD_WIDTH, WORLD_HEIGHT);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 5;
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

    // Food
    foodsRef.current.forEach(food => {
      const sp = worldToScreen(food.x, food.y);
      if (sp.x > -50 && sp.x < cw + 50 && sp.y > -50 && sp.y < ch + 50) {
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, food.radius, 0, Math.PI * 2);
        ctx.fillStyle = food.color;
        ctx.fill();
      }
    });

    // Particles
    particlesRef.current.forEach((p, idx) => {
      p.x += p.vx; p.y += p.vy; p.life -= 0.05;
      const sp = worldToScreen(p.x, p.y);
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1.0;
      if (p.life <= 0) particlesRef.current.splice(idx, 1);
    });

    // Bots
    botsRef.current.forEach(bot => {
      drawBlob(ctx, bot, false);
    });

    // Player (Draw all blobs)
    playerRef.current.forEach(blob => {
      drawBlob(ctx, blob, true);
    });

    // Control Line & Hand Visuals
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

      // Palm Cursor Visualization
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

  const drawBlob = (ctx: CanvasRenderingContext2D, blob: BlobEntity, isPlayer: boolean) => {
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

    // Border
    ctx.lineWidth = 3;
    ctx.strokeStyle = isPlayer ? COLOR_PLAYER_BORDER : 'rgba(0,0,0,0.3)';
    ctx.stroke();

    // Shine
    if (blob.radius > 8) {
      ctx.beginPath();
      ctx.arc(spCenter.x - blob.radius * 0.3, spCenter.y - blob.radius * 0.3, blob.radius * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fill();
    }

    // Name
    if (blob.radius > 15) {
      ctx.fillStyle = 'white';
      ctx.font = `bold ${Math.max(10, blob.radius * 0.4)}px "Inter"`;
      ctx.textAlign = 'center';

      const currentT = translations[langRef.current];
      let displayName = blob.name || '';
      // Translate Player Name if it matches standard 'You'
      if (isPlayer) {
        displayName = currentT.you;
      }

      ctx.fillText(displayName, spCenter.x, spCenter.y + 4);
    }
  };

  const checkCollision = (a: BlobEntity, b: BlobEntity) => {
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    return dist < a.radius - b.radius * 0.2;
  };

  useEffect(() => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    if (gameStatus === GameStatus.PLAYING) {
      startBGM();
      resetGame();
      requestRef.current = requestAnimationFrame(animate);
    } else {
      stopBGM();
      if (gameStatus === GameStatus.IDLE || gameStatus === GameStatus.GAME_OVER) {
        requestRef.current = requestAnimationFrame(animatePreview);
      }
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameStatus]);

  const animatePreview = () => {
    if (gameStatus === GameStatus.IDLE || gameStatus === GameStatus.GAME_OVER) {
      requestRef.current = requestAnimationFrame(animatePreview);
    }
    if (!canvasRef.current || !videoRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    if (videoRef.current.readyState < 2) return;

    // Use lang ref for text in loop
    const currentT = translations[langRef.current];

    ctx.save();
    ctx.translate(canvasRef.current.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.restore();

    if (gameStatus === GameStatus.GAME_OVER) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 64px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(currentT.gameOver, canvasRef.current.width / 2, canvasRef.current.height / 2);
      ctx.fillStyle = '#ffffff';
      ctx.font = '24px "Inter", sans-serif';
      ctx.fillText(`${currentT.finalSize}: ${Math.floor(scoreRef.current)}`, canvasRef.current.width / 2, canvasRef.current.height / 2 + 50);
    }
  };

  // Get current translation for Overlay
  const t = translations[lang];

  return (
    <div className="relative w-full h-full bg-black rounded-3xl overflow-hidden border border-slate-700 shadow-2xl">
      <video ref={videoRef} className="hidden" autoPlay playsInline muted />
      <canvas ref={canvasRef} width={1280} height={720} className="w-full h-full object-cover" />

      {errorMsg && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 p-8 z-50">
          <div className="max-w-md text-center">
            <div className="text-rose-500 text-5xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold text-white mb-2">{t.error}</h3>
            <p className="text-rose-300 mb-6">{errorMsg}</p>
            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-full text-white">{t.reload}</button>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {!errorMsg && gameStatus === GameStatus.LOADING_MODEL && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-40">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-cyan-400 font-mono animate-pulse">{t.initializing}</p>
        </div>
      )}

      {/* Score HUD */}
      {gameStatus === GameStatus.PLAYING && (
        <div className="absolute top-4 left-4 flex gap-4 pointer-events-none">
          <div className="bg-black/50 backdrop-blur px-4 py-2 rounded-lg border border-white/10">
            <span className="text-xs text-slate-400 uppercase block">{t.massHUD}</span>
            <span className="text-xl font-bold text-cyan-400">{Math.floor(scoreRef.current)}</span>
          </div>
        </div>
      )}
    </div>
  );
};