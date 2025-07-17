// client.js — Fully Updated Raja Rani Client Logic with Flip Card View and Lock Enforcement

const socket = new WebSocket("wss://raja-rani-game-bw0r.onrender.com"); // Change if hosting elsewhere
let playerName = "";
let playerId = crypto.randomUUID();
let roomCode = "";
let isAdmin = false;
let currentRole = "";
let lockedPlayers = new Set();

// DOM Elements
const setupCard = document.getElementById("setupCard");
const waitingCard = document.getElementById("waitingCard");
const roleCard = document.getElementById("roleCard");
const gameCard = document.getElementById("gameCard");
const endCard = document.getElementById("endCard");

const playerList = document.getElementById("playerList");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const nameDisplay = document.getElementById("nameDisplay");
const roundNum1 = document.getElementById("roundNum1");
const roundNum2 = document.getElementById("roundNum2");
const finalRound = document.getElementById("finalRound");
const turnPlayer = document.getElementById("turnPlayer");
const guessRole = document.getElementById("guessRole");
const guessInput = document.getElementById("guessInput");
const logBox = document.getElementById("logBox");
const finalLog = document.getElementById("finalLog");
const finalScores = document.getElementById("finalScores");
const scoreboardBox = document.getElementById("scoreboardBox");
const yourRole = document.getElementById("yourRole");
const roleFlipCard = document.getElementById("roleFlipCard");

function createRoom() {
  playerName = document.getElementById("playerName").value.trim();
  if (!playerName) return;
  isAdmin = true;
  socket.send(JSON.stringify({ type: "create_room", name: playerName, id: playerId }));
}

function joinRoom() {
  playerName = document.getElementById("playerName").value.trim();
  const code = document.getElementById("joinCode").value.trim();
  if (!playerName || !code) return;
  socket.send(JSON.stringify({ type: "join_room", name: playerName, roomCode: code, id: playerId }));
}

function startGame() {
  if (!isAdmin) return;
  socket.send(JSON.stringify({ type: "start_game", roomCode, id: playerId }));
}

function makeGuess() {
  const guess = guessInput.value;
  if (!guess) return;
  socket.send(JSON.stringify({ type: "guess", roomCode, id: playerId, guess }));
}

function startNextRound() {
  if (!isAdmin) return;
  socket.send(JSON.stringify({ type: "start_next_round", roomCode, id: playerId }));
}

function flipCard() {
  roleFlipCard.classList.toggle("flipped");
  setTimeout(() => roleFlipCard.classList.remove("flipped"), 3000);
}

socket.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === "room_created") {
    roomCode = msg.roomCode;
    setupCard.classList.add("hidden");
    waitingCard.classList.remove("hidden");
    roomCodeDisplay.textContent = roomCode;
    playerList.innerHTML = `<li>${playerName} (Admin)</li>`;
  }

  if (msg.type === "player_joined") {
    playerList.innerHTML = msg.players.map(p => `<li>${p}</li>`).join("");
  }

  if (msg.type === "your_role") {
    currentRole = msg.role;
    nameDisplay.textContent = msg.name;
    roundNum1.textContent = msg.round;
    yourRole.textContent = msg.role;
    waitingCard.classList.add("hidden");
    roleCard.classList.remove("hidden");
  }

  if (msg.type === "start_chain") {
    guessRole.textContent = msg.nextRole;
    roundNum2.textContent = msg.round;
    turnPlayer.textContent = msg.turnPlayer;
    roleCard.classList.add("hidden");
    gameCard.classList.remove("hidden");
    updateDropdown(msg.locked || []);
    updateScoreboard(msg.scoreboard);
  }

  if (msg.type === "chain_update") {
    guessRole.textContent = msg.nextRole;
    turnPlayer.textContent = msg.turnPlayer;
    logBox.innerHTML = msg.log.map(l => `<p>${l}</p>`).join("");
    updateDropdown(msg.locked || []);
    updateScoreboard(msg.scoreboard);
  }

  if (msg.type === "game_over") {
    gameCard.classList.add("hidden");
    endCard.classList.remove("hidden");
    finalRound.textContent = msg.round;
    finalLog.innerHTML = msg.log.map(l => `<p>${l}</p>`).join("");
    updateScoreboard(msg.scoreboard, true);
  }
};

function updateDropdown(locked) {
  guessInput.innerHTML = "";
  const options = playersStillInPlay(locked);
  options.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    guessInput.appendChild(opt);
  });
}

function updateScoreboard(scoreData, final = false) {
  const html = `<table><thead><tr><th>Player</th><th>Score</th></tr></thead><tbody>` +
    scoreData.map(s => `<tr><td>${s.name}</td><td>${s.score}</td></tr>`).join("") +
    `</tbody></table>`;
  if (final) finalScores.innerHTML = html;
  else scoreboardBox.innerHTML = html;
}

function playersStillInPlay(lockedList) {
  lockedPlayers = new Set(lockedList);
  return Array.from(document.querySelectorAll("#guessInput option")).map(opt => opt.value).filter(name => !lockedPlayers.has(name));
}
