
import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { GameStatus, Point, Particle, BlobEntity, Camera } from '../types';
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
  PLAYER_TURN_SPEED
} from '../constants';

interface GameCanvasProps {
  onScoreUpdate: (score: number) => void;
  onStatusChange: (status: GameStatus) => void;
  gameStatus: GameStatus;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ 
  onScoreUpdate, 
  onStatusChange, 
  gameStatus 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Logic Refs
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>(0);
  
  // Game State Refs
  const playerRef = useRef<BlobEntity>({ 
    id: 'player', 
    x: 0, 
    y: 0, 
    radius: INITIAL_PLAYER_RADIUS, 
    color: COLOR_PLAYER_CORE,
    vx: 0,
    vy: 0,
    name: 'You'
  });
  
  const foodsRef = useRef<BlobEntity[]>([]);
  const botsRef = useRef<BlobEntity[]>([]);
  const cameraRef = useRef<Camera>({ x: 0, y: 0, scale: 1 });
  const lastFingerPosRef = useRef<Point>({ x: 0, y: 0 }); // Screen coordinates
  const particlesRef = useRef<Particle[]>([]);
  const scoreRef = useRef<number>(0);
  const timeRef = useRef<number>(0); // For wobble animation
  const lastEjectTimeRef = useRef<number>(0);
  const gestureHoldStartRef = useRef<number>(0);
  
