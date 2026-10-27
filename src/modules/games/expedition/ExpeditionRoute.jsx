import { extendTrace, prepareConnection } from "./routeDrawing";
import ConnectionPractice from "./ConnectionPractice";
import RoomAtlas from "./RoomAtlas";
import { safeCount, clearedCount, roomTotal, roomExit } from "./roomLayout";
import { lazy, Suspense, useEffect, useMemo, useState, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  BookOpen,
  Flag,
  Maximize2,
  Radio,
} from "lucide-react";
import { useShell } from "../../../shell/ShellContext";
import { ROUTES } from "../../../shell/paths";
import { buildNeighbors, computeNumbers } from "../minesweeper/mineEngine";
import { CAST, canSurveyRemaining } from "./bridgeWorld";
import {
  growthCapacity,
  threatProfile,
  roleBlockaded,
  trainingCost,
  explorationBonus,
  relocationCost,
  supportDistance,
} from "./campaignBalance";
import {
  CAMPAIGN_SAVE,
  createCampaign,
  restoreCampaign,
  actCampaign,
  navigateRegion,
  switchRegion,
  focusCampaign,
  orderRegion,
  findRole,
  regionForce,
  trainCampaign,
  nextCampaignLayer,
  moveRoleToRegion,
  regionalPreview,
} from "./campaignEngine";
import WorldMap from "./WorldMap";
import WorldTour, { TOUR_STEPS } from "./WorldTour";
import JourneyPrompt from "./JourneyPrompt";
import { journeyMode, openJourneyScene, finishJourneyScene, advanceDefense, chooseFreeExplore, JOURNEY_SCENES } from "./journeyProgress";
import FieldGuide from "./FieldGuide";
import StoryDialog from "./StoryScene";
import { STORY_SCENES, migrationScene } from "./storyScript";
import useStoryProgress from "./useStoryProgress";
import "./expedition.css";
import "./connectedWorld.css";
import "./journey.css";

