

# 🎮 GameServer (WebSocket-Based)

A simple WebSocket-powered multiplayer game server that supports real-time game logic, room creation, and game state management (e.g., Connect Four-style board game).

## 🚀 Features

* Create and join game rooms
* Real-time player moves and updates
* Auto-start game when two players join
* Winner detection logic for a Connect Four-style game
* Graceful handling of disconnection and cleanup
* Game reset and leave room support
* Unique room and player IDs via `uuid`
* Simple in-memory state (no database)

---

## 📦 Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/dearbornadeolu/gameserver.git
   cd gameserver
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

---

## ▶️ Running the Server

Start the WebSocket server on the default port `3003`:

```bash
node server.js
```

You can optionally customize the port:

```bash
PORT=4000 node server.js
```

---

## 📡 WebSocket Message Types

### Client → Server

| Type          | Payload Example                                                  |
| ------------- | ---------------------------------------------------------------- |
| `create_room` | `{ "type": "create_room", "username": "Alice" }`                 |
| `join_room`   | `{ "type": "join_room", "roomId": "ABC123", "username": "Bob" }` |
| `game_move`   | `{ "type": "game_move", "column": 3 }`                           |
| `game_reset`  | `{ "type": "game_reset" }`                                       |
| `leave_room`  | `{ "type": "leave_room" }`                                       |

### Server → Client

| Type            | Description                                           |
| --------------- | ----------------------------------------------------- |
| `room_created`  | Sent after room creation with `roomId` and `playerId` |
| `room_joined`   | Sent after successfully joining a room                |
| `player_joined` | Sent to existing players when a new player joins      |
| `game_start`    | Notifies both players that the game is starting       |
| `game_move`     | Broadcasts move info to all players in the room       |
| `game_reset`    | Broadcasts a game reset to all players                |
| `player_left`   | Notifies remaining player(s) that someone has left    |
| `error`         | Returns a string message when something fails         |

---

## 🧠 Game Logic

* 2-player game
* 6x7 board grid
* Win detection via horizontal, vertical, or diagonal line of 4
* Game ends when someone wins or board is full
* Player turns alternate automatically

---

## 📁 Project Structure

```
.
├── server.js          # Main WebSocket server logic
├── package.json       # Node project setup
```

---

## 🔧 Environment Variables

You can change the default port using:

```bash
PORT=4000
```

---

## 🧪 Example Usage with WebSocket Client

```js
const ws = new WebSocket('ws://localhost:3003');

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'create_room', username: 'Alice' }));
};

ws.onmessage = (msg) => {
  const data = JSON.parse(msg.data);
  console.log('Server response:', data);
};
```

---

## 🔐 Graceful Shutdown

The server will listen for `SIGINT` (e.g. `Ctrl+C`) and close the WebSocket server cleanly.

---

## 🧪 Debugging

You can call the `getStats()` method in the `GameServer` class to view current room/player status. Example (only available in code):

```js
console.log(server.getStats());
```

---

## 📦 Dependencies

* [ws](https://www.npmjs.com/package/ws): WebSocket library
* [uuid](https://www.npmjs.com/package/uuid): For unique player and room IDs

---

## 📄 License

MIT — feel free to use and adapt.


