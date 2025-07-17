// client.js - Raja Rani Game
const socket = new WebSocket("wss://raja-rani-game-bw0r.onrender.com");

let playerName = "";
let playerId = crypto.randomUUID();
let roomCode = "";
let isAdmin = false;
let currentRole = "";
let allPlayers = [];

function $(id) {
  return document.getElementById(id);
}

function createRoom() {
  playerName = $("playerName").value.trim();
  if (!playerName) return alert("Enter a name");
  isAdmin = true;
  socket.send(JSON.stringify({ type: "create_room", name: playerName, id: playerId }));
}

function joinRoom() {
  playerName = $("playerName").value.trim();
  const code = $("joinCode").value.trim();
  if (!playerName || !code) return alert("Enter name and code");
  roomCode = code;
  socket.send(JSON.stringify({ type: "join_room", name: playerName, roomCode, id: playerId }));
}

function startGame() {
  if (!isAdmin) return;
  socket.send(JSON.stringify({ type: "start_game", roomCode, id: playerId }));
}

function startNextRound() {
  socket.send(JSON.stringify({ type: "start_next_round", roomCode, id: playerId }));
}

function makeGuess() {
  const guess = $("guessInput").value;
  if (!guess) return alert("Choose a player");
  socket.send(JSON.stringify({ type: "guess", roomCode, id: playerId, guess }));
}

function flipCard() {
  const card = document.getElementById("roleFlipCardInner");
  card.classList.add("flipped");
  setTimeout(() => card.classList.remove("flipped"), 3000);
}

function hideRoleCard() {
  $("roleFlipCardInner").classList.remove("flipped");
}

function updateScoreboard(scoreboard) {
  const div = $("scoreboardBox");
  div.innerHTML = "<table><tr><th>Rank</th><th>Name</th><th>Score</th></tr>" +
    scoreboard.map((p, i) => `<tr><td>${i + 1}</td><td>${p.name}</td><td>${p.score}</td></tr>`).join("") +
    "</table>";
}

function updateDropdown(locked) {
  const select = $("guessInput");
  select.innerHTML = "<option value='' disabled selected>Select player</option>";
  allPlayers.forEach(p => {
    if (p !== playerName && !locked.includes(p)) {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      select.appendChild(opt);
    }
  });
}

socket.addEventListener("message", (e) => {
  const data = JSON.parse(e.data);

  if (data.type === "room_created") {
    roomCode = data.roomCode;
    $("setupCard").classList.add("hidden");
    $("waitingCard").classList.remove("hidden");
    $("roomCodeDisplay").textContent = roomCode;
  }

  if (data.type === "player_joined") {
    allPlayers = data.players;
    const list = $("playerList");
    list.innerHTML = "";
    data.players.forEach(name => {
      const li = document.createElement("li");
      li.textContent = name;
      if (isAdmin && name === playerName) li.innerHTML += " <strong>(Admin)</strong>";
      list.appendChild(li);
    });
    if (!$("setupCard").classList.contains("hidden")) {
      $("setupCard").classList.add("hidden");
      $("waitingCard").classList.remove("hidden");
    }
  }

  if (data.type === "your_role") {
    $("waitingCard").classList.add("hidden");
    $("roleCard").classList.remove("hidden");
    $("yourRole").textContent = data.role;
    $("nameDisplay").textContent = data.name;
    $("roundNum1").textContent = data.round;
    currentRole = data.role;
  }

  if (data.type === "start_chain") {
    $("roleCard").classList.add("hidden");
    $("gameCard").classList.remove("hidden");
    $("roundNum2").textContent = data.round;
    $("guessRole").textContent = data.nextRole;
    $("turnPlayer").textContent = data.turnPlayer;
    updateScoreboard(data.scoreboard);
  }

  if (data.type === "chain_update") {
    $("logBox").innerHTML = data.log.map(line => `<p>${line}</p>`).join("");
    $("guessRole").textContent = data.nextRole;
    $("turnPlayer").textContent = data.turnPlayer;
    updateScoreboard(data.scoreboard);
    updateDropdown(data.locked);
  }

  if (data.type === "game_over") {
    $("gameCard").classList.add("hidden");
    $("endCard").classList.remove("hidden");
    $("finalRound").textContent = data.round;
    $("finalLog").innerHTML = data.log.map(line => `<p>${line}</p>`).join("");
    const table = `<table><tr><th>Rank</th><th>Name</th><th>Score</th></tr>` +
      data.scoreboard.map((p, i) => `<tr><td>${i + 1}</td><td>${p.name}</td><td>${p.score}</td></tr>`).join("") +
      `</table>`;
    $("finalScores").innerHTML = table;
  }
});
