// Save this as server.js
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });
console.log(`🟢 WebSocket server running on port ${process.env.PORT || 8080}`);

const rooms = {};

const roleMap = {
  3: ["Raja", "Rani", "Mantiri"],
  4: ["Raja", "Rani", "Mantiri", "Thirudan"],
  5: ["Raja", "Rani", "Mantiri", "Police", "Thirudan"],
  6: ["Raja", "Rani", "Mantiri", "Police", "Sippai", "Thirudan"],
  7: ["Raja", "Rani", "Mantiri", "Police", "Sippai", "Sevagan", "Thirudan"],
  8: ["Raja", "Rani", "Mantiri", "Police", "Sippai", "Sevagan", "Nai", "Thirudan"]
};

const rolePoints = {
  Raja: 5000,
  Rani: 3000,
  Mantiri: 1500,
  Police: 1000,
  Sippai: 500,
  Sevagan: 300,
  Nai: 100,
  Thirudan: 0
};

function shuffle(arr) {
  const newArr = [...arr];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

function broadcast(roomCode, message) {
  const room = rooms[roomCode];
  if (!room) return;
  room.players.forEach(p => {
    if (p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(JSON.stringify(message));
    }
  });
}

wss.on('connection', (ws) => {
  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);

      if (data.type === 'create_room') {
        const roomCode = uuidv4().slice(0, 6).toUpperCase();
        rooms[roomCode] = {
          admin: data.name,
          players: [{ name: data.name, ws, role: null, id: data.id, score: 0 }],
          stage: 'waiting',
          currentTurn: 0,
          chainIndex: 0,
          chainLog: [],
          chatLog: [],
          round: 1,
          roundRecords: [],
          maxRounds: 99,
          inactiveIds: [],
          guessedHistory: [],
          lastSwapMatrix: {}
        };
        ws.send(JSON.stringify({ type: 'room_created', roomCode }));
      }

      if (data.type === 'join_room') {
        const room = rooms[data.roomCode];
        if (room) {
          room.players.push({ name: data.name, ws, role: null, id: data.id, score: 0 });
          broadcast(data.roomCode, {
            type: 'player_joined',
            players: room.players.map(p => p.name)
          });
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
        }
      }

      if (data.type === 'start_game') {
        const room = rooms[data.roomCode];
        const players = room.players;
        if (players.length < 3 || players.length > 8) {
          ws.send(JSON.stringify({ type: 'error', message: 'Players must be between 3 and 8' }));
          return;
        }

        const roles = shuffle(roleMap[players.length]);
        players.forEach((p, i) => p.role = roles[i]);

        room.stage = 'playing';
        room.chainIndex = 0;
        room.inactiveIds = [];
        room.guessedHistory = [];
        room.lastSwapMatrix = {};
        room.currentTurn = players.findIndex(p => p.role === "Raja");

        players.forEach(p => {
          p.ws.send(JSON.stringify({
            type: 'your_role',
            role: p.role,
            name: p.name,
            round: room.round
          }));
        });

        broadcast(data.roomCode, {
          type: 'start_chain',
          nextRole: roleMap[players.length][1],
          turnPlayer: players[room.currentTurn].name,
          round: room.round,
          scoreboard: players.map(p => ({ name: p.name, score: p.score }))
        });
      }

      if (data.type === 'guess') {
        const room = rooms[data.roomCode];
        const players = room.players;
        const guesser = players.find(p => p.id === data.id);
        const guessed = players.find(p => p.name === data.guess);
        const currentRole = roleMap[players.length][room.chainIndex + 1];

        if (!guesser || !guessed) return;

        // Prevent back-to-back swaps
        const key = `${guesser.name}->${guessed.name}`;
        const reverseKey = `${guessed.name}->${guesser.name}`;
        if (room.lastSwapMatrix[reverseKey]) {
          guesser.ws.send(JSON.stringify({ type: 'error', message: 'Back-to-back swap not allowed' }));
          return;
        }

        let result = '';
        if (guessed.role === currentRole) {
          result = `${guesser.name} guessed correctly! ${guessed.name} is ${currentRole}`;
          guesser.score += rolePoints[currentRole];
          room.inactiveIds.push(guesser.id);
          room.chainIndex++;
          room.currentTurn = players.findIndex(p => p.name === guessed.name);
        } else {
          result = `${guesser.name} guessed wrong. ${guessed.name} is not ${currentRole}. Swapping roles.`;
          [guesser.role, guessed.role] = [guessed.role, guesser.role];
          room.currentTurn = players.findIndex(p => p.name === guessed.name);
          room.lastSwapMatrix[key] = true;
        }

        room.guessedHistory.push(guessed.name);
        room.chainLog.push(result);

        // If guessed is Thirudan, end game
        if (guessed.role === 'Thirudan' || currentRole === 'Thirudan') {
          players.forEach(p => {
            const bonus = rolePoints[p.role] || 0;
            p.score += bonus;
          });

          const roundTable = players.map(p => ({
            name: p.name,
            role: p.role,
            score: p.score
          }));

          broadcast(data.roomCode, {
            type: 'game_over',
            log: room.chainLog,
            scoreboard: players.map(p => ({ name: p.name, score: p.score })),
            round: room.round,
            canStartNext: room.round < room.maxRounds,
            roundTable
          });

          return;
        }

        broadcast(data.roomCode, {
          type: 'chain_update',
          log: room.chainLog,
          nextRole: roleMap[players.length][room.chainIndex + 1],
          turnPlayer: players[room.currentTurn].name,
          scoreboard: players.map(p => ({ name: p.name, score: p.score }))
        });
      }

      if (data.type === 'start_next_round') {
        const room = rooms[data.roomCode];
        if (room.round >= room.maxRounds) return;

        room.round++;
        const players = room.players;
        const roles = shuffle(roleMap[players.length]);

        players.forEach((p, i) => p.role = roles[i]);
        room.chainIndex = 0;
        room.inactiveIds = [];
        room.guessedHistory = [];
        room.lastSwapMatrix = {};
        room.chainLog = [];
        room.currentTurn = players.findIndex(p => p.role === "Raja");

        players.forEach(p => {
          p.ws.send(JSON.stringify({
            type: 'your_role',
            role: p.role,
            name: p.name,
            round: room.round
          }));
        });

        broadcast(data.roomCode, {
          type: 'start_chain',
          nextRole: roleMap[players.length][1],
          turnPlayer: players[room.currentTurn].name,
          round: room.round,
          scoreboard: players.map(p => ({ name: p.name, score: p.score }))
        });
      }

      if (data.type === 'chat') {
        const room = rooms[data.roomCode];
        const message = {
          type: 'chat',
          name: data.name,
          text: data.text,
          time: new Date().toISOString()
        };
        room.chatLog.push(message);
        broadcast(data.roomCode, message);
      }
    } catch (e) {
      console.error("❌ Invalid message:", msg);
    }
  });

  ws.on('close', () => {
    for (const code in rooms) {
      const room = rooms[code];
      room.players = room.players.filter(p => p.ws !== ws);
      if (room.players.length === 0) delete rooms[code];
    }
  });
});
          
