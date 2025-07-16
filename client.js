const socket = new WebSocket("wss://raja-rani-game-bw0r.onrender.com");

let playerName = "";
let playerId = uuidv4();
let roomCode = "";
let myRole = "";
let gameStage = "waiting";

// DOM elements
const joinSection = document.getElementById("joinSection");
const gameSection = document.getElementById("gameSection");
const playersList = document.getElementById("playersList");
const roleCard = document.getElementById("roleCard");
const myRoleName = document.getElementById("myRole");
const viewRoleBtn = document.getElementById("viewRole");
const chainLog = document.getElementById("chainLog");
const guessInput = document.getElementById("guessInput");
const submitGuess = document.getElementById("submitGuess");
const scoreboardDiv = document.getElementById("scoreboard");
const roundMatrixDiv = document.getElementById("roundMatrix");
const finalSection = document.getElementById("finalSection");
const roundTable = document.getElementById("roundTable");
const finalScoreboard = document.getElementById("finalScoreboard");
const turnPlayer = document.getElementById("turnPlayer");
const guessRole = document.getElementById("guessRole");
const roomCodeText = document.getElementById("roomCodeText");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendChat = document.getElementById("sendChat");

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

// Button events
document.getElementById("createRoom").onclick = () => {
  playerName = document.getElementById("playerName").value;
  socket.send(JSON.stringify({ type: "create_room", name: playerName, id: playerId }));
};

documentonclick = () => {
  playerName = document.getElementById("playerName").value;
  const code = document.getElementById("roomCode").value;
  roomCode = code;
  socket.send(JSON.stringify({ type: "join_room", roomCode: code, name: playerName, id: playerId }));
};

document.getElementById("startGame").onclick = () => {
  socket.send(JSON.stringify({ type: "start_game", roomCode }));
};

view(roleCard), 4000);
};

submitGuess.onclick = () => {
  const guess = guessInput.value;
  socket.send(JSON.stringify({ type: "guess", roomCode, id: playerId, guess }));
  guessInput.value = "";
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
  if (text) {
    socket.send(JSON.stringify({ type: "chat", roomCode, name: playerName, text }));
    chatInput.value = "";
  }
};

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "room_created") {
    roomCode = data.roomCode;
    roomCodeText.textContent = roomCode;
    hide(joinSection);
    show(gameSection);
  }

  if (data.type === "player_joined") {
    playersList.innerHTML = data.players.map((name) => `<li>${name}</li>`).join("");
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
    show(guessInput);
    updateScoreboard(data.scoreboard);
  }

  if (data.type === "chain_update") {
    turnPlayer.textContent = data.turnPlayer;
    guessRole.textContent = data.nextRole;
    updateScoreboard(data.scoreboard);
    chainLog.innerHTML = data.log.map((l) => `<p>${l}</p>`).join("");
  }

  if (data.type === "game_over") {
    hide(gameSection);
    show(finalSection);
    finalScoreboard.innerHTML = data.scoreboard.map((p) => `<p>${p.name}: ${p.score}</p>`).join("");
    renderRoundMatrix(data.roundTable);
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

function renderRoundMatrix(row) {
  let html = `<table><thead><tr><th>Round</th>`;
  Object.keys(row).forEach((key) => {
    if (key !== "round") html += `<th>${key}</th>`;
  });
  html += `</tr></thead><tbody><tr><td>${row.round}</td>`;
  Object.keys(row).forEach((key) => {
    if (key !== "round") html += `<td>${row[key]}</td>`;
  });
  html += `</tr></tbody></table>`;
  roundMatrixDiv.innerHTML = html;
}
