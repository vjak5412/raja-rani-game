// client.js — Updated with Full Fixes
const socket = new WebSocket("wss://raja-rani-game-bw0r.onrender.com");
let playerId = crypto.randomUUID();
let playerName = "";
let roomCode = "";
let isAdmin = false;

const setupCard = document.getElementById("setupCard");
const waitingCard = document.getElementById("waitingCard");
const roleCard = document.getElementById("roleCard");
const gameCard = document.getElementById("gameCard");
const endCard = document.getElementById("endCard");

const nameDisplay = document.getElementById("nameDisplay");
const roundNum1 = document.getElementById("roundNum1");
const roundNum2 = document.getElementById("roundNum2");
const turnPlayer = document.getElementById("turnPlayer");
const guessRole = document.getElementById("guessRole");
const guessInput = document.getElementById("guessInput");
const scoreboardBox = document.getElementById("scoreboardBox");
const logBox = document.getElementById("logBox");
const finalLog = document.getElementById("finalLog");
const finalScores = document.getElementById("finalScores");
const yourRole = document.getElementById("yourRole");
const roleFlipCard = document.getElementById("roleFlipCard");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const playerList = document.getElementById("playerList");

function createRoom() {
  playerName = document.getElementById("playerName").value;
  socket.send(JSON.stringify({ type: "create_room", name: playerName, id: playerId }));
  isAdmin = true;
}

function joinRoom() {
  playerName = document.getElementById("playerName").value;
  roomCode = document.getElementById("joinCode").value;
  socket.send(JSON.stringify({ type: "join_room", name: playerName, roomCode, id: playerId }));
  isAdmin = false;
}

function startGame() {
  socket.send(JSON.stringify({ type: "start_game", roomCode, id: playerId }));
}

function startNextRound() {
  socket.send(JSON.stringify({ type: "start_next_round", roomCode, id: playerId }));
}

function makeGuess() {
  const guess = guessInput.value;
  socket.send(JSON.stringify({ type: "guess", roomCode, id: playerId, guess }));
}

function flipCard() {
  roleFlipCard.classList.add("flipped");
  setTimeout(() => {
    roleFlipCard.classList.remove("flipped");
  }, 3000);
}

function populateScoreboard(scoreboard) {
  scoreboardBox.innerHTML = `<table><tr><th>Player</th><th>Score</th></tr>` +
    scoreboard.map(s => `<tr><td>${s.name}</td><td>${s.score}</td></tr>`).join("") + "</table>";
}

function populateDropdown(players, locked, recentSwap) {
  guessInput.innerHTML = "";
  players.forEach(name => {
    if (!locked.includes(name) && recentSwap !== name && name !== playerName) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      guessInput.appendChild(opt);
    }
  });
  guessInput.disabled = guessInput.children.length === 0;
}

function show(card) {
  [setupCard, waitingCard, roleCard, gameCard, endCard].forEach(c => c.classList.add("hidden"));
  card.classList.remove("hidden");
}

socket.onmessage = (msg) => {
  const data = JSON.parse(msg.data);

  if (data.type === "room_created") {
    roomCode = data.roomCode;
    roomCodeDisplay.textContent = roomCode;
    show(waitingCard);
  }

  if (data.type === "player_joined") {
    playerList.innerHTML = data.players.map(p => `<li>${p}</li>`).join("");
    roomCodeDisplay.textContent = roomCode;
    show(waitingCard);
  }

  if (data.type === "your_role") {
    nameDisplay.textContent = data.name;
    roundNum1.textContent = data.round;
    yourRole.textContent = data.role;
    show(roleCard);
  }

  if (data.type === "start_chain") {
    roundNum2.textContent = data.round;
    turnPlayer.textContent = data.turnPlayer;
    guessRole.textContent = data.nextRole;
    populateScoreboard(data.scoreboard);
    show(gameCard);
  }

  if (data.type === "chain_update") {
    turnPlayer.textContent = data.turnPlayer;
    guessRole.textContent = data.nextRole;
    logBox.innerHTML = data.log.map(line => `<div>${line}</div>`).join("");
    populateScoreboard(data.scoreboard);
    populateDropdown(data.scoreboard.map(s => s.name), data.locked, null);
  }

  if (data.type === "game_over") {
    finalLog.innerHTML = data.log.map(line => `<div>${line}</div>`).join("");
    finalScores.innerHTML = `<table><tr><th>Player</th><th>Score</th></tr>` +
      data.scoreboard.map(s => `<tr><td>${s.name}</td><td>${s.score}</td></tr>`).join("") + "</table>";
    document.getElementById("finalRound").textContent = data.round;
    show(endCard);
    if (!data.canStartNext || !isAdmin) {
      document.querySelector("#endCard button").disabled = true;
    } else {
      document.querySelector("#endCard button").disabled = false;
    }
  }
};
