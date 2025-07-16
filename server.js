// server.js — Render-Compatible Raja Rani Multiplayer Game WebSocket Server

const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");
const http = require("http");

const PORT = process.env.PORT || 8080;
const server = http.createServer();
const wss = new WebSocket.Server({ server });

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

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function broadcast(roomCode, message) {
  if (rooms[roomCode]) {
    rooms[roomCode].players.forEach((p) => {
      if (p.ws.readyState === WebSocket.OPEN) {
        p.ws.send(JSON.stringify(message));
      }
    });
  }
}

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);

      if (data.type === "create_room") {
        const roomCode = uuidv4().slice(0, 6).toUpperCase();
        rooms[roomCode] = {
          players: [{ name: data.name, ws, role: null, id: data.id, score: 0, prevTarget: null }],
          round: 1,
          scoreboard: {},
          chainIndex: 0,
          currentTurn: 0,
          chainLog: [],
          stage: "waiting",
          chatLog: []
        };
        ws.send(JSON.stringify({ type: "room_created", roomCode }));
      }

      if (data.type === "join_room") {
        const room = rooms[data.roomCode];
        if (!room) return ws.send(JSON.stringify({ type: "error", message: "Room not found." }));
        room.players.push({ name: data.name, ws, role: null, id: data.id, score: 0, prevTarget: null });
        broadcast(data.roomCode, {
          type: "player_joined",
          players: room.players.map((p) => p.name)
        });
      }

      if (data.type === "start_game") {
        const room = rooms[data.roomCode];
        if (!room) return;
        const players = room.players;
        if (players.length < 3 || players.length > 8) {
          return ws.send(JSON.stringify({ type: "error", message: "Players must be between 3 and 8." }));
        }

        const roles = shuffle([...roleMap[players.length]]);
        players.forEach((p, i) => {
          p.role = roles[i];
          p.prevTarget = null;
          p.ws.send(JSON.stringify({
            type: "your_role",
            name: p.name,
            role: p.role,
            round: room.round
          }));
        });

        room.stage = "playing";
        room.chainIndex = 0;
        room.currentTurn = players.findIndex((p) => p.role === "Raja");
        room.chainLog = [];

        broadcast(data.roomCode, {
          type: "start_chain",
          nextRole: roleMap[players.length][1],
          turnPlayer: players[room.currentTurn].name,
          round: room.round,
          scoreboard: players.map((p) => ({ name: p.name, score: p.score }))
        });
      }

      if (data.type === "guess") {
        const room = rooms[data.roomCode];
        const players = room.players;
        const guesser = players.find((p) => p.id === data.id);
        const guessed = players.find((p) => p.name === data.guess);
        const nextRole = roleMap[players.length][room.chainIndex + 1];

        if (!guessed || guesser.prevTarget === guessed.name) {
          return;
        }

        let result = "";

        if (guessed.role === nextRole) {
          result = `${guesser.name} correctly guessed ${guessed.name} as ${nextRole}`;
          guesser.score += rolePoints[nextRole] || 0;
          room.chainIndex++;
          room.currentTurn = players.findIndex((p) => p.name === guessed.name);
        } else {
          result = `${guesser.name} guessed ${guessed.name} as ${nextRole} ❌`;
          [guesser.role, guessed.role] = [guessed.role, guesser.role];
          guesser.prevTarget = guessed.name;
          room.currentTurn = players.findIndex((p) => p.name === guessed.name);
        }

        room.chainLog.push(result);

        if (room.chainIndex >= roleMap[players.length].length - 1) {
          broadcast(data.roomCode, {
            type: "game_over",
            log: room.chainLog,
            scoreboard: players.map((p) => ({ name: p.name, score: p.score })),
            round: room.round,
            canStartNext: true,
            roundTable: buildRoundTable(players, room.round)
          });
        } else {
          broadcast(data.roomCode, {
            type: "chain_update",
            log: room.chainLog,
            nextRole: roleMap[players.length][room.chainIndex + 1],
            turnPlayer: players[room.currentTurn].name,
            scoreboard: players.map((p) => ({ name: p.name, score: p.score }))
          });
        }
      }

      if (data.type === "start_next_round") {
        const room = rooms[data.roomCode];
        if (!room) return;
        room.round++;
        room.chainIndex = 0;
        room.chainLog = [];
        room.stage = "waiting";

        const players = room.players;
        const roles = shuffle([...roleMap[players.length]]);
        players.forEach((p, i) => {
          p.role = roles[i];
          p.prevTarget = null;
          p.ws.send(JSON.stringify({
            type: "your_role",
            name: p.name,
            role: p.role,
            round: room.round
          }));
        });

        room.stage = "playing";
        room.currentTurn = players.findIndex((p) => p.role === "Raja");
        broadcast(data.roomCode, {
          type: "start_chain",
          nextRole: roleMap[players.length][1],
          turnPlayer: players[room.currentTurn].name,
          round: room.round,
          scoreboard: players.map((p) => ({ name: p.name, score: p.score }))
        });
      }

      if (data.type === "chat") {
        const room = rooms[data.roomCode];
        if (!room) return;
        const msg = {
          type: "chat",
          name: data.name,
          text: data.text,
          time: new Date().toISOString()
        };
        room.chatLog.push(msg);
        broadcast(data.roomCode, msg);
      }
    } catch (err) {
      console.error("Invalid message:", msg);
    }
  });

  ws.on("close", () => {
    for (const code in rooms) {
      const room = rooms[code];
      room.players = room.players.filter((p) => p.ws !== ws);
      if (room.players.length === 0) delete rooms[code];
    }
  });
});

function buildRoundTable(players, round) {
  const obj = { round };
  players.forEach((p) => {
    obj[p.name] = rolePoints[p.role] || 0;
  });
  return obj;
}

server.listen(PORT, () => {
  console.log(`✅ Server is live on port ${PORT}`);
});
