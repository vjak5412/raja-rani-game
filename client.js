// client.js — Raja Rani Game (Fully Merged & Functional)
const socket = new WebSocket("wss://raja-rani-game-bw0r.onrender.com");
let playerName = "";
let playerId = crypto.randomUUID();
let roomCode = "";
let isAdmin = false;
let currentRole = "";
let scoreboardData = [];

const setupCard = document.getElementById("setupCard");
const waitingCard = document.getElementById("waitingCard");
const roleCard = document.getElementById("roleCard");
const gameCard = document.getElementById("gameCard");
const endCard = document.getElementById("endCard");

function showOnly(card) {
  [setupCard, waitingCard, roleCard, gameCard, endCard].forEach(c => c.classList.add("hidden"));
  card.classList.remove("hidden");
}

function createRoom() {
  playerName = document.getElementById("playerName").value.trim();
  if (!playerName) return alert("Enter your name");
  socket.send(JSON.stringify({ type: "create_room", name: playerName, id: playerId }));
}

function joinRoom() {
  playerName = document.getElementById("playerName").value.trim();
  roomCode = document.getElementById("joinCode").value.trim();
  if (!playerName || !roomCode) return alert("Enter your name and room code");
  socket.send(JSON.stringify({ type: "join_room", name: playerName, id: playerId, roomCode }));
}

function startGame() {
  socket.send(JSON.stringify({ type: "start_game", roomCode, id: playerId }));
}

function startNextRound() {
  socket.send(JSON.stringify({ type: "start_next_round", roomCode, id: playerId }));
}

function makeGuess() {
  const guess = document.getElementById("guessInput").value;
  if (!guess) return;
  socket.send(JSON.stringify({ type: "guess", guess, id: playerId, roomCode }));
}

function sendChat() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;
  socket.send(JSON.stringify({ type: "chat", text, name: playerName, roomCode }));
  input.value = "";
}

function flipCard() {
  const card = document.getElementById("roleFlipCard");
  card.classList.add("flipped");
  setTimeout(() => card.classList.remove("flipped"), 3000);
}

function updateScoreboard(data) {
  scoreboardData.push(data);
  const table = document.createElement("table");
  const headers = ["Rank", "Name", ...scoreboardData.map((_, i) => `Round ${i+1}`), "Total"];
  const tr = document.createElement("tr");
  headers.forEach(h => { const th = document.createElement("th"); th.innerText = h; tr.appendChild(th); });
  table.appendChild(tr);

  const totalScores = {};
  scoreboardData.forEach(round => {
    round.forEach(p => {
      totalScores[p.name] = (totalScores[p.name] || 0) + p.score;
    });
  });
  const ranked = Object.entries(totalScores).sort((a,b) => b[1] - a[1]);
  ranked.forEach(([name, total], i) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${i+1}</td><td>${name}</td>`;
    scoreboardData.forEach(round => {
      const r = round.find(p => p.name === name);
      row.innerHTML += `<td>${r ? r.score : '-'}</td>`;
    });
    row.innerHTML += `<td>${total}</td>`;
    table.appendChild(row);
  });

  const box = document.getElementById("scoreboardBox");
  box.innerHTML = "";
  box.appendChild(table);

  const final = document.getElementById("finalScores");
  if (final) {
    final.innerHTML = "";
    final.appendChild(table.cloneNode(true));
  }
}

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "room_created") {
    roomCode = data.roomCode;
    isAdmin = true;
    document.getElementById("roomCodeDisplay").innerText = roomCode;
    document.getElementById("startGameBtn").style.display = "block";
    showOnly(waitingCard);
  }

  if (data.type === "player_joined") {
    const list = document.getElementById("playerList");
    list.innerHTML = "";
    data.players.forEach((name, i) => {
      const li = document.createElement("li");
      li.innerText = name;
      if (i === 0) li.innerHTML += ' <span class="admin-badge">Admin</span>';
      list.appendChild(li);
    });
    document.getElementById("waitInfo").innerText = "You have joined the room.";
    showOnly(waitingCard);
  }

  if (data.type === "your_role") {
    currentRole = data.role;
    document.getElementById("yourRole").innerText = currentRole;
    document.getElementById("nameDisplay").innerText = data.name;
    document.getElementById("roundNum1").innerText = data.round;
    showOnly(roleCard);
  }

  if (data.type === "start_chain") {
    document.getElementById("guessInput").innerHTML = "";
    data.scoreboard && updateScoreboard(data.scoreboard);
    document.getElementById("roundNum2").innerText = data.round;
    document.getElementById("turnPlayer").innerText = data.turnPlayer;
    document.getElementById("guessRole").innerText = data.nextRole;
    showOnly(gameCard);
  }

  if (data.type === "chain_update") {
    const logBox = document.getElementById("logBox");
    logBox.innerHTML = data.log.map(l => `<p>${l}</p>`).join("");
    const select = document.getElementById("guessInput");
    select.innerHTML = "";
    data.scoreboard && updateScoreboard(data.scoreboard);
    const locked = data.locked || [];
    data.scoreboard[0].forEach(p => {
      if (p.name !== playerName && !locked.includes(p.name)) {
        const opt = document.createElement("option");
        opt.value = opt.innerText = p.name;
        select.appendChild(opt);
      }
    });
    document.getElementById("turnPlayer").innerText = data.turnPlayer;
    document.getElementById("guessRole").innerText = data.nextRole;
  }

  if (data.type === "game_over") {
    document.getElementById("finalRound").innerText = data.round;
    document.getElementById("finalLog").innerHTML = data.log.map(l => `<p>${l}</p>`).join("");
    data.scoreboard && updateScoreboard(data.scoreboard);
    showOnly(endCard);
  }

  if (data.type === "chat") {
    const chat = document.getElementById("chatMessages");
    const line = document.createElement("div");
    const time = new Date(data.time).toLocaleTimeString();
    line.innerHTML = `<strong>${data.name}</strong> [${time}]: ${data.text}`;
    chat.appendChild(line);
    chat.scrollTop = chat.scrollHeight;
  }
};
