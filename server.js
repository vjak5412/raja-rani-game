const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const wss = new WebSocket.Server({ port: 8080 });
console.log('🟢 WebSocket server running on port 8080');

const rooms = {};

const roleMap = {
  4: ["Raja", "Rani", "Mantiri", "Thirudan"],
  5: ["Raja", "Rani", "Mantiri", "Police", "Thirudan"],
  6: ["Raja", "Rani", "Mantiri", "Police", "Sippai", "Thirudan"],
  7: ["Raja", "Rani", "Mantiri", "Police", "Sippai", "Sevagan", "Thirudan"],
  8: ["Raja", "Rani", "Mantiri", "Police", "Sippai", "Sevagan", "Nai", "Thirudan"]
};

const roleScores = {
  Raja: 5000,
  Rani: 3000,
  Mantiri: 1500,
  Police: 1000,
  Sippai: 500,
  Sevagan: 300,
  Nai: 100,
  Thirudan: 0
};

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function broadcast(roomCode, message) {
  if (rooms[roomCode]) {
    rooms[roomCode].players.forEach(p => {
      if (p.ws.readyState === WebSocket.OPEN) {
        p.ws.send(JSON.stringify(message));
      }
    });
  }
}

wss.on('connection', (ws) => {
  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);

      if (data.type === 'create_room') {
        const roomCode = uuidv4().slice(0, 6);
        rooms[roomCode] = {
          admin: data.name,
          players: [{ name: data.name, ws, role: null, id: data.id, score: 0 }],
          stage: 'waiting',
          chainIndex: 0,
          chainLog: [],
          chatLog: [],
          round: 1,
          maxRounds: 5,
          roundTable: []
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
        if (players.length < 4 || players.length > 8) {
          ws.send(JSON.stringify({ type: 'error', message: 'Players must be between 4 and 8' }));
          return;
        }
        const roles = shuffle([...roleMap[players.length]]);
        players.forEach((p, i) => p.role = roles[i]);
        players.forEach(p => {
          p.ws.send(JSON.stringify({
            type: 'your_role',
            role: p.role,
            name: p.name,
            round: room.round
          }));
        });
        room.stage = 'playing';
        room.chainIndex = 0;
        room.currentTurn = players.findIndex(p => p.role === 'Raja');
        room.chainLog = [];
        room.roundTable.push({ round: room.round, scores: [] });
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
        const currentRoleIndex = room.chainIndex + 1;
        const currentRole = roleMap[players.length][currentRoleIndex];

        const guesser = players.find(p => p.id === data.id);
        const guessed = players.find(p => p.name === data.guess);
        const actual = players.find(p => p.role === currentRole);

        let result = '';
        if (guessed.role === currentRole) {
          result = `${guesser.name} guessed correctly: ${guessed.name} is ${currentRole}`;
          guesser.score += roleScores[currentRole];
          room.chainIndex++;
          room.currentTurn = players.findIndex(p => p.name === guessed.name);
        } else {
          result = `${guesser.name} guessed wrong! ${guessed.name} is not ${currentRole}. Swapping roles.`;
          [guessed.role, actual.role] = [actual.role, guessed.role];
          room.currentTurn = players.findIndex(p => p.name === guessed.name);
        }

        room.chainLog.push(result);

        if (room.chainIndex >= roleMap[players.length].length - 1) {
          room.roundTable[room.roundTable.length - 1].scores = players.map(p => ({ name: p.name, score: p.score }));
          broadcast(data.roomCode, {
            type: 'game_over',
            log: room.chainLog,
            scoreboard: players.map(p => ({ name: p.name, score: p.score })),
            round: room.round,
            table: room.roundTable,
            canStartNext: room.round < room.maxRounds
          });
        } else {
          broadcast(data.roomCode, {
            type: 'chain_update',
            log: room.chainLog,
            nextRole: roleMap[players.length][room.chainIndex + 1],
            turnPlayer: players[room.currentTurn].name,
            scoreboard: players.map(p => ({ name: p.name, score: p.score }))
          });
        }
      }

      if (data.type === 'start_next_round') {
        const room = rooms[data.roomCode];
        if (room.round >= room.maxRounds) return;
        room.round++;
        room.stage = 'waiting';
        room.chainIndex = 0;
        room.currentTurn = 0;
        room.chainLog = [];

        const roles = shuffle([...roleMap[room.players.length]]);
        room.players.forEach((p, i) => p.role = roles[i]);
        room.players.forEach(p => {
          p.ws.send(JSON.stringify({
            type: 'your_role',
            role: p.role,
            name: p.name,
            round: room.round
          }));
        });

        room.stage = 'playing';
        room.currentTurn = room.players.findIndex(p => p.role === 'Raja');
        room.roundTable.push({ round: room.round, scores: [] });

        broadcast(data.roomCode, {
          type: 'start_chain',
          nextRole: roleMap[room.players.length][1],
          turnPlayer: room.players[room.currentTurn].name,
          round: room.round,
          scoreboard: room.players.map(p => ({ name: p.name, score: p.score }))
        });
      }

      if (data.type === 'chat') {
        const room = rooms[data.roomCode];
        if (!room) return;
        const message = {
          type: 'chat',
          name: data.name,
          text: data.text,
          time: new Date().toISOString()
        };
        room.chatLog.push(message);
        broadcast(data.roomCode, message);
      }

    } catch (err) {
      console.error('Invalid message received:', msg);
    }
  });

  ws.on('close', () => {
    for (const code in rooms) {
      rooms[code].players = rooms[code].players.filter(p => p.ws !== ws);
      if (rooms[code].players.length === 0) delete rooms[code];
    }
  });
});
