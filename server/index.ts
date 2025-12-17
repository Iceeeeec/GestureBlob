import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { Room } from './Room.js';
import { ClientMessage, ServerMessage } from './types.js';

const PORT = process.env.PORT || 3005;

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // 允许所有来源，生产环境建议改为具体域名
    methods: ['GET', 'POST']
  }
});

// 房间管理
const rooms: Map<string, Room> = new Map();
const playerRooms: Map<string, string> = new Map(); // playerId -> roomCode

// 生成4位房间码
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  // 确保唯一
  if (rooms.has(code)) {
    return generateRoomCode();
  }
  return code;
}

function sendError(socket: any, message: string): void {
  socket.emit('message', { type: 'error', message } as ServerMessage);
}

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('message', (msg: ClientMessage) => {
    switch (msg.type) {
      case 'create_room': {
        // 检查是否已在房间中
        if (playerRooms.has(socket.id)) {
          sendError(socket, '你已经在一个房间中');
          return;
        }

        const code = generateRoomCode();
        const room = new Room(io, code, msg.gameDuration);
        
        if (room.addPlayer(socket, msg.playerName)) {
          rooms.set(code, room);
          playerRooms.set(socket.id, code);

          socket.emit('message', {
            type: 'room_created',
            roomCode: code,
            playerId: socket.id
          } as ServerMessage);

          console.log(`Room ${code} created by ${msg.playerName}, duration: ${msg.gameDuration || 300}s`);
        } else {
          sendError(socket, '创建房间失败');
        }
        break;
      }

      case 'join_room': {
        // 检查是否已在房间中
        if (playerRooms.has(socket.id)) {
          sendError(socket, '你已经在一个房间中');
          return;
        }

        const room = rooms.get(msg.roomCode.toUpperCase());
        if (!room) {
          sendError(socket, '房间不存在');
          return;
        }

        if (room.status !== 'waiting') {
          sendError(socket, '游戏已开始，无法加入');
          return;
        }

        if (room.addPlayer(socket, msg.playerName)) {
          playerRooms.set(socket.id, msg.roomCode.toUpperCase());

          // 通知加入者
          socket.emit('message', {
            type: 'room_joined',
            roomCode: room.code,
            playerId: socket.id,
            players: Array.from(room.players.values())
          } as ServerMessage);

          // 通知房间其他人
          socket.to(room.code).emit('message', {
            type: 'player_joined',
            player: room.players.get(socket.id)!
          } as ServerMessage);

          console.log(`${msg.playerName} joined room ${room.code}`);
        } else {
          sendError(socket, '房间已满或游戏已开始');
        }
        break;
      }

      case 'rejoin_room': {
        // 玩家从结算界面返回房间，请求同步房间状态
        const existingRoomCode = playerRooms.get(socket.id);
        
        if (existingRoomCode && existingRoomCode === msg.roomCode.toUpperCase()) {
          // 玩家还在这个房间中，发送当前房间状态
          const room = rooms.get(existingRoomCode);
          if (room) {
            socket.emit('message', {
              type: 'room_joined',
              roomCode: room.code,
              playerId: socket.id,
              players: Array.from(room.players.values())
            } as ServerMessage);
            console.log(`Player ${socket.id} rejoined room ${room.code}`);
          }
        } else {
          sendError(socket, '房间不存在或你不在该房间中');
        }
        break;
      }

      case 'leave_room': {
        const roomCode = playerRooms.get(socket.id);
        if (!roomCode) return;

        const room = rooms.get(roomCode);
        if (room) {
          const isEmpty = room.removePlayer(socket.id);
          socket.leave(roomCode);
          
          if (isEmpty) {
            room.destroy();
            rooms.delete(roomCode);
            console.log(`Room ${roomCode} destroyed`);
          }
        }
        playerRooms.delete(socket.id);
        break;
      }

      case 'start_game': {
        const roomCode = playerRooms.get(socket.id);
        if (!roomCode) {
          sendError(socket, '你不在任何房间中');
          return;
        }

        const room = rooms.get(roomCode);
        if (!room) return;

        if (!room.startGame(socket.id)) {
          sendError(socket, '只有房主可以开始游戏');
        }
        break;
      }

      case 'input': {
        const roomCode = playerRooms.get(socket.id);
        if (!roomCode) return;

        const room = rooms.get(roomCode);
        if (room) {
          room.processInput(socket.id, msg.input);
        }
        break;
      }

      case 'respawn': {
        const roomCode = playerRooms.get(socket.id);
        if (!roomCode) return;

        const room = rooms.get(roomCode);
        if (room) {
          room.respawnPlayer(socket.id);
        }
        break;
      }

      case 'ping': {
        // 立即返回 pong，用于计算延迟
        console.log('[Ping] Received ping, sending pong, timestamp:', msg.timestamp);
        socket.emit('message', {
          type: 'pong',
          timestamp: msg.timestamp
        } as ServerMessage);
        break;
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    
    const roomCode = playerRooms.get(socket.id);
    if (roomCode) {
      const room = rooms.get(roomCode);
      if (room) {
        const isEmpty = room.removePlayer(socket.id);
        if (isEmpty) {
          room.destroy();
          rooms.delete(roomCode);
          console.log(`Room ${roomCode} destroyed`);
        }
      }
      playerRooms.delete(socket.id);
    }
  });
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: rooms.size });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 GestureBlob Server running on port ${PORT}`);
});
