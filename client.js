// Raja Rani Game - client.js
const socket = new WebSocket("wss://raja-rani-game-bw0r.onrender.com");


let playerName = '';
let playerId = crypto.randomUUID();
let roomCode = '';
let currentRound = 1;

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
    setTimeout(() => {
      document.getElementById('roleCard').classList.add('hidden');
    }, 4000);
  }

  if (data.type === 'start_chain') {
    currentRound = data.round;
    updateGameCard(data);
  }

  if (data.type === 'chain_update') {
    updateGameCard(data);
    appendLog(data.log[data.log.length - 1]);
  }

  if (data.type === 'game_over') {
    document.getElementById('gameCard').classList.add('hidden');
    document.getElementById('endCard').classList.remove('hidden');
    document.getElementById('finalRound').textContent = data.round;
    document.getElementById('finalLog').innerHTML = data.log.map(line => `<p>${line}</p>`).join('');
    updateScoreboard(data.scoreboard, 'finalScores');
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
  const names = Array.from(document.querySelectorAll('#playerList li')).map(li => li.textContent);
  names.forEach(name => {
    if (name !== playerName) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      guessInput.appendChild(opt);
    }
  });

  updateScoreboard(data.scoreboard, 'scoreboardBox');
  updateRoundTable(data.roundTable);
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

function updateScoreboard(scores, elementId) {
  const box = document.getElementById(elementId);
  box.innerHTML = `<strong>Scoreboard</strong><ul>` +
    scores.map(s => `<li>${s.name}: ${s.score}</li>`).join('') + `</ul>`;
}

function updateRoundTable(roundTable) {
  const box = document.getElementById('roundTableBox');
  if (!roundTable || roundTable.length === 0) return;

  const headers = Object.keys(roundTable[0]).filter(k => k !== 'round');
  const rows = roundTable.map(row => {
    return `<tr><td>${row.round}</td>` + headers.map(h => `<td>${row[h] || 0}</td>`).join('') + '</tr>';
  });

  box.innerHTML = `
    <strong>Round Scores</strong>
    <table>
      <thead>
        <tr><th>Round</th>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
      </thead>
      <tbody>${rows.join('')}</tbody>
    </table>`;
}

function flipCard() {
  document.getElementById('roleFlipCard').classList.toggle('flipped');
}