  // Audio Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bgmOscRef = useRef<OscillatorNode | null>(null);
  const bgmGainRef = useRef<GainNode | null>(null);
  
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
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    stopBGM();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(60, ctx.currentTime); 
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.2;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 5;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 2);
    osc.start();
    bgmOscRef.current = osc;
    bgmGainRef.current = gain;
  };

  const stopBGM = () => {
    if (bgmOscRef.current && bgmGainRef.current && audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        bgmGainRef.current.gain.cancelScheduledValues(ctx.currentTime);
        bgmGainRef.current.gain.setValueAtTime(bgmGainRef.current.gain.value, ctx.currentTime);
        bgmGainRef.current.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
        bgmOscRef.current.stop(ctx.currentTime + 0.5);
        bgmOscRef.current = null;
    }
  };

  // --- Initialization ---
  useEffect(() => {
    if (handLandmarkerRef.current || initInProgress.current) return;
    const initMediaPipe = async () => {
      initInProgress.current = true;
      try {
        onStatusChange(GameStatus.LOADING_MODEL);
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
       botsRef.current.push({
           id: `bot-${i}`,
           x: Math.random() * WORLD_WIDTH,
           y: Math.random() * WORLD_HEIGHT,
           radius: startRadius,
           color: FOOD_COLORS[i % FOOD_COLORS.length],
           vx: (Math.random() - 0.5) * 2,
           vy: (Math.random() - 0.5) * 2,
           isBot: true,
           name: BOT_NAMES[i % BOT_NAMES.length]
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

  const ejectSpore = (source: BlobEntity) => {
    if (source.radius < MIN_EJECT_RADIUS) return;
    
    // Calculate direction (towards movement or forward)
    let angle = 0;
    const speed = Math.hypot(source.vx, source.vy);
    if (speed > 0.5) {
        angle = Math.atan2(source.vy, source.vx);
    } else {
        // Random if still
        angle = Math.random() * Math.PI * 2; 
    }

    // Conservation of Area
    const newAreaSq = source.radius * source.radius - SPORE_RADIUS * SPORE_RADIUS;
    source.radius = Math.sqrt(newAreaSq);
    
    if (source.id === 'player') {
        scoreRef.current = source.radius;
        onScoreUpdate(source.radius);
    }

    // Create Spore
    const startDist = source.radius + SPORE_RADIUS + 5;
    const spore: BlobEntity = {
        id: `spore-${Date.now()}-${Math.random()}`,
        x: source.x + Math.cos(angle) * startDist,
        y: source.y + Math.sin(angle) * startDist,
        vx: Math.cos(angle) * SPORE_SPEED,
        vy: Math.sin(angle) * SPORE_SPEED,
        radius: SPORE_RADIUS,
        color: source.color
    };
    
    foodsRef.current.push(spore);
    if (source.id === 'player') playShootSound();
  };

  const resetGame = () => {
    const cx = WORLD_WIDTH / 2;
    const cy = WORLD_HEIGHT / 2;
    playerRef.current = {
        id: 'player',
        x: cx,
        y: cy,
        radius: INITIAL_PLAYER_RADIUS,
        color: COLOR_PLAYER_CORE,
        vx: 0,
        vy: 0,
        name: 'You'
    };
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

  // --- Helper: Gesture Detection ---
  const isFingerExtended = (landmarks: NormalizedLandmark[], tipIdx: number, pipIdx: number, wristIdx: number) => {
    const wrist = landmarks[wristIdx];
    const pip = landmarks[pipIdx];
    const tip = landmarks[tipIdx];
    
    const dWristPip = Math.hypot(pip.x - wrist.x, pip.y - wrist.y);
    const dWristTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
    
    // Tip must be significantly further from wrist than PIP
    return dWristTip > dWristPip * 1.2;
  };

  // --- AI Logic ---
  const updateBots = () => {
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

        // Scan Player (Prey or Predator)
        const dPlayer = Math.hypot(playerRef.current.x - bot.x, playerRef.current.y - bot.y);
        if (dPlayer < BOT_VIEW_DISTANCE) {
            if (playerRef.current.radius > bot.radius * 1.1) {
                // Flee
                dangerVector.x += (bot.x - playerRef.current.x) / dPlayer * 200;
                dangerVector.y += (bot.y - playerRef.current.y) / dPlayer * 200;
            } else if (playerRef.current.radius < bot.radius * 0.9) {
                // Chase
                if (dPlayer < minDist) {
                    minDist = dPlayer;
                    bestTarget = playerRef.current;
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

        // Speed calculation
        const speedFactor = BASE_SPEED * (25 / Math.max(25, bot.radius)) ** 0.5 * 0.8; // Bots slightly slower
        const tx = Math.cos(angle) * speedFactor;
        const ty = Math.sin(angle) * speedFactor;

        bot.vx += (tx - bot.vx) * 0.05;
        bot.vy += (ty - bot.vy) * 0.05;

        // Move
        bot.x += bot.vx;
        bot.y += bot.vy;

        // Boundaries
        bot.x = Math.max(bot.radius, Math.min(WORLD_WIDTH - bot.radius, bot.x));
        bot.y = Math.max(bot.radius, Math.min(WORLD_HEIGHT - bot.radius, bot.y));
    });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStatus]);

  // --- Render Loops ---
  const animatePreview = () => {
    if (gameStatus === GameStatus.IDLE || gameStatus === GameStatus.GAME_OVER) {
        requestRef.current = requestAnimationFrame(animatePreview);
    }
    if (!canvasRef.current || !videoRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    if (videoRef.current.readyState < 2) return;

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
        ctx.fillText("GAME OVER", canvasRef.current.width / 2, canvasRef.current.height / 2);
        ctx.fillStyle = '#ffffff';
        ctx.font = '24px "Inter", sans-serif';
        ctx.fillText(`Final Size: ${Math.floor(scoreRef.current)}`, canvasRef.current.width / 2, canvasRef.current.height / 2 + 50);
    }
  };

  const drawBlob = (ctx: CanvasRenderingContext2D, blob: BlobEntity, isPlayer: boolean) => {
    ctx.beginPath();
    const segments = 20;
    const time = timeRef.current;
    
    // Organic wobble for players and bots
    if (blob.radius > 10) {
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            const distortion = Math.sin(theta * 6 + time * 0.1 + (blob.x * 0.01)) * (blob.radius * 0.03);
            const r = blob.radius + distortion;
            const px = blob.x + Math.cos(theta) * r;
            const py = blob.y + Math.sin(theta) * r;
            // Convert to screen coords here for drawing
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
    if (blob.name && blob.radius > 15) {
        ctx.fillStyle = 'white';
        ctx.font = `bold ${Math.max(10, blob.radius * 0.4)}px "Inter"`;
        ctx.textAlign = 'center';
        ctx.fillText(blob.name, spCenter.x, spCenter.y + 4);
    }
  };

  const checkCollision = (a: BlobEntity, b: BlobEntity) => {
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      return dist < a.radius - b.radius * 0.2; // Eat if significantly overlapping
  };

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

    // --- 1. INPUT ---
    const startTimeMs = performance.now();
    let targetVx = 0;
    let targetVy = 0;
    let hasHand = false;
    let isSpreadingHand = false;

    try {
        const results = handLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
        if (results.landmarks && results.landmarks.length > 0) {
            hasHand = true;
            const landmarks = results.landmarks[0];
            
            // TRACKING: Use Palm Center (Landmark 9 - Middle Finger MCP)
            // This is much more stable than Index Tip (8) for movement control
            const palmCenter = landmarks[9]; 
            
            const rawX = (1 - palmCenter.x) * cw;
            const rawY = palmCenter.y * ch;
            lastFingerPosRef.current = {
                x: lastFingerPosRef.current.x + (rawX - lastFingerPosRef.current.x) * MOVEMENT_SMOOTHING,
                y: lastFingerPosRef.current.y + (rawY - lastFingerPosRef.current.y) * MOVEMENT_SMOOTHING
            };

            // Gesture: Detect Spread Hand for Ejecting
            // Middle+Ring+Pinky must be extended for Eject
            const midExt = isFingerExtended(landmarks, 12, 10, 0); // Middle
            const ringExt = isFingerExtended(landmarks, 16, 14, 0); // Ring
            const pinkyExt = isFingerExtended(landmarks, 20, 18, 0); // Pinky

            // Logic: If Middle, Ring AND Pinky are open, it is "Open Hand".
            if (midExt && ringExt && pinkyExt) {
                // Debounce
                if (gestureHoldStartRef.current === 0) {
                    gestureHoldStartRef.current = Date.now();
                } else if (Date.now() - gestureHoldStartRef.current > GESTURE_HOLD_THRESHOLD_MS) {
                    isSpreadingHand = true;
                }
            } else {
                gestureHoldStartRef.current = 0;
            }

            // Calculate Vector from Center to Hand
            const cx = cw / 2;
            const cy = ch / 2;
            const dx = lastFingerPosRef.current.x - cx;
            const dy = lastFingerPosRef.current.y - cy;
            const dist = Math.hypot(dx, dy);
            
            // Throttle control
            const throttle = Math.min(dist / INPUT_MAX_SPEED_DISTANCE, 1.0);
            const angle = Math.atan2(dy, dx);
            const speedFactor = BASE_SPEED * (25 / Math.max(25, playerRef.current.radius)) ** 0.5;
            targetVx = Math.cos(angle) * speedFactor * throttle;
            targetVy = Math.sin(angle) * speedFactor * throttle;
        } else {
            gestureHoldStartRef.current = 0;
        }
    } catch(e) {}

    // Handle Ejection
    const now = Date.now();
    if (isSpreadingHand && now - lastEjectTimeRef.current > EJECT_COOLDOWN_MS) {
        ejectSpore(playerRef.current);
        lastEjectTimeRef.current = now;
    }

    // --- 2. PHYSICS ---
    const player = playerRef.current;
    
    // Player Movement (Inertia)
    player.vx += (targetVx - player.vx) * PLAYER_TURN_SPEED; // Use higher turn speed
    player.vy += (targetVy - player.vy) * PLAYER_TURN_SPEED;
    player.x += player.vx;
    player.y += player.vy;
    player.x = Math.max(player.radius, Math.min(WORLD_WIDTH - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(WORLD_HEIGHT - player.radius, player.y));

    // Bot Movement
    updateBots();

    // Food/Spore Physics (Friction)
    for (let food of foodsRef.current) {
        if (Math.abs(food.vx) > 0.1 || Math.abs(food.vy) > 0.1) {
            food.x += food.vx;
            food.y += food.vy;
            food.vx *= FOOD_FRICTION;
            food.vy *= FOOD_FRICTION;
            
            // Bounce off walls
            if (food.x < 0 || food.x > WORLD_WIDTH) food.vx *= -1;
            if (food.y < 0 || food.y > WORLD_HEIGHT) food.vy *= -1;
        }
    }

    // Camera Follow
    const targetCamX = player.x - cw / 2;
    const targetCamY = player.y - ch / 2;
    cameraRef.current.x += (targetCamX - cameraRef.current.x) * 0.1;
    cameraRef.current.y += (targetCamY - cameraRef.current.y) * 0.1;

    // --- 3. COLLISION ---
    
    // 3.1 Player vs Food
    for (let i = foodsRef.current.length - 1; i >= 0; i--) {
        const food = foodsRef.current[i];
        if (checkCollision(player, food)) {
             const newAreaRadius = Math.sqrt(player.radius * player.radius + (food.radius * food.radius) * GROWTH_FACTOR);
             player.radius = newAreaRadius;
             scoreRef.current += Math.floor(food.radius);
             onScoreUpdate(scoreRef.current);
             playEatSound(player.radius);
             spawnParticles(food.x, food.y, food.color);
             foodsRef.current.splice(i, 1);
        }
    }

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
        
        // Player Eats Bot
        if (player.radius > bot.radius * 1.1 && checkCollision(player, bot)) {
            player.radius = Math.sqrt(player.radius * player.radius + (bot.radius * bot.radius));
            scoreRef.current += Math.floor(bot.radius * 2);
            onScoreUpdate(scoreRef.current);
            playPopSound();
            spawnParticles(bot.x, bot.y, bot.color, 12);
            botsRef.current.splice(i, 1);
            spawnBots(1); // Respawn new bot somewhere else
            continue;
        }

        // Bot Eats Player
        if (bot.radius > player.radius * 1.1 && checkCollision(bot, player)) {
             onStatusChange(GameStatus.GAME_OVER);
             playPopSound();
        }
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
    ctx.fillRect(0,0,cw,ch);
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
    const tl = worldToScreen(0,0);
    const br = worldToScreen(WORLD_WIDTH, WORLD_HEIGHT);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 5;
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

    // Food
    foodsRef.current.forEach(food => {
        const sp = worldToScreen(food.x, food.y);
        // Culling
        if (sp.x > -50 && sp.x < cw + 50 && sp.y > -50 && sp.y < ch + 50) {
            // Draw simple circle for food
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
        ctx.beginPath(); ctx.arc(sp.x, sp.y, 4, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1.0;
        if (p.life <= 0) particlesRef.current.splice(idx, 1);
    });

    // Bots
    botsRef.current.forEach(bot => {
        drawBlob(ctx, bot, false);
    });

    // Player
    drawBlob(ctx, player, true);

    // Control Line
    if (hasHand) {
        const fPos = lastFingerPosRef.current;
        const center = { x: cw/2, y: ch/2 };
        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(fPos.x, fPos.y);
        ctx.strokeStyle = isSpreadingHand ? 'rgba(244, 63, 94, 0.6)' : 'rgba(34, 211, 238, 0.3)';
        ctx.lineWidth = isSpreadingHand ? 4 : 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Palm Cursor Visualization
        ctx.beginPath();
        ctx.arc(fPos.x, fPos.y, 16, 0, Math.PI*2); // Larger circle for palm
        ctx.fillStyle = isSpreadingHand ? 'rgba(244, 63, 94, 0.3)' : 'rgba(34, 211, 238, 0.2)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = isSpreadingHand ? '#f43f5e' : 'rgba(34, 211, 238, 0.8)';
        ctx.stroke();
        
        if (isSpreadingHand) {
             ctx.fillStyle = '#f43f5e';
             ctx.font = 'bold 12px "Inter"';
             ctx.textAlign = 'center';
             ctx.fillText('EJECT', fPos.x, fPos.y - 26);
        }
    }
  };

  return (
    <div className="relative w-full h-full bg-black rounded-3xl overflow-hidden border border-slate-700 shadow-2xl">
      <video ref={videoRef} className="hidden" autoPlay playsInline muted />
      <canvas ref={canvasRef} width={1280} height={720} className="w-full h-full object-cover" />
      
      {errorMsg && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 p-8 z-50">
           <div className="max-w-md text-center">
              <div className="text-rose-500 text-5xl mb-4">⚠️</div>
              <h3 className="text-xl font-bold text-white mb-2">Error</h3>
              <p className="text-rose-300 mb-6">{errorMsg}</p>
              <button onClick={() => window.location.reload()} className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-full text-white">Reload</button>
           </div>
        </div>
      )}

      {/* Loading Overlay */}
      {!errorMsg && gameStatus === GameStatus.LOADING_MODEL && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-40">
           <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
           <p className="text-cyan-400 font-mono animate-pulse">Initializing Vision System...</p>
        </div>
      )}

      {/* HUD Overlay */}
      {gameStatus === GameStatus.PLAYING && (
          <div className="absolute top-4 left-4 flex gap-4 pointer-events-none">
              <div className="bg-black/50 backdrop-blur px-4 py-2 rounded-lg border border-white/10">
                  <span className="text-xs text-slate-400 uppercase block">Mass</span>
                  <span className="text-xl font-bold text-cyan-400">{Math.floor(scoreRef.current)}</span>
              </div>
          </div>
      )}
    </div>
  );
};
