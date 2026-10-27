import { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Waves,
  Key,
  LogOut,
  Send,
  Settings2,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { authService } from "../services/authService";
import { TokenManager } from "./TokenManager";
import { UserStats } from "./UserStats";
import { ProfileEditor } from "./Personal/ProfileEditor";
import { Avatar } from "./Personal/Avatar";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageToggle } from "./LanguageToggle";

function ProjectArt({ kind }) {
  return (
    <div className={`project-art art-${kind}`} aria-hidden="true">
      {kind === "music" && (
        <>
          <div className="record-sleeve">
            <span>
              STILL
              <br />
              LISTENING.
            </span>
            <small>SIDE A · MUSIC LAB</small>
          </div>
          <div className="vinyl">
            <i />
            <b>z.</b>
          </div>
          <span className="art-caption">SOUND IS A PLAYGROUND</span>
          <Waves className="sound-mark" size={27} />
        </>
      )}
      {kind === "wolf" && (
        <>
          <span className="moon" />
          <div className="wolf-hill hill-back" />
          <div className="wolf-hill hill-front" />
          <span className="wolf-star star-one">✦</span>
          <span className="wolf-star star-two">+</span>
          <span className="wolf-number">12</span>
          <span className="art-caption">TRUST NO ONE. THINK AGAIN.</span>
        </>
      )}
      {kind === "tennis" && (
        <>
          <div className="tennis-court">
            <i />
            <b />
          </div>
          <div className="tennis-ball" />
          <span className="tennis-label">
            LOVE
            <br />
            ALL.
          </span>
          <span className="art-caption">ONE MORE RALLY.</span>
        </>
      )}
      {kind === "novel" && (
        <>
          <div className="novel-page page-back" />
          <div className="novel-page page-front">
            <span>第 一 章</span>
            <b>
              故事，
              <br />
              由此发生。
            </b>
            <i />
            <i />
            <i />
            <small>YOUR NEXT WORLD</small>
          </div>
          <span className="novel-cursor">▍</span>
        </>
      )}
      {!["music", "wolf", "tennis", "novel"].includes(kind) && (
        <span className="index-art-symbol">
          {
            {
              novel: "Aa",
              robotics: "↗",
              games: "✣",
              backtest: "∿",
              thinking: "“",
              sites: "↗",
            }[kind]
          }
        </span>
      )}
    </div>
  );
}

