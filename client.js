// server.js — Raja Rani Multiplayer Game Backend (Full Final Version)
const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const wss = new WebSocket.Server({ port: 8080 });
console.log("✅ WebSocket Server running at ws://localhost:8080");

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
  if (!rooms[roomCode]) return;
  rooms[roomCode].players.forEach(p => {
    if (p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(JSON.stringify(message));
    }
  });
}

function getSortedScoreboard(players) {
  return players
    .map(p => ({
      name: p.name,
      total: p.totalScore || 0,
      rounds: p.rounds || []
    }))
    .sort((a, b) => b.total - a.total);
}

wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);

      // 🆕 Create Room
      if (data.type === "create_room") {
        const roomCode = uuidv4().slice(0, 6);
        rooms[roomCode] = {
          adminId: data.id,
          players: [{
            name: data.name,
            id: data.id,
            ws,
            role: null,
            totalScore: 0,
            rounds: []
          }],
          stage: "waiting",
          currentTurn: 0,
          chainIndex: 0,
          chainLog: [],
          round: 1,
          maxRounds: 20,
          recentSwap: {},
          lockedPlayers: new Set(),
          chatLog: []
        };
        ws.send(JSON.stringify({ type: "room_created", roomCode }));
      }

      // 🔗 Join Room
      if (data.type === "join_room") {
        const room = rooms[data.roomCode];
        if (!room) return ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
        room.players.push({
          name: data.name,
          id: data.id,
          ws,
          role: null,
          totalScore: 0,
          rounds: []
        });

        broadcast(data.roomCode, {
          type: "player_joined",
          players: room.players.map(p => ({
            name: p.name,
            isAdmin: p.id === room.adminId
          }))
        });
      }

      // ▶️ Start Game (Admin only)
      if (data.type === "start_game") {
        const room = rooms[data.roomCode];
        if (!room || room.adminId !== data.id) return;

        const players = room.players;
        const roles = shuffle([...roleMap[players.length]]);
        players.forEach((p, i) => {
          p.role = roles[i];
        });

        room.stage = "playing";
        room.chainIndex = 0;
        room.chainLog = [];
        room.recentSwap = {};
        room.lockedPlayers.clear();

        const rajaIndex = players.findIndex(p => p.role === "Raja");
        room.currentTurn = rajaIndex;

        players.forEach(p => {
          p.ws.send(JSON.stringify({
            type: "your_role",
            role: p.role,
            name: p.name,
            round: room.round
          }));
        });

        broadcast(data.roomCode, {
          type: "start_chain",
          turnPlayer: players[rajaIndex].name,
          nextRole: roleMap[players.length][1],
          scoreboard: getSortedScoreboard(players),
          round: room.round,
          locked: []
        });
      }

      // 🎯 Make a Guess
      if (data.type === "guess") {
        const room = rooms[data.roomCode];
        if (!room) return;
        const players = room.players;

        const guesser = players.find(p => p.id === data.id);
        const guessed = players.find(p => p.name === data.guess);
        const currentRole = roleMap[players.length][room.chainIndex + 1];

        if (!guessed || !guesser || room.lockedPlayers.has(guesser.name) || room.lockedPlayers.has(guessed.name)) return;
        if (room.recentSwap[guesser.name] === guessed.name) return;

        let logLine = "";
        if (guessed.role === currentRole) {
          // Correct
          logLine = `${guesser.name} ✅ guessed correctly: ${guessed.name} is ${currentRole}`;
          guesser.totalScore += rolePoints[currentRole];
          room.lockedPlayers.add(guesser.name);
          room.lockedPlayers.add(guessed.name);
          room.chainIndex++;
          room.currentTurn = players.findIndex(p => p.name === guessed.name);
        } else {
          // Wrong — only swap roles
          logLine = `${guesser.name} ❌ guessed wrong: ${guessed.name} is not ${currentRole}. Swapped roles.`;
          [guesser.role, guessed.role] = [guessed.role, guesser.role];
          room.recentSwap[guessed.name] = guesser.name;
          room.currentTurn = players.findIndex(p => p.name === guessed.name);
        }

        room.chainLog.push(logLine);

        // 🛑 Round end
        if (room.chainIndex >= roleMap[players.length].length - 1) {
          players.forEach(p => {
            const extra = rolePoints[p.role] || 0;
            p.totalScore += extra;
            p.rounds = p.rounds || [];
            p.rounds.push(extra);
          });

          broadcast(data.roomCode, {
            type: "game_over",
            log: room.chainLog,
            scoreboard: getSortedScoreboard(players),
            round: room.round,
            canStartNext: room.round < room.maxRounds
          });
        } else {
          broadcast(data.roomCode, {
            type: "chain_update",
            log: [...room.chainLog],
            nextRole: roleMap[players.length][room.chainIndex + 1],
            turnPlayer: players[room.currentTurn].name,
            scoreboard: getSortedScoreboard(players),
            locked: [...room.lockedPlayers]
          });
        }
      }

      // ⏭️ Start Next Round
      if (data.type === "start_next_round") {
        const room = rooms[data.roomCode];
        if (!room || room.adminId !== data.id || room.round >= room.maxRounds) return;

        room.round++;
        room.chainIndex = 0;
        room.stage = "waiting";
        room.chainLog = [];
        room.recentSwap = {};
        room.lockedPlayers.clear();

        const roles = shuffle([...roleMap[room.players.length]]);
        room.players.forEach((p, i) => {
          p.role = roles[i];
        });

        const rajaIndex = room.players.findIndex(p => p.role === "Raja");
        room.currentTurn = rajaIndex;
        room.stage = "playing";

        room.players.forEach(p => {
          p.ws.send(JSON.stringify({
            type: "your_role",
            role: p.role,
            name: p.name,
            round: room.round
          }));
        });

        broadcast(data.roomCode, {
          type: "start_chain",
          turnPlayer: room.players[rajaIndex].name,
          nextRole: roleMap[room.players.length][1],
          scoreboard: getSortedScoreboard(room.players),
          round: room.round,
          locked: []
        });
      }

      // 💬 Chat
      if (data.type === "chat") {
        const room = rooms[data.roomCode];
        if (!room) return;
        const chatMsg = {
          type: "chat",
          name: data.name,
          text: data.text,
          time: new Date().toLocaleTimeString()
        };
        room.chatLog.push(chatMsg);
        broadcast(data.roomCode, chatMsg);
      }
    } catch (err) {
      console.error("❌ Error:", err.message);
    }
  });

  ws.on("close", () => {
    for (const code in rooms) {
      const room = rooms[code];
      room.players = room.players.filter(p => p.ws !== ws);
      if (room.players.length === 0) delete rooms[code];
    }
  });
});
