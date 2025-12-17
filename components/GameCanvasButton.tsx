import React, { useEffect, useRef, useState } from 'react';
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
    PLAYER_TURN_SPEED,
    MIN_SPLIT_RADIUS,
    SPLIT_FORCE,
    MAX_PLAYER_BLOBS,
    MERGE_COOLDOWN_MS,
    SELF_COLLISION_PUSH,
    MERGE_ATTRACTION,
    MERGE_OVERLAP_RATIO
} from '../constants';

interface GameCanvasButtonProps {
    onScoreUpdate: (score: number) => void;
    onStatusChange: (status: GameStatus) => void;
    onLeaderboardUpdate: (leaderboard: LeaderboardEntry[]) => void;
    gameStatus: GameStatus;
    lang: Language;
}

export const GameCanvasButton: React.FC<GameCanvasButtonProps> = ({
    onScoreUpdate,
    onStatusChange,
    onLeaderboardUpdate,
    gameStatus,
    lang
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const langRef = useRef<Language>(lang);

    useEffect(() => {
        langRef.current = lang;
    }, [lang]);

    // Logic Refs
    const requestRef = useRef<number>(0);

    // Game State Refs
    const playerRef = useRef<BlobEntity[]>([]);
    const foodsRef = useRef<BlobEntity[]>([]);
    const botsRef = useRef<BlobEntity[]>([]);
    const cameraRef = useRef<Camera>({ x: 0, y: 0, scale: 1 });
    const particlesRef = useRef<Particle[]>([]);
    const scoreRef = useRef<number>(0);
    const timeRef = useRef<number>(0);
    const lastEjectTimeRef = useRef<number>(0);
    const lastSplitTimeRef = useRef<number>(0);

    // Keyboard/Touch Input State
    const keysRef = useRef<Set<string>>(new Set());
    const joystickRef = useRef<{ active: boolean; dx: number; dy: number }>({ active: false, dx: 0, dy: 0 });
    const joystickStartRef = useRef<Point>({ x: 0, y: 0 });
    const splitPressedRef = useRef<boolean>(false);
    const ejectPressedRef = useRef<boolean>(false);

    // Audio Refs
    const audioCtxRef = useRef<AudioContext | null>(null);
    const bgmRef = useRef<HTMLAudioElement | null>(null);

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

    // --- Keyboard Controls ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            keysRef.current.add(key);

            // J = Split, K = Eject
            if (key === 'j') splitPressedRef.current = true;
            if (key === 'k') ejectPressedRef.current = true;
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

    // --- Game Initialization ---
    useEffect(() => {
        onStatusChange(GameStatus.IDLE);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            if (audioCtxRef.current) audioCtxRef.current.close();
        };
    }, []);

    // --- Game Functions ---
    const spawnFoods = () => {
        const foods: BlobEntity[] = [];
        for (let i = 0; i < FOOD_COUNT; i++) {
            foods.push({
                id: `food-${i}`,
                x: Math.random() * WORLD_WIDTH,
                y: Math.random() * WORLD_HEIGHT,
                radius: MIN_FOOD_RADIUS + Math.random() * (MAX_FOOD_RADIUS - MIN_FOOD_RADIUS),
                color: FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)],
                vx: 0, vy: 0
            });
        }
        foodsRef.current = foods;
    };

    const spawnBots = () => {
        const bots: BlobEntity[] = [];
        for (let i = 0; i < BOT_COUNT; i++) {
            bots.push({
                id: `bot-${i}`,
                name: BOT_NAMES[i % BOT_NAMES.length],
                x: Math.random() * WORLD_WIDTH,
                y: Math.random() * WORLD_HEIGHT,
                radius: INITIAL_PLAYER_RADIUS + Math.random() * 20,
                color: `hsl(${Math.random() * 360}, 70%, 60%)`,
                vx: 0, vy: 0
            });
        }
        botsRef.current = bots;
    };

    const ejectSpore = (targetX: number, targetY: number) => {
        let ejected = false;
        const handWorldX = targetX + cameraRef.current.x;
        const handWorldY = targetY + cameraRef.current.y;

        playerRef.current.forEach(blob => {
            if (blob.radius < MIN_EJECT_RADIUS) return;

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

    const splitPlayer = (targetX: number, targetY: number) => {
        const currentBlobs = playerRef.current;
        if (currentBlobs.length >= MAX_PLAYER_BLOBS) return;

        const handWorldX = targetX + cameraRef.current.x;
        const handWorldY = targetY + cameraRef.current.y;

        const newBlobs: BlobEntity[] = [];
        let didSplit = false;

        currentBlobs.forEach(blob => {
            if (blob.radius >= MIN_SPLIT_RADIUS && (playerRef.current.length + newBlobs.length) < MAX_PLAYER_BLOBS) {
                const dx = handWorldX - blob.x;
                const dy = handWorldY - blob.y;
                const angle = Math.atan2(dy, dx);

                const newRadius = blob.radius / Math.SQRT2;
                blob.radius = newRadius;

                const splitBlob: BlobEntity = {
                    ...blob,
                    id: `player-${Date.now()}-${Math.random()}`,
                    radius: newRadius,
                    vx: blob.vx + Math.cos(angle) * SPLIT_FORCE,
                    vy: blob.vy + Math.sin(angle) * SPLIT_FORCE,
                    mergeTimestamp: Date.now() + MERGE_COOLDOWN_MS
                };

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
            vy: 0
        }];
        spawnFoods();
        spawnBots();
        cameraRef.current = { x: cx - 640, y: cy - 360, scale: 1 };
        scoreRef.current = INITIAL_PLAYER_RADIUS;
        onScoreUpdate(INITIAL_PLAYER_RADIUS);
    };

    // --- Bot AI ---
    const updateBots = () => {
        botsRef.current.forEach(bot => {
            if (bot.radius <= 0) return;
            let targetX = bot.x;
            let targetY = bot.y;
            let minDist = BOT_VIEW_DISTANCE;
            let dangerX = 0;
            let dangerY = 0;

            foodsRef.current.forEach(food => {
                const d = Math.hypot(food.x - bot.x, food.y - bot.y);
                if (d < minDist) {
                    minDist = d;
                    targetX = food.x;
                    targetY = food.y;
                }
            });

            playerRef.current.forEach(pBlob => {
                const d = Math.hypot(pBlob.x - bot.x, pBlob.y - bot.y);
                if (d < BOT_VIEW_DISTANCE) {
                    if (pBlob.radius > bot.radius * 1.1) {
                        const fleeStrength = 300 / Math.max(d, 1);
                        dangerX += (bot.x - pBlob.x) / d * fleeStrength;
                        dangerY += (bot.y - pBlob.y) / d * fleeStrength;
                    } else if (pBlob.radius < bot.radius * 0.9 && d < minDist) {
                        minDist = d;
                        targetX = pBlob.x;
                        targetY = pBlob.y;
                    }
                }
            });

            let angle: number;
            if (Math.abs(dangerX) > 0.1 || Math.abs(dangerY) > 0.1) {
                angle = Math.atan2(dangerY, dangerX);
            } else {
                angle = Math.atan2(targetY - bot.y, targetX - bot.x);
            }

            if (minDist > BOT_VIEW_DISTANCE * 0.8) {
                angle += (Math.random() - 0.5) * 0.5;
            }

            // Bot 速度也降低，与玩家保持平衡
            const speedFactor = BASE_SPEED * (25 / Math.max(25, bot.radius)) ** 0.5 * 0.5;
            const tvx = Math.cos(angle) * speedFactor;
            const tvy = Math.sin(angle) * speedFactor;
            bot.vx += (tvx - bot.vx) * PLAYER_TURN_SPEED;
            bot.vy += (tvy - bot.vy) * PLAYER_TURN_SPEED;
            bot.x += bot.vx;
            bot.y += bot.vy;
            bot.x = Math.max(bot.radius, Math.min(WORLD_WIDTH - bot.radius, bot.x));
            bot.y = Math.max(bot.radius, Math.min(WORLD_HEIGHT - bot.radius, bot.y));
        });
    };

    // --- Leaderboard ---
    const updateLeaderboard = () => {
        let playerMass = 0;
        playerRef.current.forEach(b => playerMass += b.radius);
        const entries: LeaderboardEntry[] = [
            { id: 'player', name: 'You', mass: Math.floor(playerMass), isPlayer: true }
        ];
        botsRef.current.forEach(bot => {
            entries.push({ id: bot.id, name: bot.name || 'Bot', mass: Math.floor(bot.radius), isPlayer: false });
        });
        entries.sort((a, b) => b.mass - a.mass);
        onLeaderboardUpdate(entries);
    };

    // --- Main Loop ---
    const animate = () => {
        if (gameStatus === GameStatus.PLAYING) {
            requestRef.current = requestAnimationFrame(animate);
        }
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const cw = canvas.width;
        const ch = canvas.height;

        timeRef.current += 1;
        if (timeRef.current % 15 === 0) updateLeaderboard();

        // --- 1. INPUT from keyboard/joystick ---
        let dx = 0;
        let dy = 0;

        // Keyboard WASD or Arrow Keys
        if (keysRef.current.has('w') || keysRef.current.has('arrowup')) dy -= 1;
        if (keysRef.current.has('s') || keysRef.current.has('arrowdown')) dy += 1;
        if (keysRef.current.has('a') || keysRef.current.has('arrowleft')) dx -= 1;
        if (keysRef.current.has('d') || keysRef.current.has('arrowright')) dx += 1;

        // Touch Joystick
        if (joystickRef.current.active) {
            dx = joystickRef.current.dx;
            dy = joystickRef.current.dy;
        }

        const dist = Math.hypot(dx, dy);
        // 按键模式速度降低到60%，避免太快
        const throttle = Math.min(dist, 1.0) * 0.6;
        const targetAngle = dist > 0.1 ? Math.atan2(dy, dx) : 0;

        // Handle Split/Eject from keyboard
        const now = Date.now();
        if (splitPressedRef.current && now - lastSplitTimeRef.current > 500) {
            // Split towards movement direction
            const splitTargetX = cw / 2 + Math.cos(targetAngle) * 100;
            const splitTargetY = ch / 2 + Math.sin(targetAngle) * 100;
            splitPlayer(splitTargetX, splitTargetY);
            lastSplitTimeRef.current = now;
            splitPressedRef.current = false;
        }

        if (ejectPressedRef.current && now - lastEjectTimeRef.current > EJECT_COOLDOWN_MS) {
            const ejectTargetX = cw / 2 + Math.cos(targetAngle) * 100;
            const ejectTargetY = ch / 2 + Math.sin(targetAngle) * 100;
            ejectSpore(ejectTargetX, ejectTargetY);
            lastEjectTimeRef.current = now;
            ejectPressedRef.current = false;
        }

        // --- 2. PHYSICS ---
        playerRef.current.forEach(blob => {
            const speedFactor = BASE_SPEED * (25 / Math.max(25, blob.radius)) ** 0.5;
            const tvx = Math.cos(targetAngle) * speedFactor * throttle;
            const tvy = Math.sin(targetAngle) * speedFactor * throttle;

            blob.vx += (tvx - blob.vx) * PLAYER_TURN_SPEED;
            blob.vy += (tvy - blob.vy) * PLAYER_TURN_SPEED;
            blob.x += blob.vx;
            blob.y += blob.vy;

            if (blob.x < blob.radius) { blob.x = blob.radius; blob.vx *= -0.5; }
            if (blob.x > WORLD_WIDTH - blob.radius) { blob.x = WORLD_WIDTH - blob.radius; blob.vx *= -0.5; }
            if (blob.y < blob.radius) { blob.y = blob.radius; blob.vy *= -0.5; }
            if (blob.y > WORLD_HEIGHT - blob.radius) { blob.y = WORLD_HEIGHT - blob.radius; blob.vy *= -0.5; }
        });

        // Self-collision and merging
        for (let i = 0; i < playerRef.current.length; i++) {
            for (let j = i + 1; j < playerRef.current.length; j++) {
                const b1 = playerRef.current[i];
                const b2 = playerRef.current[j];
                const blobDx = b2.x - b1.x;
                const blobDy = b2.y - b1.y;
                const blobDist = Math.hypot(blobDx, blobDy);
                const radSum = b1.radius + b2.radius;

                if (blobDist < radSum) {
                    const canMerge = (!b1.mergeTimestamp || b1.mergeTimestamp < now) &&
                        (!b2.mergeTimestamp || b2.mergeTimestamp < now);

                    if (canMerge) {
                        const invMass1 = 1 / b1.radius;
                        const invMass2 = 1 / b2.radius;
                        const totalInvMass = invMass1 + invMass2;
                        const moveX = blobDx * MERGE_ATTRACTION;
                        const moveY = blobDy * MERGE_ATTRACTION;
                        b1.x += moveX * (invMass1 / totalInvMass);
                        b1.y += moveY * (invMass1 / totalInvMass);
                        b2.x -= moveX * (invMass2 / totalInvMass);
                        b2.y -= moveY * (invMass2 / totalInvMass);

                        if (blobDist < radSum * MERGE_OVERLAP_RATIO) {
                            const newArea = b1.radius * b1.radius + b2.radius * b2.radius;
                            const newRadius = Math.sqrt(newArea);
                            const r1Sq = b1.radius * b1.radius;
                            const r2Sq = b2.radius * b2.radius;
                            const totalArea = r1Sq + r2Sq;
                            b1.vx = (b1.vx * r1Sq + b2.vx * r2Sq) / totalArea;
                            b1.vy = (b1.vy * r1Sq + b2.vy * r2Sq) / totalArea;
                            b1.radius = newRadius;
                            b1.x = (b1.x * r1Sq + b2.x * r2Sq) / totalArea;
                            b1.y = (b1.y * r1Sq + b2.y * r2Sq) / totalArea;
                            playerRef.current.splice(j, 1);
                            j--;
                        }
                        continue;
                    }

                    if (blobDist > 0) {
                        const overlap = radSum - blobDist;
                        const push = Math.min(overlap, 4.0) * SELF_COLLISION_PUSH;
                        const nx = blobDx / blobDist;
                        const ny = blobDy / blobDist;
                        b1.x -= nx * push;
                        b1.y -= ny * push;
                        b2.x += nx * push;
                        b2.y += ny * push;
                    }
                }
            }
        }

        // Food physics
        foodsRef.current.forEach(food => {
            if (Math.abs(food.vx) > 0.1 || Math.abs(food.vy) > 0.1) {
                food.x += food.vx;
                food.y += food.vy;
                food.vx *= FOOD_FRICTION;
                food.vy *= FOOD_FRICTION;
                if (food.x < 0 || food.x > WORLD_WIDTH) food.vx *= -1;
                if (food.y < 0 || food.y > WORLD_HEIGHT) food.vy *= -1;
            }
        });

        updateBots();

        // --- 3. COLLISION ---
        // Player eats food
        playerRef.current.forEach(blob => {
            for (let i = foodsRef.current.length - 1; i >= 0; i--) {
                const food = foodsRef.current[i];
                if (checkCollision(blob, food)) {
                    blob.radius = Math.sqrt(blob.radius * blob.radius + food.radius * food.radius * GROWTH_FACTOR);
                    foodsRef.current.splice(i, 1);
                    playEatSound(blob.radius);
                }
            }
        });

        // Player eats bot
        playerRef.current.forEach(blob => {
            botsRef.current.forEach(bot => {
                if (blob.radius > bot.radius * 1.1 && checkCollision(blob, bot)) {
                    blob.radius = Math.sqrt(blob.radius * blob.radius + bot.radius * bot.radius);
                    bot.radius = 0;
                    playPopSound();
                }
            });
        });

        // Bot eats player
        let playerDied = false;
        botsRef.current.forEach(bot => {
            for (let i = playerRef.current.length - 1; i >= 0; i--) {
                const blob = playerRef.current[i];
                if (bot.radius > blob.radius * 1.1 && checkCollision(bot, blob)) {
                    bot.radius = Math.sqrt(bot.radius * bot.radius + blob.radius * blob.radius);
                    playerRef.current.splice(i, 1);
                    playPopSound();
                    if (playerRef.current.length === 0) playerDied = true;
                }
            }
        });

        // Bot eats food
        botsRef.current.forEach(bot => {
            for (let i = foodsRef.current.length - 1; i >= 0; i--) {
                const food = foodsRef.current[i];
                if (checkCollision(bot, food)) {
                    bot.radius = Math.sqrt(bot.radius * bot.radius + food.radius * food.radius * GROWTH_FACTOR);
                    foodsRef.current.splice(i, 1);
                }
            }
        });

        // Respawn dead bots
        botsRef.current.forEach(bot => {
            if (bot.radius <= 0) {
                bot.x = Math.random() * WORLD_WIDTH;
                bot.y = Math.random() * WORLD_HEIGHT;
                bot.radius = INITIAL_PLAYER_RADIUS + Math.random() * 10;
                bot.vx = 0;
                bot.vy = 0;
            }
        });

        // Replenish food
        while (foodsRef.current.length < FOOD_COUNT) {
            foodsRef.current.push({
                id: `food-${Date.now()}-${Math.random()}`,
                x: Math.random() * WORLD_WIDTH,
                y: Math.random() * WORLD_HEIGHT,
                radius: MIN_FOOD_RADIUS + Math.random() * (MAX_FOOD_RADIUS - MIN_FOOD_RADIUS),
                color: FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)],
                vx: 0, vy: 0
            });
        }

        // Update Score
        let totalMass = 0;
        playerRef.current.forEach(b => totalMass += b.radius);
        scoreRef.current = totalMass;
        onScoreUpdate(totalMass);

        if (playerDied) {
            onStatusChange(GameStatus.GAME_OVER);
            stopBGM();
            return;
        }

        // --- 4. CAMERA ---
        let centroidX = 0, centroidY = 0, totalPlayerMass = 0;
        playerRef.current.forEach(b => {
            centroidX += b.x * b.radius;
            centroidY += b.y * b.radius;
            totalPlayerMass += b.radius;
        });
        if (totalPlayerMass > 0) {
            centroidX /= totalPlayerMass;
            centroidY /= totalPlayerMass;
        }
        const targetCamX = centroidX - cw / 2;
        const targetCamY = centroidY - ch / 2;
        cameraRef.current.x += (targetCamX - cameraRef.current.x) * 0.1;
        cameraRef.current.y += (targetCamY - cameraRef.current.y) * 0.1;

        // --- 5. RENDER ---
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, cw, ch);

        // Grid
        ctx.strokeStyle = COLOR_GRID;
        ctx.lineWidth = 1;
        const startGridX = Math.floor(cameraRef.current.x / GRID_SIZE) * GRID_SIZE;
        const startGridY = Math.floor(cameraRef.current.y / GRID_SIZE) * GRID_SIZE;
        ctx.beginPath();
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

        // World Boundary
        const tl = worldToScreen(0, 0);
        const br = worldToScreen(WORLD_WIDTH, WORLD_HEIGHT);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 5;
        ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);

        // Foods
        foodsRef.current.forEach(food => {
            const sp = worldToScreen(food.x, food.y);
            if (sp.x > -50 && sp.x < cw + 50 && sp.y > -50 && sp.y < ch + 50) {
                ctx.beginPath();
                ctx.arc(sp.x, sp.y, food.radius, 0, Math.PI * 2);
                ctx.fillStyle = food.color;
                ctx.fill();
            }
        });

        // Bots
        botsRef.current.forEach(bot => {
            if (bot.radius <= 0) return;
            drawBlob(ctx, bot, false);
        });

        // Player Blobs
        playerRef.current.forEach(blob => {
            drawBlob(ctx, blob, true);
        });
    };

    const worldToScreen = (wx: number, wy: number): Point => {
        return { x: wx - cameraRef.current.x, y: wy - cameraRef.current.y };
    };

    const drawBlob = (ctx: CanvasRenderingContext2D, blob: BlobEntity, isPlayer: boolean) => {
        ctx.beginPath();
        const segments = 20;
        const time = timeRef.current;
        const currentT = translations[langRef.current];

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
        ctx.strokeStyle = isPlayer ? COLOR_PLAYER_BORDER : 'rgba(0,0,0,0.3)';
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
            let displayName = blob.name || (isPlayer ? currentT.you : 'Bot');
            if (isPlayer) displayName = currentT.you;
            ctx.fillText(displayName, spCenter.x, spCenter.y + 4);
        }
    };

    const checkCollision = (a: BlobEntity, b: BlobEntity) => {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        return d < a.radius - b.radius * 0.2;
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
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        const currentT = translations[langRef.current];
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        // Draw some idle animation
        const time = Date.now() * 0.001;
        ctx.fillStyle = 'rgba(34, 211, 238, 0.1)';
        for (let i = 0; i < 5; i++) {
            const x = canvasRef.current.width / 2 + Math.cos(time + i) * 100;
            const y = canvasRef.current.height / 2 + Math.sin(time * 0.7 + i) * 80;
            ctx.beginPath();
            ctx.arc(x, y, 20 + i * 10, 0, Math.PI * 2);
            ctx.fill();
        }

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

    // Touch handlers for virtual joystick
    const handleTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = touch.clientX - rect.left;
        // Only activate joystick on left half of screen
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
        splitPressedRef.current = true;
    };

    const handleEjectButton = () => {
        ejectPressedRef.current = true;
    };

    const t = translations[lang];

    return (
        <div className="relative w-full h-full bg-black rounded-3xl overflow-hidden border border-slate-700 shadow-2xl">
            <canvas
                ref={canvasRef}
                width={1280}
                height={720}
                className="w-full h-full object-cover"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            />

            {/* Mobile Action Buttons */}
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

            {/* Keyboard Guide */}
            {gameStatus === GameStatus.PLAYING && (
                <div className="absolute bottom-4 left-4 hidden sm:block">
                    <div className="bg-black/50 backdrop-blur px-3 py-2 rounded-lg border border-white/10 text-xs text-slate-400">
                        <div>WASD: 移动 | J: 分裂 | K: 吐孢子</div>
                    </div>
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