export function Dashboard({
  onEnterWolfgame,
  onEnterSites,
  onEnterChords,
  onEnterTennis,
  onEnterRobotics,
  onEnterGames,
  onEnterNovel,
  onEnterBacktest,
  onEnterChat,
  onEnterThinkingLibrary,
  onLogout,
  onLogin,
  locale = "zh",
  onLocaleChange,
  themePref,
  onThemeChange,
}) {
  const { user, isAdmin, verifyModelscopeToken } = useAuth();
  const en = locale === "en";
  const t = (zh, english) => (en ? english : zh);
  const [filter, setFilter] = useState("all");
  const [showProfile, setShowProfile] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showTokenManager, setShowTokenManager] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [contact, setContact] = useState("");
  const [feedbackState, setFeedbackState] = useState(null);
  const [sending, setSending] = useState(false);
  const projects = [
    {
      id: "music",
      category: "create",
      title: t("音乐实验室", "Music lab"),
      subtitle: t(
        "把一首歌拆开，听见更多。",
        "Take a song apart. Hear something new.",
      ),
      tag: "MUSIC / AI",
      action: onEnterChords,
    },
    {
      id: "wolf",
      category: "play",
      title: t("AI 狼人杀", "AI Werewolf"),
      subtitle: t(
        "当 AI 坐上牌桌，谁在说谎？",
        "A table full of AI. Who is bluffing?",
      ),
      tag: "GAME / AGENTS",
      action: onEnterWolfgame,
    },
    {
      id: "tennis",
      category: "play",
      title: t("家庭网球", "Family tennis"),
      subtitle: t(
        "把每一次挥拍，变成一起的快乐。",
        "A little competition. A lot of good times.",
      ),
      tag: "SPORT / PLAY",
      action: onEnterTennis,
    },
    {
      id: "novel",
      category: "create",
      title: t("小说工作台", "Writing room"),
      subtitle: t(
        "给脑海中的故事，一个开始。",
        "Give the stories in your head a place to begin.",
      ),
      tag: "WORDS / AI",
      action: onEnterNovel,
    },
    {
      id: "robotics",
      category: "explore",
      title: t("机器人学习", "Robotics notebook"),
      subtitle: t(
        "从一个想法，到真实世界的动作。",
        "From an idea to movement in the real world.",
      ),
      tag: "LEARN / BUILD",
      action: onEnterRobotics,
    },
    {
      id: "games",
      category: "play",
      title: t("小游戏俱乐部", "The game club"),
      subtitle: t("休息一下，来一局刚刚好。", "A small break. One more round."),
      tag: "GAMES / FRIENDS",
      action: onEnterGames,
    },
    {
      id: "backtest",
      category: "explore",
      title: t("反向 T 回测", "Strategy backtest"),
      subtitle: t(
        "让想法遇见数据，让直觉接受检验。",
        "Let ideas meet data. Put intuition to the test.",
      ),
      tag: "DATA / FINANCE",
      action: onEnterBacktest,
    },
    {
      id: "thinking",
      category: "explore",
      title: t("思维图书馆", "Thinking library"),
      subtitle: t(
        "收集值得反复琢磨的问题。",
        "A collection of questions worth sitting with.",
      ),
      tag: "NOTES / IDEAS",
      action: onEnterThinkingLibrary,
    },
    {
      id: "sites",
      category: "explore",
      title: t("网站收藏", "The internet shelf"),
      subtitle: t(
        "互联网很大，这里是一些有趣的角落。",
        "Interesting little corners of a very big internet.",
      ),
      tag: "CURATION / WEB",
      action: onEnterSites,
    },
  ];
  projects.sort(
    (a, b) =>
      [
        "novel",
        "wolf",
        "games",
        "music",
        "tennis",
        "robotics",
        "backtest",
        "thinking",
        "sites",
      ].indexOf(a.id) -
      [
        "novel",
        "wolf",
        "games",
        "music",
        "tennis",
        "robotics",
        "backtest",
        "thinking",
        "sites",
      ].indexOf(b.id),
  );
  const filtered = projects.filter(
    (p) => filter === "all" || p.category === filter,
  );
  const sendFeedback = async (event) => {
    event.preventDefault();
    if (sending || feedback.trim().length < 5) return;
    setSending(true);
    setFeedbackState(null);
    try {
      const response = await authService.submitFeedback({
        message: feedback.trim(),
        contact: contact.trim(),
        username: user?.username || "游客",
        isGuest: !user,
        page: "home",
      });
      if (!response.success)
        throw new Error(
          response.error ||
            t("发送失败，请重试。", "Could not send. Please retry."),
        );
      setFeedback("");
      setContact("");
      setFeedbackState({
        success: true,
        text: t(
          "收到了，谢谢你留下的想法。",
          "Received. Thanks for sharing your thoughts.",
        ),
      });
    } catch (error) {
      setFeedbackState({ text: error.message });
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="studio-home studio-workshop">
      <a className="studio-skip" href="#playground">
        {t("跳到项目", "Skip to projects")}
      </a>
      <div className="studio-container">
        <header className="studio-header">
          <a href="/" className="studio-brand" aria-label="Zhaxiaoji home">
            <span className="brand-mark">
              z<span>✳</span>
            </span>
            <span>
              zhaxiaoji<span className="brand-domain">.com</span>
            </span>
          </a>
          <nav aria-label={t("主导航", "Main navigation")}>
            <a href="#playground">{t("游乐场", "Playground")}</a>
            <button type="button" onClick={onEnterGames}>
              {t("游戏室", "Game room")}
            </button>
            <button onClick={onEnterChat} type="button">
              {t("好友", "Friends")}
              <ArrowUpRight size={12} />
            </button>
          </nav>
          <button
            type="button"
            className="studio-account"
            aria-label={
              user
                ? t("编辑个人资料", "Edit your profile")
                : t(
                    "当前为游客，点击登录或注册",
                    "Browsing as a guest. Sign in or join",
                  )
            }
            onClick={() => (user ? setShowProfile(true) : onLogin?.())}
          >
            {user ? (
              <>
                <Avatar
                  name={user.displayName || user.username}
                  color={user.avatarColor}
                />
                <span>{user.displayName || user.username}</span>
                <Settings2 size={14} />
              </>
            ) : (
              <>
                <span className="guest-dot" />
                <span>{t("游客浏览 · 登录", "Explore freely · Sign in")}</span>
                <ArrowUpRight size={14} />
              </>
            )}
          </button>
        </header>
        <main>
          <section className="workshop-intro" aria-labelledby="hero-title">
            <div>
              <span className="studio-kicker">
                <span className="guest-dot" /> WORK IN PROGRESS
              </span>
              <h1 id="hero-title">
                {t("未完待续", "Still in the making")}
                <i>✳</i>
              </h1>
            </div>
            <button
              type="button"
              className="surprise-button"
              onClick={onEnterGames}
            >
              <Sparkles size={15} />
              {t("先玩一会儿", "Take a play break")}
              <ArrowUpRight size={15} />
            </button>
          </section>
          <section
            id="playground"
            className="playground-section"
            aria-labelledby="projects-title"
          >
            <h2 id="projects-title" className="workshop-heading">
              {t("正在做的", "On the workbench")}
            </h2>
            <div
              className="project-filters"
              role="group"
              aria-label={t("筛选项目", "Filter projects")}
            >
              {[
                ["all", t("全部", "All things")],
                ["play", t("玩一玩", "Play")],
                ["create", t("创作", "Create")],
                ["explore", t("探索与思考", "Explore")],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={filter === id}
                  onClick={() => setFilter(id)}
                >
                  {label}
                  <span>
                    {id === "all"
                      ? projects.length
                      : projects.filter((p) => p.category === id).length}
                  </span>
                </button>
              ))}
              <span className="filter-note">
                <span className="guest-dot" />
                {t("持续生长中", "Always growing")}
              </span>
            </div>
            <div className="projects-grid workshop-grid">
              {filtered.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={project.action}
                  className={`project-card ${["novel", "wolf"].includes(project.id) ? "featured-project" : "compact-project"}`}
                >
                  <ProjectArt kind={project.id} />
                  <div className="project-body">
                    <div className="project-meta">
                      <span>
                        {project.tag}{" "}
                        <i className="project-wip">
                          {t("建设中", "IN PROGRESS")}
                        </i>
                      </span>
                      <ArrowUpRight size={18} />
                    </div>
                    <h3>{project.title}</h3>
                    {["novel", "wolf"].includes(project.id) && (
                      <p>{project.subtitle}</p>
                    )}
                    <span className="project-index">
                      {String(projects.indexOf(project) + 1).padStart(2, "0")}
                      <span>
                        {" "}
                        /{" "}
                        {en && project.id === "wolf"
                          ? "Start your first match"
                          : t("打开探索", "OPEN PROJECT")}
                      </span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
          <section className="studio-connect" aria-labelledby="connect-title">
            <div>
              <h2 id="connect-title">{t("一起玩？", "Good company?")}</h2>
              <button
                type="button"
                onClick={onEnterChat}
                className="studio-button primary"
              >
                <Users size={16} />
                {t("去好友客厅坐坐", "Visit the friends lounge")}
                <ArrowUpRight size={15} />
              </button>
              <span className="connect-note">
                {t(
                  "浏览无需登录 · 交个朋友时再登录就好",
                  "Explore freely · sign in when you want to connect",
                )}
              </span>
            </div>
            <details className="workshop-feedback">
              <summary>{t("留个想法", "Leave a thought")} ↗</summary>
              <form className="feedback-form" onSubmit={sendFeedback}>
                <label htmlFor="home-feedback">
                  {t("留个想法", "Leave a thought")}
                </label>
                <textarea
                  id="home-feedback"
                  value={feedback}
                  minLength={5}
                  maxLength={1000}
                  required
                  rows={3}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder={t(
                    "你想在这里看到什么新鲜东西？",
                    "What would you like to discover here?",
                  )}
                />
                <div className="feedback-bottom">
                  <input
                    aria-label={t("联系方式（选填）", "Contact (optional)")}
                    value={contact}
                    maxLength={200}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder={t("联系方式（选填）", "Contact (optional)")}
                  />
                  <button
                    type="submit"
                    disabled={sending || feedback.trim().length < 5}
                  >
                    {sending
                      ? t("发送中…", "Sending…")
                      : t("发送留言", "Send feedback")}
                    <Send size={14} />
                  </button>
                </div>
                {feedbackState && (
                  <p
                    role={feedbackState.success ? "status" : "alert"}
                    className={
                      feedbackState.success ? "studio-success" : "studio-error"
                    }
                  >
                    {feedbackState.text}
                  </p>
                )}
              </form>
            </details>
          </section>
          {user && (
            <section className="personal-corner">
              <div>
                <Avatar
                  name={user ? user.displayName || user.username : "你"}
                  color={user?.avatarColor}
                />
                <div>
                  <strong>
                    {user
                      ? t(
                          `嗨，${user.displayName || user.username}`,
                          `Hello, ${user.displayName || user.username}`,
                        )
                      : t(
                          "这里也有你的位置。",
                          "There’s a place for you here, too.",
                        )}
                  </strong>
                  <p>
                    {user
                      ? user.bio ||
                        t(
                          "给自己写一句新的介绍吧。",
                          "Make this little corner your own.",
                        )
                      : t(
                          "随意探索。喜欢的话，再留下来。",
                          "Look around. Stay if you like.",
                        )}
                  </p>
                </div>
              </div>
              <div className="personal-actions">
                {user ? (
                  <>
                    <button type="button" onClick={() => setShowProfile(true)}>
                      <Settings2 size={15} />
                      {t("个人资料", "Edit profile")}
                    </button>
                    <button type="button" onClick={() => setShowStats(true)}>
                      <Trophy size={15} />
                      {t("我的战绩", "My stats")}
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setShowTokenManager(true)}
                      >
                        <Key size={15} />
                        {t("AI 配置", "AI settings")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onLogout}
                      aria-label={t("退出登录", "Sign out")}
                    >
                      <LogOut size={15} />
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={onLogin}>
                    {t("登录 / 注册", "Sign in / Join")}
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </section>
          )}
        </main>
        <footer className="studio-footer">
          <span>
            © {new Date().getFullYear()} Zhaxiaoji
            <span className="footer-dot">✳</span>
            {t("保持好奇，常来玩。", "Stay curious. Come play again.")}
          </span>
          <div>
            <a href="/about.html">{t("关于", "About")}</a>
            <a href="/privacy.html">{t("隐私", "Privacy")}</a>
            <a href="/terms.html">{t("条款", "Terms")}</a>
            <a href="#hero-title" aria-label={t("回到顶部", "Back to top")}>
              ↑
            </a>
          </div>
          <div className="studio-preferences">
            <ThemeToggle
              pref={themePref}
              onChange={onThemeChange}
              locale={locale}
            />
            <LanguageToggle
              locale={locale}
              onChange={onLocaleChange}
              label={t("界面语言", "Interface language")}
            />
          </div>
        </footer>
      </div>
      {showProfile && (
        <ProfileEditor locale={locale} onClose={() => setShowProfile(false)} />
      )}
      {showStats && (
        <UserStats onClose={() => setShowStats(false)} locale={locale} />
      )}
      {showTokenManager && (
        <TokenManager
          locale={locale}
          onClose={() => setShowTokenManager(false)}
          onTokenSaved={() => {
            setShowTokenManager(false);
            verifyModelscopeToken?.();
          }}
        />
      )}
    </div>
  );
}
