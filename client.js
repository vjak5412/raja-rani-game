// client.js

const socket = new WebSocket("wss://raja-rani-game-bw0r.onrender.com");

let playerName = "";
let playerId = uuidv4();
let roomCode = "";
let myRole = "";
let isAdmin = false;
let roleViewTimer = null;
let chatCooldown = false;
let scoreData = [];

const joinSection = document.getElementById("joinSection");
const gameSection = document.getElementById("gameSection");
const playersList = document.getElementById("playersList");
const roleCard = document.getElementById("roleCard");
const myRoleName = document.getElementById("myRole");
const viewRoleBtn = document.getElementById("viewRole");
const roleCountdown = document.getElementById("roleCountdown");
const chainLog = document.getElementById("chainLog");
const guessInput = document.getElementById("guessInput");
const submitGuess = document.getElementById("submitGuess");
const scoreboardDiv = document.getElementById("scoreboard");
const finalSection = document.getElementById("finalSection");
const finalScoreboard = document.getElementById("finalScoreboard");
const turnPlayer = document.getElementById("turnPlayer");
const guessRole = document.getElementById("guessRole");
const roomCodeText = document.getElementById("roomCodeText");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendChat = document.getElementById("sendChat");
const loadingSpinner = document.getElementById("loadingSpinner");
const confettiCanvas = document.getElementById("confettiCanvas");
const downloadScores = document.getElementById("downloadScores");

function uuidv4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

function show(element) {
  element.classList.remove("hidden");
}
function hide(element) {
  element.classList.add("hidden");
}

function startLoading() {
  loadingSpinner.style.display = "block";
}
function stopLoading() {
  loadingSpinner.style.display = "none";
}

function triggerConfetti() {
  // Placeholder for confetti animation
  console.log("🎉 Confetti triggered!");
}

function sanitize(text) {
  return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

document.getElementById("createRoom").onclick = () => {
  playerName = document.getElementById("playerName").value.trim();
  if (!playerName) return alert("Enter your name");
  isAdmin = true;
  startLoading();
  socket.send(JSON.stringify({ type: "create_room", name: playerName, id: playerId }));
};

document.getElementById("joinRoom").onclick = () => {
  playerName = document.getElementById("playerName").value.trim();
  const code = document.getElementById("roomCode").value.trim();
  if (!playerName || !code) return alert("Enter name and room code");
  roomCode = code;
  startLoading();
  socket.send(JSON.stringify({ type: "join_room", roomCode: code, name: playerName, id: playerId }));
};

document.getElementById("startGame").onclick = () => {
  if (!isAdmin) return alert("Only admin can start the game");
  socket.send(JSON.stringify({ type: "start_game", roomCode, id: playerId }));
  document.getElementById("startGame").disabled = true;
};

viewRoleBtn.onclick = () => {
  show(roleCard);
  viewRoleBtn.disabled = true;
  let countdown = 4;
  roleCountdown.textContent = `Role visible for ${countdown} seconds`;
  roleViewTimer = setInterval(() => {
    countdown--;
    roleCountdown.textContent = `Role visible for ${countdown} seconds`;
    if (countdown <= 0) {
      clearInterval(roleViewTimer);
      hide(roleCard);
      viewRoleBtn.disabled = false;
      roleCountdown.textContent = "";
    }
  }, 1000);
};

submitGuess.onclick = () => {
  const guess = guessInput.value;
  if (!guess) return alert("Select a player to guess");
  socket.send(JSON.stringify({ type: "guess", roomCode, id: playerId, guess }));
  guessInput.value = "";
  submitGuess.disabled = true;
  setTimeout(() => submitGuess.disabled = false, 2000);
};

document.getElementById("continueGame").onclick = () => {
  socket.send(JSON.stringify({ type: "start_next_round", roomCode }));
  hide(finalSection);
  show(gameSection);
};

document.getElementById("exitGame").onclick = () => {
  alert("You chose to exit the game. Please refresh the page to join a new game.");
};

document.getElementById("restartGame").onclick = () => {
  socket.send(JSON.stringify({ type: "start_next_round", roomCode }));
  hide(finalSection);
  show(gameSection);
};

sendChat.onclick = () => {
  const text = chatInput.value.trim();
  if (text && !chatCooldown) {
    socket.send(JSON.stringify({ type: "chat", roomCode, name: playerName, text: sanitize(text) }));
    chatInput.value = "";
    chatCooldown = true;
    setTimeout(() => chatCooldown = false, 1000);
  }
};

downloadScores.onclick = () => {
  const blob = new Blob([scoreData.join("\n")], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `raja_rani_scores_${roomCode}.txt`;
  link.click();
};

socket.onopen = () => {
  stopLoading();
};

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "room_created") {
    roomCode = data.roomCode;
    roomCodeText.textContent = roomCode;
    hide(joinSection);
    show(gameSection);
    stopLoading();
  }

  if (data.type === "player_joined") {
    playersList.innerHTML = data.players.map((name, i) => {
      const badge = i === 0 ? '<span class="admin-badge">Admin</span>' : '';
      return `<li>${sanitize(name)} ${badge}</li>`;
    }).join("");
  }

  if (data.type === "your_role") {
    myRole = data.role;
    myRoleName.textContent = `${data.name}, you are ${data.role}`;
    show(roleCard);
    setTimeout(() => hide(roleCard), 4000);
  }

  if (data.type === "start_chain") {
    turnPlayer.textContent = data.turnPlayer;
    guessRole.textContent = data.nextRole;
    updateScoreboard(data.scoreboard);
    updateGuessDropdown(data.scoreboard);
  }

  if (data.type === "chain_update") {
    turnPlayer.textContent = data.turnPlayer;
    guessRole.textContent = data.nextRole;
    updateScoreboard(data.scoreboard);
    chainLog.innerHTML = data.log.map((l) => `<p>${sanitize(l)}</p>`).join("");
    updateGuessDropdown(data.scoreboard);
  }

  if (data.type === "game_over") {
    hide(gameSection);
    show(finalSection);
    scoreData = data.scoreboard.map((p) => `${p.name}: ${p.score}`);
    finalScoreboard.innerHTML = data.scoreboard.map((p, i) => {
      const highlight = i === 0 ? 'style="font-weight:bold;color:green;"' : '';
      return `<p ${highlight}>${p.name}: ${p.score}</p>`;
    }).join("");
    triggerConfetti();
  }

  if (data.type === "chat") {
    const msg = document.createElement("div");
    msg.textContent = `${data.name}: ${data.text}`;
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
};

function updateScoreboard(scores) {
  scoreboardDiv.innerHTML = "<h3>Live Scoreboard</h3>" +
    scores.map((s) => `<p>${s.name}: ${s.score}</p>`).join("");
}

function updateGuessDropdown(scores) {
  guessInput.innerHTML = scores
    .filter(p => p.name !== playerName && p.score !== null)
    .map(p => `<option value="${p.name}">${p.name}</option>`)
    .join("");
}
