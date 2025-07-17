# 👑 Raja Rani Multiplayer Online Game

A fast-paced, role-based multiplayer game built using **Node.js**, **WebSockets**, and **vanilla JavaScript** — where players guess, swap roles, and climb the scoreboard.

---

## 🎮 Game Overview

- **Players**: 3 to 8 per game
- **Roles**: Raja, Rani, Mantiri, Police, Sippai, Sevagan, Nai, Thirudan (based on player count)
- **Objective**: Take turns guessing hidden roles. Points awarded on correct guesses. Roles swap on incorrect guesses.
- **End Condition**: Round ends when Thirudan is found or all major roles are guessed.

---

## 🚀 Features

- 🔒 Role-based guessing with **real-time swapping**
- 🔁 **Swap Logic**: Only between guesser & guessed player if wrong
- ⛔ **Back-to-back swap prevention**
- 👁️ **Flip-card UI** to view roles temporarily
- 🧠 **Correct guessers are locked** for the rest of the round
- 🧾 **Dynamic scoreboard**, auto-sorted by highest points
- 🔄 Rounds and continuation system with **admin-only controls**
- 💬 In-game **chat** between players
- 📈 Score history preserved through rounds

---

## 🖥️ Tech Stack

| Layer       | Technology     |
|-------------|----------------|
| Frontend    | HTML, CSS, JS  |
| Backend     | Node.js, WebSocket (`ws`) |
| Utilities   | `uuid` for IDs and room codes |
| Deployment  | GitHub Pages (Frontend), Render (Backend) |

---

## 📦 Installation (Local)

1. **Clone the repo**:
   ```bash
   git clone https://github.com/your-username/raja-rani-game.git
   cd raja-rani-game
