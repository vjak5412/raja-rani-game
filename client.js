// client.js — Fully Updated for Raja Rani Game with Enhanced Features
const socket = new WebSocket("wss://raja-rani-game-bw0r.onrender.com");
let playerName = "";
let playerId = crypto.randomUUID();
let roomCode = "";
let isAdmin = false;
let lockedPlayers = [];
let round = 1;
let roundScores = {}; // { roundNum: { playerName: score } }

function createRoom() {
  playerName = document.getElementById("playerName").value.trim();
  if (!playerName) return alert("Enter a name");
  socket.send(JSON.stringify({ type: "create_room", name: playerName, id: playerId }));
  isAdmin = true;
}

function joinRoom() {
  playerName = document.getElementById("playerName").value.trim();
  roomCode = document.getElementById("joinCode").value.trim();
  if (!playerName || !roomCode) return alert("Enter name and room code");
  socket.send(JSON.stringify({ type: "join_room", name: playerName, roomCode, id: playerId }));
}

function startGame() {
  socket.send(JSON.stringify({ type: "start_game", roomCode, id: playerId }));
}

function startNextRound() {
  socket.send(JSON.stringify({ type: "start_next_round", roomCode, id: playerId }));
}

function makeGuess() {
  const guess = document.getElementById("guessInput").value;
  if (!guess) return alert("Select a player to guess");
  socket.send(JSON.stringify({ type: "guess", roomCode, id: playerId, guess }));
}

function flipCard() {
  const card = document.getElementById("roleFlipCard");
  card.classList.add("flipped");
  setTimeout(() => card.classList.remove("flipped"), 3000);
}

function scrollToBottom(id) {
  const el = document.getElementById(id);
  el.scrollTop = el.scrollHeight;
}

function updateScoreboard(scoreboard) {
  const box = document.getElementById("scoreboardBox");
  let html = `<table><tr><th>Rank</th><th>Name</th>`;
  for (let i = 1; i <= round; i++) html += `<th>R${i}</th>`;
  html += `<th>Total</th></tr>`;

  let rank = 1;
  scoreboard.forEach(p => {
    if (!roundScores[p.name]) roundScores[p.name] = {};
    roundScores[p.name][round] = p.roundScore;
  });

  const totalMap = scoreboard.map(p => {
    const scores = roundScores[p.name];
    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    return { name: p.name, scores, total };
  }).sort((a, b) => b.total - a.total);

  totalMap.forEach(p => {
    html += `<tr><td>${rank++}</td><td>${p.name}</td>`;
    for (let i = 1; i <= round; i++) {
      html += `<td>${p.scores[i] || 0}</td>`;
    }
    html += `<td><b>${p.total}</b></td></tr>`;
  });
  html += `</table>`;
  box.innerHTML = html;
}

function updateDropdown(players) {
  const dropdown = document.getElementById("guessInput");
  dropdown.innerHTML = "";
  players.forEach(p => {
    if (p !== playerName && !lockedPlayers.includes(p)) {
      const opt = document.createElement("option");
      opt.value = opt.textContent = p;
      dropdown.appendChild(opt);
    }
  });
}

function showScreen(id) {
  ["setupCard", "waitingCard", "roleCard", "gameCard", "endCard"].forEach(el =>
    document.getElementById(el).classList.add("hidden")
  );
  document.getElementById(id).classList.remove("hidden");
}

socket.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === "room_created") {
    roomCode = msg.roomCode;
    showScreen("waitingCard");
    document.getElementById("roomCodeDisplay").textContent = roomCode;
  }

  if (msg.type === "player_joined") {
    const list = document.getElementById("playerList");
    list.innerHTML = "";
    msg.players.forEach(name => {
      const li = document.createElement("li");
      li.textContent = name;
      if (name === playerName) li.style.fontWeight = "bold";
      if (isAdmin && name === playerName) li.innerHTML += " 👑";
      list.appendChild(li);
    });
    if (!roomCode) {
      roomCode = msg.roomCode;
      showScreen("waitingCard");
      document.getElementById("roomCodeDisplay").textContent = roomCode;
    }
  }

  if (msg.type === "your_role") {
    round = msg.round;
    showScreen("roleCard");
    document.getElementById("nameDisplay").textContent = msg.name;
    document.getElementById("yourRole").textContent = msg.role;
    document.getElementById("roundNum1").textContent = msg.round;
  }

  if (msg.type === "start_chain") {
    showScreen("gameCard");
    document.getElementById("roundNum2").textContent = msg.round;
    document.getElementById("guessRole").textContent = msg.nextRole;
    document.getElementById("turnPlayer").textContent = msg.turnPlayer;
    updateScoreboard(msg.scoreboard);
    updateDropdown(msg.scoreboard.map(p => p.name));
    document.getElementById("logBox").innerHTML = "";
  }

  if (msg.type === "chain_update") {
    document.getElementById("guessRole").textContent = msg.nextRole;
    document.getElementById("turnPlayer").textContent = msg.turnPlayer;
    document.getElementById("logBox").innerHTML = msg.log.map(l => `<p>${l}</p>`).join("");
    scrollToBottom("logBox");
    updateScoreboard(msg.scoreboard);
    lockedPlayers = msg.locked || [];
    updateDropdown(msg.scoreboard.map(p => p.name));
  }

  if (msg.type === "game_over") {
    showScreen("endCard");
    document.getElementById("finalRound").textContent = msg.round;
    document.getElementById("finalLog").innerHTML = msg.log.map(l => `<p>${l}</p>`).join("");
    updateScoreboard(msg.scoreboard);
  }

  if (msg.type === "chat") {
    const chat = document.getElementById("chatBox");
    const p = document.createElement("p");
    p.innerHTML = `<strong>${msg.name}:</strong> ${msg.text}`;
    chat.appendChild(p);
    scrollToBottom("chatBox");
  }
});

// Chat sending (optional)
document.addEventListener("DOMContentLoaded", () => {
  const chatInput = document.getElementById("chatInput");
  const chatSend = document.getElementById("chatSend");
  if (chatInput && chatSend) {
    chatSend.onclick = () => {
      const text = chatInput.value.trim();
      if (text) {
        socket.send(JSON.stringify({ type: "chat", roomCode, name: playerName, text }));
        chatInput.value = "";
      }
    };
  }
});
