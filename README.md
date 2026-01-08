# Werewolf Pro (AI Battle Web)

A modern, AI-powered Werewolf (Mafia) game web application where LLM agents play against each other or interact with a human player. Built with React, TailwindCSS, and ModelScope API.

## 🌟 Features

*   **Multi-Model AI Backend**: Integrates a diverse pool of LLMs (Qwen, DeepSeek, MiniMax) to power player intelligences, ensuring unique personalities and strategies for every agent.
*   **Smart Role-Playing**: AI agents strictly adhere to role mechanics (Werewolf, Seer, Witch, Hunter, Guard, Villager) and engage in complex behaviors like bluffing ("悍跳"), logical deduction, and strategic voting.
*   **Dual Game Modes**:
    *   **User vs AI**: You play as Player 0 against 7 AI opponents.
    *   **AI Watch Mode**: Spectate a fully automated battle between 8 AI agents.
*   **Immersive UI**:
    *   Dark/Cyberpunk aesthetic with glassmorphism effects.
    *   Real-time status tracking (Alive/Dead, Role reveal on end).
    *   Detailed **Game Log** supporting export.
*   **Complex Game Logic**: Handles Night phases (Guard -> Wolf -> Seer -> Witch), Day phases (Announce -> Discussion -> Vote), Last words, and Hunter revenge shots.
*   **Thinking Process**: Visualizes when AI is "Reasoning" using Chain-of-Thought capabilities (via specialized models).

## 🛠️ Tech Stack

*   **Framework**: React 18 + Vite
*   **Languages**: JavaScript (ES6+)
*   **Styling**: Tailwind CSS
*   **Icons**: Lucide React
*   **AI API**: ModelScope (OpenAI-compatible interface)

## 🚀 Getting Started

### Prerequisites
*   Node.js (v16+)
*   npm or yarn

### Installation

1.  **Clone the repository**
    ```bash
    git clone <repository_url>
    cd battle-web
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Start the development server**
    ```bash
    npm run dev
    ```

4.  **Play**
    Open your browser and navigate to `http://localhost:5173`.

## 🧠 AI Model Configuration

The game uses a **Load Balancing** strategy to distribute the 8 players across different LLMs to optimize rate limits and gameplay diversity. Currently integrated models:

1.  **DeepSeek-R1-Distill-Qwen-32B** (Logic & Reasoning)
2.  **Qwen 2.5 72B Instruct** (General Instruction)
3.  **DeepSeek R1** (Complex Reasoning)
4.  **MiniMax M1** (Character Roleplay)
5.  **Qwen 3 (235B/480B)** (Advanced Thinking & Coding Models)

*Configuration is located in `src/App.jsx`.*

## 🎮 Game Rules (Standard 8-Player)

*   **Population**: 8 Players
*   **Configuration**:
    *   🐺 **2 Werewolves**: Kill one target each night.
    *   🔮 **1 Seer**: Check the identity (Good/Bad) of one player each night.
    *   🧪 **1 Witch**: Possesses 1 Antidote (save night kill) and 1 Poison (kill any player).
    *   🛡️ **1 Guard**: Protects one player from wolf attack each night (cannot protect the same person two nights in a row).
    *   🔫 **1 Hunter**: Can shoot one player upon death (unless poisoned).
    *   🧑‍🌾 **2 Villagers**: No special abilities, vote during the day.
*   **Winning Conditions**:
    *   **Good Camp**: Vote out all Werewolves.
    *   **Werewolf Camp**: Eliminate enough good players (Team Wipe).

## 📂 Project Structure

```
battle-web/
├── src/
│   ├── components/       # UI Components
│   │   ├── ActionPanel.jsx   # Interactive buttons for phases
│   │   ├── GameLog.jsx       # Scrollable history log
│   │   ├── PlayerCardList.jsx# Avatar grid
│   │   ├── SpeechPanel.jsx   # Discussion bubble interface
│   │   └── VotePanel.jsx     # Voting interface
│   ├── hooks/
│   │   └── useWerewolfGame.js # Core game state machine & reducer
│   ├── App.jsx           # Main entry and AI orchestration
│   └── main.jsx
├── index.html
└── package.json
```

## ⚠️ Configuration Note

The project currently uses a hardcoded API key in `src/App.jsx` for the ModelScope API.
> `const API_KEY = "ms-..."`

**For local development:**
If the key expires or hits rate limits, please replace it with your own ModelScope API Token in `src/App.jsx`.

## License

MIT