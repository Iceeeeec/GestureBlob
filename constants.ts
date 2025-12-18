
// Visual & Gameplay tuning
export const INITIAL_PLAYER_RADIUS = 25;
export const MIN_FOOD_RADIUS = 5;
export const MAX_FOOD_RADIUS = 12;
export const FOOD_COUNT = 100; // Increased for bots
export const WORLD_WIDTH = 3000;
export const WORLD_HEIGHT = 3000;
export const GRID_SIZE = 100;

// Bots / AI
export const BOT_COUNT = 12;
export const BOT_NAMES = ["Alpha", "Beta", "Gamma", "Delta", "Omega", "Neo", "Trinity", "Morpheus", "Smith", "Cipher", "Viper", "Ghost"];
export const BOT_VIEW_DISTANCE = 400; // How far bots can "see"

// Spore / Eject Mechanics
export const SPORE_RADIUS = 10;
export const SPORE_SPEED = 18;
export const MIN_EJECT_RADIUS = 35; // Must be at least this big to eject
export const EJECT_COOLDOWN_MS = 80; // 降低吐孢子冷却（原值 150）
export const GESTURE_HOLD_THRESHOLD_MS = 120; // Time to hold open hand before ejecting (Anti-mistouch)
export const FOOD_FRICTION = 0.94; // Spores slide and slow down

// Split Mechanics
export const MIN_SPLIT_RADIUS = 35; // Must be this big to split
export const SPLIT_FORCE = 18; // Impulse speed when splitting
export const MAX_PLAYER_BLOBS = 8; // Max number of pieces player can split into
export const MERGE_COOLDOWN_MS = 10000; // Time before cells can merge back (10s)
export const MERGE_ATTRACTION = 0.01; // How fast cells pull together when merging (0.01 = Slow squeeze)
export const MERGE_OVERLAP_RATIO = 0.1; // Merge happens when distance < (r1+r2) * 0.1
export const SELF_COLLISION_PUSH = 0.5; // Force to push overlapping player cells apart

// Physics
export const BASE_SPEED = 2; // 降低整体移动速度（原值 6）
export const MOVEMENT_SMOOTHING = 0.85; // High value = Very responsive (Palm is stable, so we can reduce lag)
export const INPUT_MAX_SPEED_DISTANCE = 60; // Pixels from center to reach max speed (Lower = more sensitive)
export const SPEED_DECAY_FACTOR = 0.5; // How much speed is lost as you grow
export const GROWTH_FACTOR = 0.8; // Radius growth multiplier per food area
export const PLAYER_TURN_SPEED = 0.25;

// Colors
export const COLOR_PLAYER_CORE = '#22d3ee'; // Cyan 400
export const COLOR_PLAYER_BORDER = '#0891b2'; // Cyan 600
export const COLOR_BOT_BORDER_DARKEN = 0.8; // Multiplier
export const COLOR_GRID = 'rgba(255, 255, 255, 0.1)';
export const COLOR_PARTICLE = '#facc15';

// Random colors for food & bots
export const FOOD_COLORS = [
  '#f87171', // Red
  '#fbbf24', // Amber
  '#a3e635', // Lime
  '#34d399', // Emerald
  '#818cf8', // Indigo
  '#e879f9', // Fuchsia
  '#ec4899', // Pink
  '#6366f1', // Indigo
];