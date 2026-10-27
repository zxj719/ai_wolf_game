import { ArrowUpRight, ArrowLeft } from "lucide-react";
import { useShell } from "../../shell/ShellContext";
import { ROUTES } from "../../shell/paths";
import { GAMES } from "./gamesList";

export default function GamesRoute() {
  const { locale = "zh", navigate } = useShell();
  const en = locale === "en";
  const title = (field) => field[locale] || field.zh;
  return (
    <main className="studio-home games-room">
      <div className="studio-container">
        <header className="games-room-header">
          <button onClick={() => navigate(ROUTES.HOME)}>
            <ArrowLeft size={16} />
            {en ? "Home" : "主页"}
          </button>
          <span className="studio-kicker">
            THE PLAY ROOM / WORK IN PROGRESS
          </span>
        </header>
        <div className="games-room-title">
          <h1>{en ? "One more round." : "再玩一会儿。"}</h1>
          <span>{en ? "Worlds in the making" : "一些正在长大的世界"}</span>
        </div>
        <button
          className="games-story"
          onClick={() => navigate(ROUTES.GAMES_MINESWEEPER)}
        >
          <div className="story-map" aria-hidden="true">
            {Array.from({ length: 81 }, (_, i) => (
              <i key={i} className={i < 45 && i % 9 < 7 ? "explored" : ""}>
                {i < 45 && i % 9 < 7 && i % 4 === 0 ? (i % 3) + 1 : ""}
              </i>
            ))}
            <span className="story-crosshair" />
          </div>
          <div className="story-copy">
            <span className="studio-kicker">
              CHAPTER 01 · {en ? "PLAYABLE PREVIEW" : "探索试玩"}
            </span>
            <h2>{en ? "Underground Echoes" : "地下回响"}</h2>
            <p>
              {en
                ? "Find supplies. Bring them home."
                : "扫开废土，带他们回家。"}
            </p>
            <span className="story-enter">
              {en ? "Enter the underground" : "进入地下"}
              <ArrowUpRight size={20} />
            </span>
          </div>
        </button>
        <h2 className="room-shelf-label">
          {en ? "A few familiar games" : "休息室"}
        </h2>
        <section
          className="room-shelf"
          aria-label={en ? "Other games" : "其他游戏"}
        >
          {GAMES.filter((g) => g.id !== "minesweeper").map((g, i) => (
            <button key={g.id} onClick={() => navigate(g.path)}>
              <span className="room-game-number">0{i + 1}</span>
              <strong>{title(g.title)}</strong>
              <ArrowUpRight size={17} />
            </button>
          ))}
        </section>
      </div>
    </main>
  );
}
