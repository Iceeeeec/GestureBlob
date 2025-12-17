import { BlobEntity, FoodEntity, PlayerState, PlayerInput, LeaderboardEntry, GameStateSnapshot } from './types.js';

// 游戏常量
const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 3000;
const INITIAL_PLAYER_RADIUS = 25;
const MIN_FOOD_RADIUS = 5;
const MAX_FOOD_RADIUS = 12;
const FOOD_COUNT = 150;
const BASE_SPEED = 20;
const PLAYER_TURN_SPEED = 0.25;
const GROWTH_FACTOR = 0.8;

// Bot 常量
const BOT_COUNT = 6;
const BOT_VIEW_DISTANCE = 400;
const BOT_NAMES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];

// 分裂相关
const MIN_SPLIT_RADIUS = 35;
const SPLIT_FORCE = 18;
const MAX_PLAYER_BLOBS = 8;
const MERGE_COOLDOWN_MS = 10000;
const MERGE_ATTRACTION = 0.01;
const MERGE_OVERLAP_RATIO = 0.1;
const SELF_COLLISION_PUSH = 0.5;

// 喷射相关
const SPORE_RADIUS = 10;
const SPORE_SPEED = 18;
const MIN_EJECT_RADIUS = 35;
const FOOD_FRICTION = 0.94;

const FOOD_COLORS = [
  '#f87171', '#fbbf24', '#a3e635', '#34d399',
  '#818cf8', '#e879f9', '#ec4899', '#6366f1'
];

const PLAYER_COLORS = [
  '#22d3ee', // Cyan
  '#f472b6', // Pink
  '#a78bfa', // Purple
  '#4ade80', // Green
];

export class GameEngine {
  private players: Map<string, PlayerState> = new Map();
  private bots: Map<string, PlayerState> = new Map();
  private foods: FoodEntity[] = [];
  private lastUpdate: number = Date.now();
  private colorIndex: number = 0;
  private botColorIndex: number = 0;

  constructor() {
    this.spawnFood(FOOD_COUNT);
    this.spawnBots(BOT_COUNT);
  }

  addPlayer(playerId: string, name: string): void {
    const color = PLAYER_COLORS[this.colorIndex % PLAYER_COLORS.length];
    this.colorIndex++;

    const spawnPos = this.getRandomSpawnPosition();

    const player: PlayerState = {
      id: playerId,
      name,
      color,
      isAlive: true,
      blobs: [{
        id: `${playerId}-0`,
        x: spawnPos.x,
        y: spawnPos.y,
        radius: INITIAL_PLAYER_RADIUS,
        color,
        vx: 0,
        vy: 0,
        name
      }]
    };

    this.players.set(playerId, player);
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
  }

  respawnPlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;

