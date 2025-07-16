   }
  });
});
          
// server.js — FINAL VERSION with role logic, swap prevention, scoring, cleanup

const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });
const rooms = new Map();

const ROLES = ['Raja', 'Rani', 'Mantiri', 'Police', 'Sippai', 'Sevagan', 'Nai', 'Thirudan'];
const ROLE_POINTS = {
  Raja: 5000,
  Rani: 3000,
  Mantiri: 1500,
  Police: 1000,
  Sippai: 500,
  Sevagan: 300,
  Nai: 100,
  Thirudan: 0
};

function assignRoles(players) {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const assigned = {};
  for (let i = 0; i < shuffled.length; i++) {
    assigned[shuffled[i].id] = ROLES[i];
  }
  return assigned;
}

wss.on('connection', (ws) => {
  ws.on('message', (msg) => {
    const data = JSON.parse(msg);
    const { type, roomCode, name, id, guess, text } = data;

    if (type === 'create_room') {
      const code = Math.random().toString(36).substr(2, 5).toUpperCase();
      rooms.set(code, {
        code,
        host: id,
        players: [{ id, name, ws, score: 0 }],
        roles: {},
        history: [],
        disabled: [],
        log: [],
        round: 1,
        scoreboard: [],
      });
      ws.send(JSON.stringify({ type: 'room_created', roomCode: code }));
    }

    if (type === 'join_room') {
      const room = rooms.get(roomCode);
      if (room && !room.players.find(p => p.id === id)) {
        room.players.push({ id, name, ws, score: 0 });
        room.players.forEach(p => {
          p.ws.send(JSON.stringify({
            type: 'player_joined',
            players: room.players.map(p => p.name)
          }));
        });
      }
    }

    if (type === 'start_game') {
      const room = rooms.get(roomCode);
      if (!room) return;
      startRound(room);
    }

    if (type === 'start_next_round') {
      const room = rooms.get(roomCode);
      if (!room) return;
      room.round += 1;
      room.disabled = [];
      room.history = [];
      room.log = [];
      startRound(room);
    }

    if (type === 'guess') {
      const room = rooms.get(roomCode);
      const guesser = room.players.find(p => p.id === id);
      const target = room.players.find(p => p.name === guess);
      const guesserRole = room.roles[guesser.id];
      const targetRole = room.roles[target.id];

      // Track disable swap history
      room.history.push({ from: guesser.id, to: target.id });
      room.disabled.push(target.name); // Hide target from future guesses

      let result = '';
      if (
        (guesserRole === 'Raja' && targetRole === 'Rani') ||
        (guesserRole === 'Rani' && targetRole === 'Mantiri') ||
        (guesserRole === 'Mantiri' && targetRole === 'Police') ||
        (guesserRole === 'Police' && targetRole === 'Sippai') ||
        (guesserRole === 'Sippai' && targetRole === 'Sevagan') ||
        (guesserRole === 'Sevagan' && targetRole === 'Nai') ||
        (guesserRole === 'Nai' && targetRole === 'Thirudan')
      ) {
        const points = ROLE_POINTS[guesserRole];
        guesser.score += points;
        room.log.push(`${guesser.name} guessed ${target.name} correctly! (+${points})`);
        room.disabled.push(guesser.name); // Remove guesser from future guesses

        // If Thirudan guessed, end game
        if (targetRole === 'Thirudan') {
          broadcast(room, {
            type: 'game_over',
            round: room.round,
            log: room.log,
            roundScore: room.players.map(p => ({ name: p.name, score: p.score })),
            allScores: room.players.map(p => ({ name: p.name, score: p.score })),
            canStartNext: true
          });
          return;
        }

        // Pass turn to next eligible player
        nextTurn(room, guesser.name);
      } else {
        // Swap roles
        const temp = room.roles[guesser.id];
        room.roles[guesser.id] = room.roles[target.id];
        room.roles[target.id] = temp;

        room.log.push(`${guesser.name} guessed ${target.name} wrongly. Swapped roles.`);
        room.disabled.push(guesser.name); // Prevent immediate re-guess
        nextTurn(room, target.name);
      }

      broadcast(room, {
        type: 'chain_update',
        turnPlayer: room.turnPlayer,
        nextRole: 'Rani',
        log: room.log,
        scoreboard: room.players.map(p => ({ name: p.name, score: p.score })),
        disabledPlayers: room.disabled
      });
    }

    if (type === 'chat') {
      const room = rooms.get(roomCode);
      room.players.forEach(p => {
        p.ws.send(JSON.stringify({ type: 'chat', name, text, time: Date.now() }));
      });
    }
  });

  ws.on('close', () => {
    rooms.forEach((room, code) => {
      room.players = room.players.filter(p => p.ws !== ws);
      if (room.players.length === 0) {
        rooms.delete(code);
      }
    });
  });
});

function broadcast(room, message) {
  room.players.forEach(p => {
    p.ws.send(JSON.stringify(message));
  });
}

function startRound(room) {
  room.roles = assignRoles(room.players);
  room.turnPlayer = room.players.find(p => room.roles[p.id] === 'Raja').name;
  room.disabled = [];
  room.history = [];
  room.log = [];

  // Send role secretly
  room.players.forEach(p => {
    p.ws.send(JSON.stringify({
      type: 'your_role',
      name: p.name,
      role: room.roles[p.id],
      round: room.round
    }));
  });

  // Short delay before chain starts
  setTimeout(() => {
    broadcast(room, {
      type: 'start_chain',
      round: room.round,
      turnPlayer: room.turnPlayer,
      nextRole: 'Rani',
      scoreboard: room.players.map(p => ({ name: p.name, score: p.score }))
    });
  }, 3000);
}

function nextTurn(room, newPlayerName) {
  room.turnPlayer = newPlayerName;
          }
                                           