const Classic = lazy(() => import("../minesweeper/MinesweeperRoute"));
const GUIDE_KEY = CAMPAIGN_SAVE + "-guide";
const JOURNEY_SAVE = CAMPAIGN_SAVE + "-journey";
const ACTIVE_SLOT = CAMPAIGN_SAVE + "-active-slot";
function loadCampaign(saveSlot) {
  try {
    const saved =
      restoreCampaign(localStorage.getItem(saveSlot)) ||
      (saveSlot === CAMPAIGN_SAVE && restoreCampaign(localStorage.getItem("zhaxiaoji-connected-world-v3")));
    if (saved) return saved;
    const old = JSON.parse(
      (saveSlot === CAMPAIGN_SAVE && localStorage.getItem("zhaxiaoji-underground-v1")) || "null",
    );
    const c = createCampaign(old?.seed ?? Math.floor(Math.random() * 2 ** 32), 1, { guided: true });
    if (
      old?.version === 1 &&
      Number.isSafeInteger(old.supplies) &&
      old.supplies >= 0
    ) {
      c.regions[c.active].supplies = old.supplies;
      c.announcement =
        "旧探索档案已保留；原料已转入新的连通地图。旧地图仍在浏览器存档中。";
    }
    return c;
  } catch {
    return createCampaign(Math.floor(Math.random() * 2 ** 32), 1, { guided: true });
  }
}
export default function ExpeditionRoute() {
  const [saveSlot, setSaveSlot] = useState(() => {
    try { return localStorage.getItem(ACTIVE_SLOT) === JOURNEY_SAVE ? JOURNEY_SAVE : CAMPAIGN_SAVE; }
    catch { return CAMPAIGN_SAVE; }
  });
  const switchSave = (slot) => {
    try { localStorage.setItem(ACTIVE_SLOT, slot); } catch {}
    setSaveSlot(slot);
  };
  return <ExpeditionSession key={saveSlot} saveSlot={saveSlot} onSwitchSave={switchSave} />;
}
function ExpeditionSession({ saveSlot, onSwitchSave }) {
  const { navigate } = useShell();
  const [campaign, setCampaign] = useState(() => loadCampaign(saveSlot)),
    [role, setRole] = useState("lin"),
    [flagMode, setFlagMode] = useState(false),
    [trace, setTrace] = useState([]),
    [anchor, setAnchor] = useState(null),
    [atlas, setAtlas] = useState(false),
    [regionSource, setRegionSource] = useState(null),
    [regionTarget, setRegionTarget] = useState(null),
    [classic, setClassic] = useState(false),
    [saveError, setSaveError] = useState(false);
  const [tour, setTour] = useState(-1);
  const narrative = useStoryProgress(campaign);
  const practice = narrative.lessonActive;
  const setPractice = narrative.setLessonActive;
  const scene = STORY_SCENES[narrative.active];
  const mode = journeyMode(campaign), advanced = mode === "free";
  const chapterScene = JOURNEY_SCENES[campaign.journey?.scene];
  const tacticalKey = mode === "combined" ? campaign.journey.home : campaign.active;
  const network = campaign.regions[tacticalKey];
  const tourSteps = advanced ? TOUR_STEPS : TOUR_STEPS.filter(([target], i) =>
    mode === "survey" ? ["survey", "controls"].includes(target) : mode === "defense" ? [5, 6].includes(i) : ["survey", "controls", "logistics"].includes(target));
  const clearDialog = useRef(null);
  useEffect(() => {
    const d = clearDialog.current;
    if (campaign.celebration && !campaign.alert && tour < 0 && !practice && d && !d.open) d.showModal();
  }, [campaign.celebration, campaign.alert, tour, practice]);
  const game = campaign.regions[campaign.active],
    paused =
      tour >= 0 || practice || !!scene || !!chapterScene || !!campaign.celebration || !!campaign.alert;
  const threat = threatProfile(game);
  const fieldTurns = game.explorationTurns ?? game.turn;
  const nextLanding =
    game.landings === 0
      ? threat.first
      : game.landings === 1
        ? threat.second
        : null;
  const nums = useMemo(
    () =>
      Array.from(
        computeNumbers(game.mines, buildNeighbors(game.size, game.size)),
      ),
    [game.mines, game.size],
  );
  const networkNums = useMemo(() => Array.from(computeNumbers(network.mines, buildNeighbors(network.size, network.size))), [network.mines, network.size]);
  const person = findRole(campaign, role),
    currentAnchor =
      anchor ?? (person?.key === tacticalKey ? person.index : null);
  const roleLevel = person ? campaign.regions[person.key].levels[role] : 1;
  const roomsAway = person ? supportDistance(person.key, campaign.active) : 0;
  const routePlan = prepareConnection(network, trace);
  useEffect(() => {
    try {
      localStorage.setItem(saveSlot, JSON.stringify(campaign));
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }, [campaign, saveSlot]);
  useEffect(() => {
    setAnchor(null);
    setTrace([]);
  }, [campaign.active, campaign.depth]);
  const closeTour = () => {
    setTour(-1);
    try {
      localStorage.setItem(GUIDE_KEY, "done");
    } catch {}
  };
  const move = (action, i) => {
    if (!paused) setCampaign((c) => actCampaign(c, action, i, role));
  };
  const tactical = (i) => {
    if (paused || mode === "survey") return;
    if (network.pendingStart) {
      setCampaign((c) => ({
        ...c,
        announcement: "先在左侧任选一格，确定本房间的起点。",
      }));
      return;
    }
    if (network.nodes[i]?.owner === "player") {
      setAnchor(i);
      setTrace([i]);
      return;
    }
    const path = extendTrace(network, trace, i),
      plan = prepareConnection(network, path);
    if (path.at(-1) !== i || !plan.valid) {
      setCampaign((c) => ({
        ...c,
        announcement: plan.reason || "先点击大本营，再沿安全格划出路线。",
      }));
      return;
    }
    setCampaign((c) => ({
      ...c,
      regions: { ...c.regions, [tacticalKey]: plan.world },
      announcement: plan.world.notice.text,
    }));
    setTrace([]);
    setAnchor(null);
  };
  const focusPerson = (id) => {
    setRole(id);
    const p = findRole(campaign, id);
    if (p) {
      setCampaign((c) => focusCampaign(switchRegion(c, p.key), p.index));
      setAnchor(p.index);
      setTrace([]);
    }
  };
  const totalSupplies = Object.values(campaign.regions).reduce(
    (sum, w) => sum + w.supplies,
    0,
  );
  if (classic)
    return (
      <>
        <div className="echo-classic-back">
          <button onClick={() => setClassic(false)}>← 回到地下回响</button>
        </div>
        <Suspense fallback={<p>载入经典扫雷…</p>}>
          <Classic />
        </Suspense>
      </>
    );
  return (
    <main className="echo-world connected-world" data-play-mode={mode}>
      <div className="connected-shell">
        <header className="echo-top">
          <button onClick={() => navigate(ROUTES.GAMES)}>
            <ArrowLeft size={15} />
            游戏室
          </button>
          <span>UNDERGROUND ECHOES / 清扫 · 重建 · 连接</span>
          <div>
            {saveSlot === JOURNEY_SAVE ? <button onClick={() => onSwitchSave(CAMPAIGN_SAVE)}>返回原远征</button> : !campaign.journey && <button onClick={() => onSwitchSave(JOURNEY_SAVE)}>体验故事开场</button>}
            <button onClick={() => narrative.resume()} disabled={paused}>
              <Radio size={15} />
              {narrative.queue.length ? "继续通话" : advanced ? "故事与教学" : "重听开场"}
            </button>
            <button onClick={() => setTour(0)}>
              <BookOpen size={15} />
              操作手册
            </button>
            <button onClick={() => setClassic(true)}>经典扫雷 ↗</button>
          </div>
        </header>
        <section className="connected-title">
          <div>
            <span className="echo-eyebrow">
              {advanced ? `B${campaign.depth} · A BRIDGE IS A PROMISE` : mode === "survey" ? "旧站台 · 脚下的路" : mode === "defense" ? "旧站台 · 留一盏灯" : "旧站台 · 电台两端"}
            </span>
            <h1>
              地下回响<span>清扫，重建，连接。</span>
            </h1>
          </div>
          <div className="turn-counter">
            <strong>{campaign.turn ?? game.turn}</strong>
            <span>
              行动回合
              <br />
              {mode === "defense" ? "由你结束回合" : "清扫操作推进"}
            </span>
            {advanced && <><b>{campaign.macroTurn}</b>
            <span>
              跨区回合
              <br />
              扫清一区推进
            </span></>}
          </div>
        </section>
        {!advanced ? <JourneyPrompt campaign={campaign}
          disabled={paused}
          onStory={() => setCampaign(openJourneyScene)} onHelp={() => mode === "combined" ? setTour(0) : setPractice(true)}
          onExplore={() => {
            const direction = ["east", "north", "west", "south"].find((d) => roomExit(campaign, d) && !campaign.completed.includes(roomExit(campaign, d)));
            if (direction) setCampaign((c) => navigateRegion(c, direction));
          }}
          onFree={() => setCampaign(chooseFreeExplore)} onLeave={() => navigate(ROUTES.GAMES)}
        /> : <section data-tour="story" className="connection-story">
          <Radio size={18} />
          <div>
            <span>九号中继站 · 频道在线</span>
            <p>{narrative.queue.length ? "电台里有人在等你。" : "「明天同一时间。」"}</p>
          </div>
          <button className="story-listen" disabled={paused} onClick={() => narrative.resume()}>
            {narrative.queue.length ? "接听" : "重听序章"}
          </button>
          <span className="story-depth">
            B{campaign.depth}
            <small>{game.shapeName || "独立房间"}</small>
          </span>
        </section>}
        <div className="connected-workspace">
          {mode !== "defense" && <section
            data-tour="survey"
            data-threat={mode === "survey" ? "quiet" : regionForce(campaign, campaign.active, "enemy") > 0 ? "hostile" : nextLanding === null ? "safe" : nextLanding - fieldTurns <= 4 ? "approaching" : "quiet"}
            className={`connected-panel survey-panel ${game.explosions.length ? "has-explosion" : ""}`}
          >
            <div className="echo-panel-head">
              <span>
                清扫 / 区域{" "}
                {campaign.active
                  .split(",")
                  .map((n) => Number(n) + 1)
                  .join(" · ")}
              </span>
              <span>
                {clearedCount(game)} / {safeCount(game)} 安全格
              </span>
            </div>
            <div className="survey-stage">
              <div className="frontier-status">
                <span>
                  前沿 {1 + (game.danger || 0)} · {game.size} × {game.size}
                  {!game.pendingStart && (
                    <span title="总雷数减去旗帜与已爆炸地雷；误标会影响估算">
                      {" "}
                      · 待标{" "}
                      {game.mines.filter(Boolean).length -
                        game.flags.filter(Boolean).length -
                        game.blasts.filter(Boolean).length}{" "}
                      雷
                    </span>
                  )}
                </span>
                <strong>
                  {mode === "survey" ? "先看清脚下，再往前走。" : mode === "combined" ? "清扫一步，桥头也前进一步。" : campaign.occupiers[campaign.active] === "enemy"
                    ? "敌占区 · 清扫不会自动收复"
                    : nextLanding != null
                      ? `预计再清扫 ${Math.max(0, nextLanding - fieldTurns)} 回合空降`
                      : regionForce(campaign, campaign.active, "enemy") > 0
                        ? "本区空降已结束 · 清除剩余敌军"
                        : "本区已无敌军 · 可以安心重建"}
                </strong>
              </div>
              <div className="world-coordinate">
                {game.shapeName || "独立房间"} · 完整房间地图
                <span>点数字：旗够则展开 · 剩余全是雷则连标</span>
              </div>
              <WorldMap
                key={campaign.active}
                game={game}
                nums={nums}
                showUnits={mode !== "survey"}
                disabled={paused}
                onCell={(i) => move(flagMode ? "flag" : "open", i)}
                onFlag={(i) => move("flag", i)}
              />
            </div>
            <div data-tour="navigation" className="world-navigation">
              <div className="direction-pad">
                <button
                  aria-label={
                    roomExit(campaign, "north")
                      ? "向上进入相邻房间"
                      : "上方没有房门"
                  }
                  onClick={() => setCampaign((c) => navigateRegion(c, "north"))}
                  disabled={paused || !roomExit(campaign, "north")}
                >
                  <ArrowUp size={18} />
                </button>
                <button
                  aria-label={
                    roomExit(campaign, "west")
                      ? "向左进入相邻房间"
                      : "左方没有房门"
                  }
                  onClick={() => setCampaign((c) => navigateRegion(c, "west"))}
                  disabled={paused || !roomExit(campaign, "west")}
                >
                  <ArrowLeft size={18} />
                </button>
                <span>
                  移动
                  <br />
                  不耗回合
                </span>
                <button
                  aria-label={
                    roomExit(campaign, "east")
                      ? "向右进入相邻房间"
                      : "右方没有房门"
                  }
                  onClick={() => setCampaign((c) => navigateRegion(c, "east"))}
                  disabled={paused || !roomExit(campaign, "east")}
                >
                  <ArrowRight size={18} />
                </button>
                <button
                  aria-label={
                    roomExit(campaign, "south")
                      ? "向下进入相邻房间"
                      : "下方没有房门"
                  }
                  onClick={() => setCampaign((c) => navigateRegion(c, "south"))}
                  disabled={paused || !roomExit(campaign, "south")}
                >
                  <ArrowDown size={18} />
                </button>
              </div>
              <div>
                <strong>穿过一道门，进入一间新房间</strong>
                <p>
                  {advanced ? <>{campaign.layout.name} · {roomTotal(campaign)} 间独立房间<br />本层已清扫 {campaign.completed.length} / {roomTotal(campaign)}</> : <>已经走过 {Object.keys(campaign.regions).length} 间。随时可以回来。</>}
                </p>
              </div>
            </div>
            <div data-tour="controls" className="world-actions">
              <button
                className={flagMode ? "echo-primary" : "echo-secondary"}
                aria-pressed={flagMode}
                onClick={() => setFlagMode((v) => !v)}
                disabled={paused}
              >
                <Flag size={15} />
                {flagMode ? "标记模式" : "开格模式"}
              </button>
              <span>
                左键开格 · 右键 / F 标记
                <br />
                点击或标记一次 → 下一回合
              </span>
              {canSurveyRemaining(game) && (
                <button
                  className="echo-secondary"
                  disabled={paused}
                  onClick={() => move("finish", game.entry)}
                  title="根据当前旗帜展开所有剩余格；误标仍可能触雷"
                >
                  按标记完成巡检 · 1 回合
                </button>
              )}
            </div>
            <div
              key={`${campaign.active}-${game.turn}`}
              role="status"
              className={`world-feedback ${game.explosions.length ? "feedback-blast" : ""}`}
            >
              <strong>
                {game.explosions.length ? "冲击警报" : "行动回响"}
              </strong>
              {game.notice.text}
            </div>
          </section>}
          {mode !== "survey" && <section className="connected-panel network-panel">
            <div className="echo-panel-head">
              <span>{mode === "combined" ? "后方 / 刚守住的桥头" : "连接 / 已清扫的地面"}</span>
              {mode === "defense" && <button className="echo-primary" disabled={paused} onClick={() => setCampaign(advanceDefense)}>结束回合 <ArrowRight size={16} /></button>}
              {advanced && <button
                className="atlas-toggle"
                aria-pressed={atlas}
                onClick={() => setAtlas((v) => !v)}
                disabled={paused}
              >
                <Maximize2 size={14} />
                {atlas ? "返回区域" : "缩放至全层"}
              </button>}
            </div>
            {advanced ? <div data-tour="roles" className="role-deck">
              {Object.entries(CAST).map(([id, character]) => {
                const p = findRole(campaign, id);
                return (
                  <button
                    key={id}
                    disabled={!p || paused}
                    aria-pressed={role === id}
                    onClick={() => {
                      setRole(id);
                      if (p?.key === campaign.active) setAnchor(p.index);
                    }}
                    className={`world-role ${role === id ? "selected" : ""}`}
                  >
                    <span className="role-avatar">{character.name[0]}</span>
                    <span>
                      <strong>{character.name}</strong>
                      <small>
                        {p
                          ? `势力 ${p.node.power} · 自然容量 ${growthCapacity(campaign.regions[p.key], p.node)}`
                          : "等待信号 · 尚未遇见"}
                      </small>
                      {p && roleBlockaded(campaign.regions[p.key], p.index) && (
                        <small className="blockade-note">
                          遭封锁 · 自然增长暂停，清扫可支援
                        </small>
                      )}
                    </span>
                    <i>{role === id ? "接收清扫所得" : "选择分配"}</i>
                  </button>
                );
              })}
            </div> : <div className="journey-role"><strong>林渡</strong><span>势力 {person?.node.power ?? 0}</span><span>{mode === "defense" ? "点击绿色据点开始画路线" : "清扫所得送往桥头"}</span></div>}
            <div data-tour="network" className="network-stage">
              {atlas ? (
                <RoomAtlas
                  campaign={campaign}
                  disabled={paused}
                  source={regionSource}
                  onRoom={(key) => {
                    if (regionSource) {
                      setRegionTarget(key);
                    } else {
                      setCampaign((c) => switchRegion(c, key));
                      setAtlas(false);
                    }
                  }}
                />
              ) : (
                <div>
                  <WorldMap
                    tactical
                    game={network}
                    nums={networkNums}
                    selected={currentAnchor}
                    disabled={paused}
                    onCell={tactical}
                    trace={trace}
                    onHover={(i) => {
                      if (!paused)
                        setTrace((path) => extendTrace(network, path, i));
                    }}
                  />
                </div>
              )}
              <div className="network-legend">
                <span>
                  <i className="friendly" />
                  我方
                </span>
                <span>
                  <i className="hostile" />
                  敌方
                </span>
                <span>→ 单向桥</span>
                <span>白点：方向 · 数字：实际运输</span>
                {mode === "free" && <span>左右为同一独立房间</span>}
              </div>
            </div>
            {atlas ? (
              <div className="atlas-instructions">
                <strong>房间拼成归航灯塔</strong>
                <p>
                  逐间穿梭，清扫后点亮轮廓。派队时选择相邻房间；清扫一间才推进一次跨区回合。
                </p>
                <button
                  className="echo-secondary"
                  onClick={() => {
                    setRegionSource(null);
                    setAtlas(false);
                  }}
                >
                  返回当前区域操作
                </button>
                <button
                  className="echo-secondary"
                  disabled={
                    paused || regionForce(campaign, campaign.active) < 5
                  }
                  onClick={() => {
                    setRegionSource(regionSource ? null : campaign.active);
                    setRegionTarget(null);
                  }}
                >
                  {regionSource ? "取消派队" : "从当前房间派队"}
                </button>
                {regionSource &&
                  regionTarget &&
                  (() => {
                    const p = regionalPreview(
                      campaign,
                      regionSource,
                      regionTarget,
                    );
                    return (
                      <div className="regional-plan" role="status">
                        <strong>
                          连接队 {p.amount} → 敌方 {p.enemy}
                        </strong>
                        <p>
                          {p.enemy
                            ? "敌占驻军只随清区回合增长；请为抵达前的增长留余量。"
                            : "队伍会支援友方据点，或在空房间建立前哨。"}
                          再清完任意一间新房，队伍抵达。出发点留守 1。
                        </p>
                        <button
                          className="echo-primary"
                          disabled={
                            !p.adjacent ||
                            p.amount < 3 ||
                            !campaign.regions[regionTarget]
                          }
                          onClick={() => {
                            setCampaign((c) =>
                              orderRegion(c, regionSource, regionTarget),
                            );
                            setRegionSource(null);
                            setRegionTarget(null);
                          }}
                        >
                          确认派出 {p.amount}
                        </button>
                      </div>
                    );
                  })()}
                {campaign.orders.map((o) => (
                  <p key={o.id}>
                    在途 {o.amount} 势力：{o.from} → {o.path.at(-1)} ·
                    等待下一次清区
                  </p>
                ))}
              </div>
            ) : (
              <>
                <div className="gesture-help">
                  <strong>
                    {trace.length
                      ? "路线绘制中"
                      : "点大本营 → 划路线 → 点终点驻扎"}
                  </strong>
                  <p role="status">
                    {trace.length
                      ? routePlan.reason
                      : advanced ? "途经数字格可获得对应势力；点敌方据点则派队进攻。手机选中后可划线并松手驻扎；键盘用方向键描绘、回车确认。" : "沿路的数字加到出发据点。驻扎花 3 点势力；想进攻，就把路线接到红色据点。"}
                  </p>
                  {trace.length > 0 && (
                    <button
                      className="echo-secondary"
                      onClick={() => setTrace([])}
                    >
                      取消路线
                    </button>
                  )}
                  {advanced && <button
                    className="echo-secondary"
                    onClick={() => setPractice(true)}
                    disabled={paused}
                  >
                    和林渡练一遍 · 剧情教学
                  </button>}
                </div>
              </>
            )}
            <div data-tour="logistics" className="logistics-bar">
              <span>
                在途 <b>{network.packets.reduce((sum, p) => sum + p.amount, 0)}</b>
              </span>
              <span>每回合前进 1 格</span>
              {advanced && <span>
                远征库存 <b>{totalSupplies}</b>
              </span>}
            </div>
            {advanced && <div className="role-story">
              <span>
                {CAST[role].job} / {CAST[role].name}
              </span>
              <p>「{CAST[role].line}」</p>
              <small>{CAST[role].bio}</small>
              <div>
                <button
                  disabled={!person || paused}
                  onClick={() => focusPerson(role)}
                >
                  定位角色
                </button>
                <button
                  disabled={!person || paused}
                  onClick={() => setCampaign((c) => trainCampaign(c, role))}
                >
                  培养角色 · {trainingCost(roleLevel)} 原料
                </button>
                {person?.key !== campaign.active && (
                  <button
                    disabled={
                      !person ||
                      paused ||
                      game.pendingStart ||
                      campaign.occupiers[campaign.active] === "enemy"
                    }
                    onClick={() =>
                      setCampaign((c) => moveRoleToRegion(c, role))
                    }
                  >
                    迁驻此区 ·{" "}
                    {person ? relocationCost(person.key, campaign.active) : 8}{" "}
                    原料
                  </button>
                )}
              </div>
              <small className="training-benefit">
                {roleLevel} 级 · 清扫增援 +{explorationBonus(roleLevel)}
                。培养：势力 +4、容量 +8，每两级提升增援。
                {roomsAway > 1
                  ? `相距 ${roomsAway} 区，支援约为 1/${1 + Math.floor(roomsAway / 2)}；迁近可恢复。`
                  : "当前位置可获得全额清扫支援。"}
              </small>
            </div>}
          </section>}
        </div>
        {(advanced || mode === "defense") && <div className="campaign-announcement" role="status">
          {campaign.announcement}
        </div>}
        {advanced && !!campaign.events?.length && (
          <details className="world-journal">
            <summary>远征战报 · 入侵、迁移与收复</summary>
            {campaign.events
              .slice(-12)
              .reverse()
              .map((e, i) => (
                <article key={`${e.turn}-${e.kind}-${i}`}>
                  <span>
                    行动 {e.turn} / 跨区 {e.macroTurn} · 区域{" "}
                    {e.key
                      .split(",")
                      .map((n) => Number(n) + 1)
                      .join(" · ")}
                  </span>
                  <p>{e.text}</p>
                  <button
                    className="echo-secondary"
                    disabled={paused}
                    onClick={() =>
                      setCampaign((c) =>
                        switchRegion(c, e.destination || e.key),
                      )
                    }
                  >
                    查看区域
                  </button>
                </article>
              ))}
          </details>
        )}
        {advanced && campaign.completed.length === roomTotal(campaign) && (
          <button
            className="echo-primary descend-button"
            onClick={() => {
              setCampaign(nextCampaignLayer);
              setAtlas(false);
              setAnchor(null);
            }}
          >
            本层全部清扫完成 · 进入下一层 <ArrowDown size={17} />
          </button>
        )}
        <details className="world-journal">
          <summary>九宫格操作练习 · 随时重看</summary>
          <FieldGuide
                onComplete={() =>
              setCampaign((c) => ({
                ...c,
                announcement: "操作练习完成。回到地图，慢慢看路。",
              }))
            }
          />
        </details>
        <details className="world-journal">
          <summary>电台手记 · 已收录 {narrative.unlocked.length + (campaign.journey?.heard?.length || 0)} 段对话</summary>
          <div className="story-replay-list">
            {narrative.unlocked.map((id) => <button key={id} disabled={paused} onClick={() => narrative.resume(id)}>
              <span>{STORY_SCENES[id].chapter} · {narrative.finished.includes(id) ? "重听" : "未读"}</span>
              <strong>{STORY_SCENES[id].title}</strong>
            </button>)}
            {campaign.journey?.heard?.map((id) => <button key={id} disabled={paused} onClick={() => setCampaign((c) => ({ ...c, journey: { ...c.journey, scene: id, line: 0 } }))}>
              <span>{JOURNEY_SCENES[id].chapter} · 重听</span><strong>{JOURNEY_SCENES[id].title}</strong>
            </button>)}
          </div>
        </details>
        <details className="world-journal">
          <summary>现场记录</summary>
          {game.journal.map((e, i) => (
            <article key={e.id + i}>
              <span>
                回合 {e.turn} / {e.speaker}
              </span>
              <p>{e.text}</p>
            </article>
          ))}
        </details>
        <footer className="echo-footer">
          <span>
            {saveError
              ? "无法保存，请保持当前页面打开。"
              : "本机自动存档 · 旧版存档保留"}
          </span>
          <span>所有空间都在地下。每一次连接，都有人记得。</span>
        </footer>
        {practice && <ConnectionPractice mode={mode === "survey" ? "survey" : mode === "defense" ? "defense" : "combined"} storageKey={`echoes-lesson-v1-${campaign.seed}${advanced ? "" : `-${mode}`}`} onClose={(completed) => {
          setPractice(false);
          if (completed) narrative.completeLesson();
        }} />}
        {chapterScene && !practice && tour < 0 && <StoryDialog key={campaign.journey.scene} scene={chapterScene}
          index={campaign.journey.line} onLine={(line) => setCampaign((c) => ({ ...c, journey: { ...c.journey, line } }))}
          onDismiss={() => setCampaign((c) => ({ ...c, journey: { ...c.journey, scene: null } }))}
          onFinish={() => setCampaign(finishJourneyScene)} />}
        {scene && !chapterScene && !practice && tour < 0 && !campaign.alert && !campaign.celebration && (
          <StoryDialog
            key={narrative.active}
            scene={scene}
            index={narrative.positions[narrative.active] || 0}
            onLine={narrative.setLine}
            onDismiss={narrative.suspend}
            onFinish={narrative.finish}
            secondary={narrative.active === "opening" ? { label: "先回到地图", onClick: narrative.finish } : null}
          />
        )}
        {campaign.alert && (
          <StoryDialog key={`migration-${campaign.turn}`} scene={migrationScene(campaign.alert)}
            onFinish={() => setCampaign((c) => ({ ...switchRegion(c, c.alert.destination), alert: null }))} />
        )}
        {tour >= 0 && (
          <WorldTour step={tour} steps={tourSteps} onStep={setTour} onClose={closeTour} />
        )}
        {campaign.celebration && !campaign.alert && !practice && tour < 0 && (
          <dialog
            ref={clearDialog}
            onCancel={(e) => {
              e.preventDefault();
              setCampaign((c) => ({ ...c, celebration: null }));
            }}
            className="region-clear-overlay"
          >
            <section
              aria-labelledby="clear-title"
              className="region-clear-card"
            >
              <div className="clear-rings" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
              <span>SECTOR RECONNECTED</span>
              <h2 id="clear-title">这一区，亮起来了。</h2>
              <p>
                {campaign.celebration.safe} 格安全地面已清扫。
                <br />
                {advanced ? `连接网络推进至第 ${campaign.celebration.macroTurn} 个跨区回合。` : "可以放下探测器，喘口气了。"}
              </p>
              {advanced && campaign.celebration.earned != null && (
                <p>
                  {campaign.celebration.turns} 次行动 · 原料 +
                  {campaign.celebration.earned}
                  {campaign.celebration.losses
                    ? ` · 爆炸损失 ${campaign.celebration.losses}`
                    : " · 无原料损失"}
                </p>
              )}
              <strong>{advanced ? "清扫 → 重建 → 连接" : "这条路，留下来了。"}</strong>
              <button
                autoFocus
                className="echo-primary"
                onClick={() =>
                  setCampaign((c) => ({ ...c, celebration: null }))
                }
              >
                回到地图 <ArrowRight size={16} />
              </button>
            </section>
          </dialog>
        )}
      </div>
    </main>
  );
}