    const spawnPos = this.getRandomSpawnPosition();
    player.isAlive = true;
    player.blobs = [{
      id: `${playerId}-${Date.now()}`,
      x: spawnPos.x,
      y: spawnPos.y,
      radius: INITIAL_PLAYER_RADIUS,
      color: player.color,
      vx: 0,
      vy: 0,
      name: player.name
    }];
  }

  private getRandomSpawnPosition(): { x: number; y: number } {
    // 避免在边缘生成
    const margin = 200;
    return {
      x: margin + Math.random() * (WORLD_WIDTH - margin * 2),
      y: margin + Math.random() * (WORLD_HEIGHT - margin * 2)
    };
  }

  processInput(playerId: string, input: PlayerInput): void {
    const player = this.players.get(playerId);
    if (!player || !player.isAlive) return;

    // 处理动作
    if (input.action === 'split') {
      // Pass split target coordinates for per-blob angle calculation
      this.splitPlayer(player, input.splitTargetX, input.splitTargetY);
    } else if (input.action === 'eject') {
      this.ejectSpore(player, input.ejectTargetX, input.ejectTargetY);
    }

    // 存储输入用于物理更新
    (player as any)._input = input;
  }

  private splitPlayer(player: PlayerState, targetX?: number, targetY?: number): void {
    if (player.blobs.length >= MAX_PLAYER_BLOBS) return;

    const newBlobs: BlobEntity[] = [];
    const now = Date.now();

    player.blobs.forEach(blob => {
      if (blob.radius >= MIN_SPLIT_RADIUS && (player.blobs.length + newBlobs.length) < MAX_PLAYER_BLOBS) {
        // Calculate angle from this blob towards the target position (hand world coordinates)
        let angle: number;
        if (targetX !== undefined && targetY !== undefined) {
          const dx = targetX - blob.x;
          const dy = targetY - blob.y;
          angle = Math.atan2(dy, dx);
        } else {
          // Fallback to blob's current velocity direction
          angle = Math.atan2(blob.vy, blob.vx);
        }

        const newRadius = blob.radius / Math.SQRT2;
        blob.radius = newRadius;

        const splitBlob: BlobEntity = {
          ...blob,
          id: `${player.id}-${Date.now()}-${Math.random()}`,
          radius: newRadius,
          vx: blob.vx + Math.cos(angle) * SPLIT_FORCE,
          vy: blob.vy + Math.sin(angle) * SPLIT_FORCE,
          mergeTimestamp: now + MERGE_COOLDOWN_MS
        };

        splitBlob.x += Math.cos(angle) * (newRadius * 2);
        splitBlob.y += Math.sin(angle) * (newRadius * 2);

        newBlobs.push(splitBlob);
      }
    });

    player.blobs.push(...newBlobs);
  }

  private ejectSpore(player: PlayerState, targetX?: number, targetY?: number): void {
    player.blobs.forEach(blob => {
      if (blob.radius < MIN_EJECT_RADIUS) return;

      // Calculate angle from this blob towards the target position (hand world coordinates)
      let angle: number;
      if (targetX !== undefined && targetY !== undefined) {
        const dx = targetX - blob.x;
        const dy = targetY - blob.y;
        angle = Math.atan2(dy, dx);
      } else {
        // Fallback to blob's current velocity direction
        angle = Math.atan2(blob.vy, blob.vx);
      }

      const newAreaSq = blob.radius * blob.radius - SPORE_RADIUS * SPORE_RADIUS;
      blob.radius = Math.sqrt(newAreaSq);

      const startDist = blob.radius + SPORE_RADIUS + 5;
      const spore: FoodEntity = {
        id: `spore-${Date.now()}-${Math.random()}`,
        x: blob.x + Math.cos(angle) * startDist,
        y: blob.y + Math.sin(angle) * startDist,
        vx: Math.cos(angle) * SPORE_SPEED,
        vy: Math.sin(angle) * SPORE_SPEED,
        radius: SPORE_RADIUS,
        color: blob.color
      };
      this.foods.push(spore);
    });
  }

  update(): void {
    const now = Date.now();
    this.lastUpdate = now;

    // 更新每个玩家
    this.players.forEach(player => {
      if (!player.isAlive) return;

      const input: PlayerInput = (player as any)._input || { angle: 0, throttle: 0, action: 'none' };

      // 移动每个 blob
      player.blobs.forEach(blob => {
        const speedFactor = BASE_SPEED * Math.pow(25 / Math.max(25, blob.radius), 0.5);
        const tvx = Math.cos(input.angle) * speedFactor * input.throttle;
        const tvy = Math.sin(input.angle) * speedFactor * input.throttle;

        blob.vx += (tvx - blob.vx) * PLAYER_TURN_SPEED;
        blob.vy += (tvy - blob.vy) * PLAYER_TURN_SPEED;
        blob.x += blob.vx;
        blob.y += blob.vy;

        // 边界
        if (blob.x < blob.radius) { blob.x = blob.radius; blob.vx *= -0.5; }
        if (blob.x > WORLD_WIDTH - blob.radius) { blob.x = WORLD_WIDTH - blob.radius; blob.vx *= -0.5; }
        if (blob.y < blob.radius) { blob.y = blob.radius; blob.vy *= -0.5; }
        if (blob.y > WORLD_HEIGHT - blob.radius) { blob.y = WORLD_HEIGHT - blob.radius; blob.vy *= -0.5; }
      });

      // 自身碰撞与合并
      this.resolveSelfCollision(player, now);
    });

    // 食物物理
    this.foods.forEach(food => {
      if (Math.abs(food.vx) > 0.1 || Math.abs(food.vy) > 0.1) {
        food.x += food.vx;
        food.y += food.vy;
        food.vx *= FOOD_FRICTION;
        food.vy *= FOOD_FRICTION;
        if (food.x < 0 || food.x > WORLD_WIDTH) food.vx *= -1;
        if (food.y < 0 || food.y > WORLD_HEIGHT) food.vy *= -1;
      }
    });

    // 更新 Bot AI
    this.updateBots();

    // 碰撞检测
    this.checkCollisions();

    // 补充食物
    if (this.foods.length < FOOD_COUNT) {
      this.spawnFood(FOOD_COUNT - this.foods.length);
    }
  }

  private resolveSelfCollision(player: PlayerState, now: number): void {
    const blobs = player.blobs;

    for (let i = 0; i < blobs.length; i++) {
      for (let j = i + 1; j < blobs.length; j++) {
        const b1 = blobs[i];
        const b2 = blobs[j];
        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const dist = Math.hypot(dx, dy);
        const radSum = b1.radius + b2.radius;

        if (dist < radSum) {
          const canMerge = (!b1.mergeTimestamp || b1.mergeTimestamp < now) &&
            (!b2.mergeTimestamp || b2.mergeTimestamp < now);

          if (canMerge) {
            const invMass1 = 1 / b1.radius;
            const invMass2 = 1 / b2.radius;
            const totalInvMass = invMass1 + invMass2;

            const moveX = dx * MERGE_ATTRACTION;
            const moveY = dy * MERGE_ATTRACTION;

            b1.x += moveX * (invMass1 / totalInvMass);
            b1.y += moveY * (invMass1 / totalInvMass);
            b2.x -= moveX * (invMass2 / totalInvMass);
            b2.y -= moveY * (invMass2 / totalInvMass);

            if (dist < radSum * MERGE_OVERLAP_RATIO) {
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

              blobs.splice(j, 1);
              j--;
            }
            continue;
          }

          if (dist > 0) {
            const overlap = radSum - dist;
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
  }

  private checkCollisions(): void {
    // 合并玩家和 Bot 进行统一碰撞检测
    const allEntities = [
      ...Array.from(this.players.values()),
      ...Array.from(this.bots.values())
    ];

    // 所有实体 vs 食物
    allEntities.forEach(entity => {
      if (!entity.isAlive) return;

      entity.blobs.forEach(blob => {
        for (let i = this.foods.length - 1; i >= 0; i--) {
          const food = this.foods[i];
          if (this.checkCollision(blob, food)) {
            blob.radius = Math.sqrt(blob.radius * blob.radius + food.radius * food.radius * GROWTH_FACTOR);
            this.foods.splice(i, 1);
          }
        }
      });
    });

    // 实体 vs 实体
    for (let i = 0; i < allEntities.length; i++) {
      for (let j = i + 1; j < allEntities.length; j++) {
        const p1 = allEntities[i];
        const p2 = allEntities[j];

        if (!p1.isAlive || !p2.isAlive) continue;

        // p1 的 blob 吃 p2 的 blob
        p1.blobs.forEach(b1 => {
          for (let k = p2.blobs.length - 1; k >= 0; k--) {
            const b2 = p2.blobs[k];
            if (b1.radius > b2.radius * 1.1 && this.checkCollision(b1, b2)) {
              b1.radius = Math.sqrt(b1.radius * b1.radius + b2.radius * b2.radius);
              p2.blobs.splice(k, 1);
            }
          }
        });

        // p2 的 blob 吃 p1 的 blob
        p2.blobs.forEach(b2 => {
          for (let k = p1.blobs.length - 1; k >= 0; k--) {
            const b1 = p1.blobs[k];
            if (b2.radius > b1.radius * 1.1 && this.checkCollision(b2, b1)) {
              b2.radius = Math.sqrt(b2.radius * b2.radius + b1.radius * b1.radius);
              p1.blobs.splice(k, 1);
            }
          }
        });
      }
    }

    // 检查死亡
    allEntities.forEach(entity => {
      if (entity.isAlive && entity.blobs.length === 0) {
        entity.isAlive = false;
      }
    });
  }

  private checkCollision(a: BlobEntity | FoodEntity, b: BlobEntity | FoodEntity): boolean {
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    return dist < a.radius - b.radius * 0.2;
  }

  private spawnFood(count: number): void {
    for (let i = 0; i < count; i++) {
      this.foods.push({
        id: `food-${Date.now()}-${Math.random()}`,
        x: Math.random() * WORLD_WIDTH,
        y: Math.random() * WORLD_HEIGHT,
        radius: MIN_FOOD_RADIUS + Math.random() * (MAX_FOOD_RADIUS - MIN_FOOD_RADIUS),
        color: FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)],
        vx: 0,
        vy: 0
      });
    }
  }

  private spawnBots(count: number): void {
    for (let i = 0; i < count; i++) {
      const botId = `bot-${i}`;
      const name = BOT_NAMES[i % BOT_NAMES.length];
      const color = PLAYER_COLORS[this.botColorIndex % PLAYER_COLORS.length];
      this.botColorIndex++;

      const spawnPos = this.getRandomSpawnPosition();

      const bot: PlayerState = {
        id: botId,
        name,
        color,
        isAlive: true,
        blobs: [{
          id: `${botId}-0`,
          x: spawnPos.x,
          y: spawnPos.y,
          radius: INITIAL_PLAYER_RADIUS + Math.random() * 15,
          color,
          vx: 0,
          vy: 0,
          name
        }]
      };

      this.bots.set(botId, bot);
    }
  }

  private respawnBot(botId: string): void {
    const bot = this.bots.get(botId);
    if (!bot) return;

    const spawnPos = this.getRandomSpawnPosition();
    bot.isAlive = true;
    bot.blobs = [{
      id: `${botId}-${Date.now()}`,
      x: spawnPos.x,
      y: spawnPos.y,
      radius: INITIAL_PLAYER_RADIUS + Math.random() * 10,
      color: bot.color,
      vx: 0,
      vy: 0,
      name: bot.name
    }];
  }

  private updateBots(): void {
    // 获取所有玩家和 Bot 的位置用于 AI 决策
    const allEntities: { x: number; y: number; radius: number; id: string }[] = [];

    this.players.forEach(player => {
      if (!player.isAlive) return;
      player.blobs.forEach(blob => {
        allEntities.push({ x: blob.x, y: blob.y, radius: blob.radius, id: player.id });
      });
    });

    this.bots.forEach(bot => {
      if (!bot.isAlive) return;

      const mainBlob = bot.blobs[0];
      if (!mainBlob) return;

      let targetX = mainBlob.x;
      let targetY = mainBlob.y;
      let minDist = BOT_VIEW_DISTANCE;
      let dangerX = 0;
      let dangerY = 0;

      // 寻找食物
      this.foods.forEach(food => {
        const d = Math.hypot(food.x - mainBlob.x, food.y - mainBlob.y);
        if (d < minDist) {
          minDist = d;
          targetX = food.x;
          targetY = food.y;
        }
      });

      // 检测玩家威胁和猎物
      this.players.forEach(player => {
        if (!player.isAlive) return;
        player.blobs.forEach(pBlob => {
          const d = Math.hypot(pBlob.x - mainBlob.x, pBlob.y - mainBlob.y);
          if (d < BOT_VIEW_DISTANCE) {
            if (pBlob.radius > mainBlob.radius * 1.1) {
              // 逃跑
              const fleeStrength = 300 / Math.max(d, 1);
              dangerX += (mainBlob.x - pBlob.x) / d * fleeStrength;
              dangerY += (mainBlob.y - pBlob.y) / d * fleeStrength;
            } else if (pBlob.radius < mainBlob.radius * 0.9 && d < minDist) {
              // 追逐
              minDist = d;
              targetX = pBlob.x;
              targetY = pBlob.y;
            }
          }
        });
      });

      // 检测其他 Bot
      this.bots.forEach(otherBot => {
        if (otherBot.id === bot.id || !otherBot.isAlive) return;
        otherBot.blobs.forEach(oBlob => {
          const d = Math.hypot(oBlob.x - mainBlob.x, oBlob.y - mainBlob.y);
          if (d < BOT_VIEW_DISTANCE) {
            if (oBlob.radius > mainBlob.radius * 1.1) {
              const fleeStrength = 200 / Math.max(d, 1);
              dangerX += (mainBlob.x - oBlob.x) / d * fleeStrength;
              dangerY += (mainBlob.y - oBlob.y) / d * fleeStrength;
            } else if (oBlob.radius < mainBlob.radius * 0.9 && d < minDist) {
              minDist = d;
              targetX = oBlob.x;
              targetY = oBlob.y;
            }
          }
        });
      });

      // 计算移动方向
      let angle: number;
      if (Math.abs(dangerX) > 0.1 || Math.abs(dangerY) > 0.1) {
        angle = Math.atan2(dangerY, dangerX);
      } else {
        angle = Math.atan2(targetY - mainBlob.y, targetX - mainBlob.x);
      }

      // 添加随机漫游
      if (minDist > BOT_VIEW_DISTANCE * 0.8) {
        angle += (Math.random() - 0.5) * 0.5;
      }

      // 移动 Bot
      const speedFactor = BASE_SPEED * Math.pow(25 / Math.max(25, mainBlob.radius), 0.5) * 0.85;
      const tvx = Math.cos(angle) * speedFactor;
      const tvy = Math.sin(angle) * speedFactor;

      mainBlob.vx += (tvx - mainBlob.vx) * PLAYER_TURN_SPEED;
      mainBlob.vy += (tvy - mainBlob.vy) * PLAYER_TURN_SPEED;
      mainBlob.x += mainBlob.vx;
      mainBlob.y += mainBlob.vy;

      // 边界
      if (mainBlob.x < mainBlob.radius) { mainBlob.x = mainBlob.radius; mainBlob.vx *= -0.5; }
      if (mainBlob.x > WORLD_WIDTH - mainBlob.radius) { mainBlob.x = WORLD_WIDTH - mainBlob.radius; mainBlob.vx *= -0.5; }
      if (mainBlob.y < mainBlob.radius) { mainBlob.y = mainBlob.radius; mainBlob.vy *= -0.5; }
      if (mainBlob.y > WORLD_HEIGHT - mainBlob.radius) { mainBlob.y = WORLD_HEIGHT - mainBlob.radius; mainBlob.vy *= -0.5; }
    });

    // 重生死亡的 Bot
    this.bots.forEach((bot, botId) => {
      if (!bot.isAlive || bot.blobs.length === 0) {
        setTimeout(() => this.respawnBot(botId), 3000);
      }
    });
  }

  getState(forPlayerId?: string): GameStateSnapshot {
    const leaderboard = this.getLeaderboard();

    // 为特定玩家标记 isPlayer
    if (forPlayerId) {
      leaderboard.forEach(entry => {
        entry.isPlayer = entry.id === forPlayerId;
      });
    }

    // 合并玩家和 Bot 数据
    const allPlayers = [
      ...Array.from(this.players.values()),
      ...Array.from(this.bots.values())
    ];

    return {
      players: allPlayers.map(p => ({
        id: p.id,
        name: p.name,
        blobs: p.blobs,
        color: p.color,
        isAlive: p.isAlive
      })),
      foods: this.foods,
      leaderboard,
      timestamp: Date.now()
    };
  }

  private getLeaderboard(): LeaderboardEntry[] {
    const entries: LeaderboardEntry[] = [];

    // 包含玩家
    this.players.forEach(player => {
      const mass = player.blobs.reduce((sum, b) => sum + b.radius, 0);
      entries.push({
        id: player.id,
        name: player.name,
        mass: Math.floor(mass)
      });
    });

    // 包含 Bot
    this.bots.forEach(bot => {
      if (!bot.isAlive) return;
      const mass = bot.blobs.reduce((sum, b) => sum + b.radius, 0);
      entries.push({
        id: bot.id,
        name: bot.name,
        mass: Math.floor(mass)
      });
    });

    entries.sort((a, b) => b.mass - a.mass);
    return entries;
  }

  getPlayerMass(playerId: string): number {
    const player = this.players.get(playerId);
    if (!player) return 0;
    return player.blobs.reduce((sum, b) => sum + b.radius, 0);
  }

  isPlayerAlive(playerId: string): boolean {
    const player = this.players.get(playerId);
    return player?.isAlive ?? false;
  }

  getAlivePlayers(): string[] {
    return Array.from(this.players.values())
      .filter(p => p.isAlive)
      .map(p => p.id);
  }
}
