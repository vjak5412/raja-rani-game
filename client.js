const socket = new WebSocket("wss://raja-rani-game-bw0r.onrender.com");

let playerName = "";
let playerId = crypto.randomUUID();
let roomCode = "";
let isAdmin = false;
let currentGuessOptions = [];

const setupCard = document.getElementById("setupCard");
const waitingCard = document.getElementById("waitingCard");
const roleCard = document.getElementById("roleCard");
const gameCard = document.getElementById("gameCard");
const endCard = document.getElementById("endCard");

const nameDisplay = document.getElementById("nameDisplay");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const playerList = document.getElementById("playerList");
const yourRole = document.getElementById("yourRole");
const roundNum1 = document.getElementById("roundNum1");
const roundNum2 = document.getElementById("roundNum2");
const finalRound = document.getElementById("finalRound");
const turnPlayer = document.getElementById("turnPlayer");
const guessRole = document.getElementById("guessRole");
const guessInput = document.getElementById("guessInput");
const scoreboardBox = document.getElementById("scoreboardBox");
const logBox = document.getElementById("logBox");
const finalLog = document.getElementById("finalLog");
const finalScores = document.getElementById("finalScores");

const flipCard = document.getElementById("roleFlipCard");

function createRoom() {
  playerName = document.getElementById("playerName").value;
  socket.send(JSON.stringify({ type: "create_room", name: playerName, id: playerId }));
  isAdmin = true;
}

function joinRoom() {
  playerName = document.getElementById("playerName").value;
  const code = document.getElementById("joinCode").value;
  roomCode = code;
  socket.send(JSON.stringify({ type: "join_room", name: playerName, roomCode: code, id: playerId }));
}

function startGame() {
  if (!isAdmin) return;
  socket.send(JSON.stringify({ type: "start_game", roomCode, id: playerId }));
}

function startNextRound() {
  if (!isAdmin) return;
  socket.send(JSON.stringify({ type: "start_next_round", roomCode, id: playerId }));
}

function makeGuess() {
  const selected = guessInput.value;
  if (!selected) return;
  socket.send(JSON.stringify({ type: "guess", roomCode, id: playerId, guess: selected }));
  guessInput.disabled = true;
}

function renderScoreboard(scoreboard) {
  let html = `<table><tr><th>Rank</th><th>Name</th><th>Score</th></tr>`;
  scoreboard.forEach((p, i) => {
    html += `<tr><td>${i + 1}</td><td>${p.name}</td><td>${p.score}</td></tr>`;
  });
  html += `</table>`;
  scoreboardBox.innerHTML = html;
  finalScores.innerHTML = html;
}

function renderPlayerList(players) {
  playerList.innerHTML = "";
  players.forEach(p => {
    const li = document.createElement("li");
    li.textContent = p === playerName ? `${p} (You)` : p;
    if (isAdmin && p === playerName) li.innerHTML += ' <span style="color: green;">[Admin]</span>';
    playerList.appendChild(li);
  });
}

function showCard(card) {
  [setupCard, waitingCard, roleCard, gameCard, endCard].forEach(c => c.classList.add("hidden"));
  card.classList.remove("hidden");
}

function flipCardShow() {
  flipCard.classList.add("flipped");
  setTimeout(() => {
    flipCard.classList.remove("flipped");
  }, 3000);
}

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "room_created") {
    roomCode = data.roomCode;
    roomCodeDisplay.textContent = roomCode;
    showCard(waitingCard);
  }

  if (data.type === "player_joined") {
    renderPlayerList(data.players);
    showCard(waitingCard);
  }

  if (data.type === "your_role") {
    yourRole.textContent = data.role;
    nameDisplay.textContent = data.name;
    roundNum1.textContent = data.round;
    showCard(roleCard);
  }

  if (data.type === "start_chain") {
    roundNum2.textContent = data.round;
    turnPlayer.textContent = data.turnPlayer;
    guessRole.textContent = data.nextRole;
    renderScoreboard(data.scoreboard);
    guessInput.innerHTML = "";
    data.scoreboard.forEach(p => {
      if (p.name !== playerName && !data.locked?.includes(p.name)) {
        const option = document.createElement("option");
        option.value = p.name;
        option.textContent = p.name;
        guessInput.appendChild(option);
      }
    });
    guessInput.disabled = false;
    showCard(gameCard);
  }

  if (data.type === "chain_update") {
    logBox.innerHTML = data.log.map(l => `<p>${l}</p>`).join("");
    turnPlayer.textContent = data.turnPlayer;
    guessRole.textContent = data.nextRole;
    renderScoreboard(data.scoreboard);
    guessInput.innerHTML = "";
    data.scoreboard.forEach(p => {
      if (p.name !== playerName && !data.locked?.includes(p.name)) {
        const option = document.createElement("option");
        option.value = p.name;
        option.textContent = p.name;
        guessInput.appendChild(option);
      }
    });
    guessInput.disabled = false;
  }

  if (data.type === "game_over") {
    finalRound.textContent = data.round;
    finalLog.innerHTML = data.log.map(l => `<p>${l}</p>`).join("");
    renderScoreboard(data.scoreboard);
    showCard(endCard);
  }

  if (data.type === "error") {
    alert(data.message);
  }

  if (data.type === "chat") {
    // Chat can be implemented later here
  }
};

document.getElementById("roleFlipCard").addEventListener("mouseleave", () => {
  flipCard.classList.remove("flipped");
});
