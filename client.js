// client.js — Updated with View Role, Dropdown Filtering, UI Fixes
const socket = new WebSocket("wss://raja-rani-game-bw0r.onrender.com");
let playerName = "";
let playerId = crypto.randomUUID();
let roomCode = "";
let lockedPlayers = [];
let recentSwap = {};

// Setup
function createRoom() {
  playerName = document.getElementById("playerName").value.trim();
  if (!playerName) return alert("Enter your name");
  socket.send(JSON.stringify({ type: "create_room", name: playerName, id: playerId }));
}

function joinRoom() {
  playerName = document.getElementById("playerName").value.trim();
  roomCode = document.getElementById("joinCode").value.trim();
  if (!playerName || !roomCode) return alert("Fill all fields");
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
  if (!guess) return alert("Choose a player to guess");
  socket.send(JSON.stringify({ type: "guess", roomCode, id: playerId, guess }));
}

function sendChat() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;
  socket.send(JSON.stringify({ type: "chat", roomCode, name: playerName, text }));
  input.value = "";
}

document.getElementById("chatInput")?.addEventListener("keypress", e => {
  if (e.key === "Enter") sendChat();
});

document.getElementById("flipCard")?.addEventListener("click", flipCard);

function flipCard() {
  const flipCard = document.getElementById("roleFlipCard");
  flipCard.classList.add("flipped");
  setTimeout(() => flipCard.classList.remove("flipped"), 3000);
}

socket.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === "room_created") {
    roomCode = msg.roomCode;
    document.getElementById("setupCard").classList.add("hidden");
    document.getElementById("waitingCard").classList.remove("hidden");
    document.getElementById("roomCodeDisplay").innerText = roomCode;
  }

  if (msg.type === "player_joined") {
    document.getElementById("setupCard").classList.add("hidden");
    document.getElementById("waitingCard").classList.remove("hidden");
    const list = document.getElementById("playerList");
    list.innerHTML = "";
    msg.players.forEach(p => {
      const li = document.createElement("li");
      li.innerText = p;
      list.appendChild(li);
    });
  }

  if (msg.type === "your_role") {
    document.getElementById("waitingCard").classList.add("hidden");
    document.getElementById("roleCard").classList.remove("hidden");
    document.getElementById("yourRole").innerText = msg.role;
    document.getElementById("nameDisplay").innerText = msg.name;
    document.getElementById("roundNum1").innerText = msg.round;
  }

  if (msg.type === "start_chain" || msg.type === "chain_update") {
    document.getElementById("roleCard").classList.add("hidden");
    document.getElementById("gameCard").classList.remove("hidden");
    document.getElementById("roundNum2").innerText = msg.round;
    document.getElementById("turnPlayer").innerText = msg.turnPlayer;
    document.getElementById("guessRole").innerText = msg.nextRole;
    lockedPlayers = msg.locked || [];
    updateGuessDropdown(msg.turnPlayer);
    updateLog(msg.log);
    updateScoreboard(msg.scoreboard);
  }

  if (msg.type === "game_over") {
    document.getElementById("gameCard").classList.add("hidden");
    document.getElementById("endCard").classList.remove("hidden");
    document.getElementById("finalRound").innerText = msg.round;
    updateLog(msg.log, "finalLog");
    updateScoreboard(msg.scoreboard, "finalScores");
  }
});

function updateGuessDropdown(currentTurn) {
  const select = document.getElementById("guessInput");
  select.innerHTML = "";
  const options = [...document.querySelectorAll("#playerList li")]
    .map(li => li.innerText)
    .filter(name => name !== playerName && !lockedPlayers.includes(name) && name !== currentTurn);

  options.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.innerText = name;
    select.appendChild(opt);
  });
}

function updateLog(logArray, boxId = "logBox") {
  const box = document.getElementById(boxId);
  box.innerHTML = logArray.map(line => `<div>${line}</div>`).join("");
}

function updateScoreboard(scoreboard, boxId = "scoreboardBox") {
  const box = document.getElementById(boxId);
  box.innerHTML = `<table><tr><th>Player</th><th>Score</th></tr>
    ${scoreboard.map(row => `<tr><td>${row.name}</td><td>${row.score}</td></tr>`).join("")}</table>`;
}
