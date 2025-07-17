// client.js — FINAL VERSION with flip card, strict guessing, and round scoreboard

const socket = new WebSocket("wss://raja-rani-game-bw0r.onrender.com");

let playerName = '';
let playerId = crypto.randomUUID();
let roomCode = '';
let currentRound = 1;
let disabledPlayers = [];
let roundScores = [];

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'room_created') {
    roomCode = data.roomCode;
    document.getElementById('setupCard').classList.add('hidden');
    document.getElementById('waitingCard').classList.remove('hidden');
    document.getElementById('roomCodeDisplay').textContent = roomCode;
    document.getElementById('playerList').innerHTML = `<li>${playerName}</li>`;
  }

  if (data.type === 'player_joined') {
    document.getElementById('playerList').innerHTML = data.players.map(name => `<li>${name}</li>`).join('');
  }

  if (data.type === 'your_role') {
    document.getElementById('waitingCard').classList.add('hidden');
    document.getElementById('roleCard').classList.remove('hidden');
    document.getElementById('nameDisplay').textContent = data.name;
    document.getElementById('yourRole').textContent = data.role;
    document.getElementById('roundNum1').textContent = data.round;
    document.getElementById('roleFlipCard').classList.remove('flipped');
    // Flip toggled only on click now
  }

  if (data.type === 'start_chain') {
    currentRound = data.round;
    disabledPlayers = []; // Reset for new round
    updateGameCard(data);
  }

  if (data.type === 'chain_update') {
    appendLog(data.log[data.log.length - 1]);
    disabledPlayers = data.disabledPlayers || [];
    updateGameCard(data);
  }

  if (data.type === 'game_over') {
    document.getElementById('gameCard').classList.add('hidden');
    document.getElementById('endCard').classList.remove('hidden');
    document.getElementById('finalRound').textContent = data.round;
    document.getElementById('finalLog').innerHTML = data.log.map(line => `<p>${line}</p>`).join('');
    roundScores.push(data.roundScore);
    renderScoreTable(data.allScores, roundScores);
    document.getElementById('nextRoundBtn').style.display = data.canStartNext ? 'block' : 'none';
  }

  if (data.type === 'chat') {
    const chatLog = document.getElementById('chatLog');
    const timestamp = new Date(data.time).toLocaleTimeString();
    chatLog.innerHTML += `<p><strong>${data.name}</strong> [${timestamp}]: ${data.text}</p>`;
    chatLog.scrollTop = chatLog.scrollHeight;
  }
};

function createRoom() {
  playerName = document.getElementById('playerName').value.trim();
  if (!playerName) return alert('Enter your name');
  socket.send(JSON.stringify({ type: 'create_room', name: playerName, id: playerId }));
}

function joinRoom() {
  playerName = document.getElementById('playerName').value.trim();
  roomCode = document.getElementById('joinCode').value.trim();
  if (!playerName || !roomCode) return alert('Enter name and code');
  socket.send(JSON.stringify({ type: 'join_room', name: playerName, roomCode, id: playerId }));
  document.getElementById('setupCard').classList.add('hidden');
  document.getElementById('waitingCard').classList.remove('hidden');
  document.getElementById('roomCodeDisplay').textContent = roomCode;
}

function startGame() {
  socket.send(JSON.stringify({ type: 'start_game', roomCode }));
}

function startNextRound() {
  socket.send(JSON.stringify({ type: 'start_next_round', roomCode }));
  document.getElementById('endCard').classList.add('hidden');
}

function updateGameCard(data) {
  document.getElementById('roleCard').classList.add('hidden');
  document.getElementById('gameCard').classList.remove('hidden');
  document.getElementById('guessRole').textContent = data.nextRole;
  document.getElementById('turnPlayer').textContent = data.turnPlayer;
  document.getElementById('roundNum2').textContent = data.round;

  const guessInput = document.getElementById('guessInput');
  guessInput.disabled = playerName !== data.turnPlayer;
  document.querySelector('button[onclick="makeGuess()"]').disabled = playerName !== data.turnPlayer;

  guessInput.innerHTML = '';
  const allNames = Array.from(document.querySelectorAll('#playerList li')).map(li => li.textContent);
  allNames.forEach(name => {
    if (name !== playerName && !disabledPlayers.includes(name)) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      guessInput.appendChild(opt);
    }
  });

  updateScoreList(data.scoreboard);
}

function makeGuess() {
  const guess = document.getElementById('guessInput').value;
  socket.send(JSON.stringify({ type: 'guess', roomCode, id: playerId, guess }));
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  socket.send(JSON.stringify({ type: 'chat', roomCode, name: playerName, text }));
  input.value = '';
}

function appendLog(text) {
  const logBox = document.getElementById('logBox');
  logBox.innerHTML += `<p>${text}</p>`;
  logBox.scrollTop = logBox.scrollHeight;
}

function updateScoreList(scores) {
  const box = document.getElementById('scoreboardBox');
  box.innerHTML = `<strong>Scoreboard</strong><ul>` +
    scores.map(s => `<li>${s.name}: ${s.score}</li>`).join('') + `</ul>`;
}

// Renders full scoreboard table (ranked) after each round
function renderScoreTable(allScores, rounds) {
  const box = document.getElementById('finalScores');
  const playerNames = allScores.map(p => p.name);

  // Initialize round-wise rows
  const table = [];
  playerNames.forEach(name => {
    const row = { name, rounds: [], total: 0 };
    rounds.forEach(r => {
      const player = r.find(p => p.name === name);
      const score = player ? player.score : 0;
      row.rounds.push(score);
      row.total += score;
    });
    table.push(row);
  });

  // Sort by total descending
  table.sort((a, b) => b.total - a.total);

  let html = `<table border="1" cellpadding="8" style="width:100%; text-align:center;">
    <thead><tr><th>Rank</th><th>Name</th>`;
  for (let i = 0; i < rounds.length; i++) {
    html += `<th>Round ${i + 1} Score</th>`;
  }
  html += `<th>Total</th></tr></thead><tbody>`;

  table.forEach((row, idx) => {
    html += `<tr><td>${idx + 1}</td><td>${row.name}</td>`;
    row.rounds.forEach(score => {
      html += `<td>${score}</td>`;
    });
    html += `<td>${row.total}</td></tr>`;
  });

  html += '</tbody></table>';
  box.innerHTML = html;
}

// Flip card logic (view/hide role)
function flipCard() {
  const card = document.getElementById('roleFlipCard');
  card.classList.add('flipped');

  setTimeout(() => {
    card.classList.remove('flipped');
  }, 3000);
}
