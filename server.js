const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });
console.log(`✅ WebSocket server running on port ${PORT}`);

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

function sanitize(text) {
  return String(text).replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

function broadcast(roomCode, message) {
  if (!rooms[roomCode]) return;
  rooms[roomCode].players.forEach(p => {
    if (p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(JSON.stringify(message));
    }
  });
}

function buildScoreboard(players) {
  return players.map(p => ({ name: p.name, score: p.score }));
}

function buildRoundTable(players, round) {
  const table = { round };
  players.forEach(p => {
    table[p.name] = rolePoints[p.role] || 0;
  });
  return table;
}

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch (err) {
      return console.error("Invalid JSON:", msg);
    }

    const name = sanitize(data.name || "");
    const roomCode = data.roomCode;
    const playerId = data.id;

    if (!name || !playerId) return;

    if (data.type === "create_room") {
      const newCode = uuidv4().slice(0, 6).toUpperCase();
      rooms[newCode] = {
        players: [{
          name, id: playerId, ws,
          score: 0, role: "", guessed: false
        }],
        admin: playerId,
        round: 1,
        chainIndex: 0,
        turn: 0,
        log: [],
        swapMatrix: {},
        stage: "waiting",
        history: []
      };
      ws.send(JSON.stringify({ type: "room_created", roomCode: newCode }));
    }

    if (data.type === "join_room") {
      const room = rooms[roomCode];
      if (!room) return ws.send(JSON.stringify({ type: "error", message: "Room not found." }));
      if (room.players.find(p => p.name === name)) {
        return ws.send(JSON.stringify({ type: "error", message: "Duplicate name not allowed." }));
      }
      room.players.push({
        name, id: playerId, ws,
        score: 0, role: "", guessed: false
      });
      broadcast(roomCode, {
        type: "player_joined",
        players: room.players.map(p => p.name)
      });
    }

    if (data.type === "start_game") {
      const room = rooms[roomCode];
      if (!room || room.admin !== playerId) return;
      if (room.stage !== "waiting") return;
      const players = room.players;
      if (players.length < 3 || players.length > 8) {
        return ws.send(JSON.stringify({ type: "error", message: "Players must be between 3 and 8." }));
      }

      const roles = shuffle([...roleMap[players.length]]);
      players.forEach((p, i) => {
        p.role = roles[i];
        p.guessed = false;
        p.ws.send(JSON.stringify({
          type: "your_role",
          name: p.name,
          role: p.role,
          round: room.round
        }));
      });

      room.chainIndex = 0;
      room.turn = players.findIndex(p => p.role === "Raja");
      room.log = [];
      room.swapMatrix = {};
      room.stage = "playing";

      broadcast(roomCode, {
        type: "start_chain",
        nextRole: roleMap[players.length][1],
        turnPlayer: players[room.turn].name,
        round: room.round,
        scoreboard: buildScoreboard(players)
      });
    }

    if (data.type === "guess") {
      const room = rooms[roomCode];
      if (!room || room.stage !== "playing") return;
      const players = room.players;
      const guesser = players.find(p => p.id === playerId);
      const guessed = players.find(p => p.name === data.guess);
      const nextRole = roleMap[players.length][room.chainIndex + 1];

      if (!guesser || !guessed || guesser.guessed || guessed.guessed || guesser.name === guessed.name) return;

      const swapKey = `${guesser.name}-${guessed.name}`;
      const backSwapKey = `${guessed.name}-${guesser.name}`;
      if (room.swapMatrix[swapKey] || room.swapMatrix[backSwapKey]) return;

      let result = `${guesser.name} guessed ${guessed.name} as ${nextRole}`;
      if (guessed.role === nextRole) {
        result += " ✅";
        guesser.score += rolePoints[nextRole] || 0;
        guesser.guessed = true;
        room.chainIndex++;
        room.turn = players.findIndex(p => p.name === guessed.name);
      } else {
        result += " ❌";
        [guesser.role, guessed.role] = [guessed.role, guesser.role];
        room.swapMatrix[swapKey] = true;
        room.turn = players.findIndex(p => p.name === guessed.name);
      }

      room.log.push(result);

      const gameShouldEnd = guessed.role === "Thirudan" || room.chainIndex >= roleMap[players.length].length - 1;
      if (gameShouldEnd) {
        room.stage = "ended";
        room.history.push({ round: room.round, log: [...room.log] });

        broadcast(roomCode, {
          type: "game_over",
          log: room.log,
          scoreboard: buildScoreboard(players),
          round: room.round,
          roundTable: buildRoundTable(players, room.round)
        });
      } else {
        broadcast(roomCode, {
          type: "chain_update",
          log: room.log,
          nextRole: roleMap[players.length][room.chainIndex + 1],
          turnPlayer: players[room.turn].name,
          scoreboard: buildScoreboard(players)
        });
      }
    }

    if (data.type === "start_next_round") {
      const room = rooms[roomCode];
      if (!room) return;
      room.round++;
      room.chainIndex = 0;
      room.log = [];
      room.swapMatrix = {};
      room.stage = "playing";

      const players = room.players;
      const roles = shuffle([...roleMap[players.length]]);
      players.forEach((p, i) => {
        p.role = roles[i];
        p.guessed = false;
        p.ws.send(JSON.stringify({
          type: "your_role",
          name: p.name,
          role: p.role,
          round: room.round
        }));
      });

      room.turn = players.findIndex(p => p.role === "Raja");
      broadcast(roomCode, {
        type: "start_chain",
        nextRole: roleMap[players.length][1],
        turnPlayer: players[room.turn].name,
        round: room.round,
        scoreboard: buildScoreboard(players)
      });
    }

    if (data.type === "chat") {
      const room = rooms[roomCode];
      if (!room) return;
      const msg = {
        type: "chat",
        name,
        text: sanitize(data.text),
        time: new Date().toISOString()
      };
      broadcast(roomCode, msg);
    }
  });

  ws.on("close", () => {
    for (const code in rooms) {
      const room = rooms[code];
      room.players = room.players.filter(p => p.ws !== ws);
      if (room.players.length === 0) {
        delete rooms[code];
      } else {
        broadcast(code, {
          type: "player_joined",
          players: room.players.map(p => p.name)
        });
      }
    }
  });
});
