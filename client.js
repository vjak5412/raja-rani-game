// client.js - Raja Rani Game Client Script (Updated with Fixes & Scoreboard UI)

const socket = new WebSocket("wss://raja-rani-game-bw0r.onrender.com");
let myId = Math.random().toString(36).substr(2, 9);
let myRole = null;
let roomCode = "";
let isAdmin = false;

// DOM Elements
const joinSection = document.getElementById("joinSection");
const gameSection = document.getElementById("gameSection");
const roleCard = document.getElementById("roleCard");
const roleText = document.getElementById("roleText");
const viewBtn = document.getElementById("viewRoleBtn");
const playersDiv = document.getElementById("playersList");
const guessArea = document.getElementById("guessSection");
const guessSelect = document.getElementById("guessSelect");
const scoreBoard = document.getElementById("scoreboardTable");
const chainLog = document.getElementById("chainLog");
const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendChat");
const continueBtn = document.getElementById("continueBtn");
const exitBtn = document.getElementById("exitBtn");
const startBtn = document.getElementById("startBtn");

// Join Room Logic
document.getElementById("createRoomBtn").onclick = () => {
  const name = document.getElementById("playerName").value;
  socket.send(JSON.stringify({ type: "create_room", name, id: myId }));
  isAdmin = true;
};

document.getElementById("joinRoomBtn").onclick = () => {
  const name = document.getElementById("playerName").value;
  const code = document.getElementById("roomCode").value.toUpperCase();
  socket.send(JSON.stringify({ type: "join_room", name, id: myId, roomCode: code }));
  roomCode = code;
};

// Start Game (Admin Only)
document.getElementById("startGameBtn").onclick = () => {
  if (isAdmin) socket.send(JSON.stringify({ type: "start_game", roomCode }));
};

// Make a Guess
document.getElementById("makeGuessBtn").onclick = () => {
  const guess = guessSelect.value;
  socket.send(JSON.stringify({ type: "guess", guess, id: myId, roomCode }));
};

// View My Role Button
viewBtn.onclick = () => {
  roleCard.style.display = "block";
  setTimeout(() => roleCard.style.display = "none", 3000);
};

// Continue / Exit / Start Buttons
continueBtn.onclick = () => {
  socket.send(JSON.stringify({ type: "start_next_round", roomCode }));
};

exitBtn.onclick = () => {
  location.reload();
};

startBtn.onclick = () => {
  if (isAdmin) socket.send(JSON.stringify({ type: "start_game", roomCode }));
};

// Chat Send
sendBtn.onclick = () => {
  const msg = chatInput.value;
  if (msg) {
    socket.send(JSON.stringify({ type: "chat", roomCode, name: myId, text: msg }));
    chatInput.value = "";
  }
};

// Socket Message Handling
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "room_created") {
    roomCode = data.roomCode;
    document.getElementById("roomCodeDisplay").textContent = roomCode;
    joinSection.style.display = "none";
    gameSection.style.display = "block";
  }

  if (data.type === "player_joined") {
    playersDiv.innerHTML = data.players.map(p => `<div>${p}</div>`).join("");
  }

  if (data.type === "your_role") {
    myRole = data.role;
    roleText.innerText = `You are the ${data.role}`;
    roleCard.style.display = "block";
    setTimeout(() => roleCard.style.display = "none", 4000);
  }

  if (data.type === "start_chain") {
    chainLog.innerHTML = "";
    guessArea.style.display = "block";
    guessSelect.innerHTML = "";
    data.scoreboard.forEach(player => {
      if (player.name !== myId) {
        const opt = document.createElement("option");
        opt.value = player.name;
        opt.text = player.name;
        guessSelect.appendChild(opt);
      }
    });
    updateScoreboard(data.scoreboard);
  }

  if (data.type === "chain_update") {
    const latest = data.log[data.log.length - 1];
    const li = document.createElement("li");
    li.textContent = latest;
    chainLog.appendChild(li);
    updateScoreboard(data.scoreboard);
  }

  if (data.type === "game_over") {
    const li = document.createElement("li");
    li.textContent = "Round over!";
    chainLog.appendChild(li);
    updateScoreboard(data.scoreboard);
    continueBtn.style.display = "inline-block";
    exitBtn.style.display = "inline-block";
    startBtn.style.display = "inline-block";
  }

  if (data.type === "chat") {
    const div = document.createElement("div");
    div.innerText = `${data.name}: ${data.text}`;
    chatBox.appendChild(div);
  }
};

function updateScoreboard(players) {
  scoreBoard.innerHTML = "";
  const header = document.createElement("tr");
  header.innerHTML = `<th>Player</th><th>Score</th>`;
  scoreBoard.appendChild(header);
  players.forEach(p => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${p.name}</td><td>${p.score}</td>`;
    scoreBoard.appendChild(row);
  });
}
