import { FXNAME, SETS, rand } from '../gameData';

function Scoreboard({ state }) {
  const { player: p, opp: o } = state;
  const dots = (n) => (
    <div className="sb-dots">{[0, 1].map((i) => <i key={i} className={i < n ? 'won' : ''} />)}</div>
  );
  return (
    <div className="scoreboard">
      <div className="sb-side">
        <span className="sb-face">{p.face}</span>
        <div><div className="sb-name">{p.name}</div>{dots(state.setsP)}</div>
      </div>
      <div className="sb-mid">
        <div className="lbl">SETS</div>
        <div className="big">{state.setsP} : {state.setsO}</div>
        <div className="lbl">本盘 {state.sceneP}–{state.sceneO}</div>
      </div>
      <div className="sb-side right">
        <span className="sb-face">{o.face}</span>
        <div><div className="sb-name">{o.name}</div>{dots(state.setsO)}</div>
      </div>
    </div>
  );
}

/** ④ 正式比赛（三局两胜） */
export function MatchScreen({ state, dispatch, toast }) {
  const set = SETS[state.setIdx];
  const scene = set.scenes[state.sceneIdx];
  const rally = state.lastRally;
  const setPoint = state.sceneP === 2 || state.sceneO === 2;

  // 玩家骰 d20、对手骰 d12：主场观众加成，临场发挥上限更高
  const onPick = (i) => {
    dispatch({ type: 'PLAY_SCENE', optIdx: i, pRoll: rand(1, 20), oRoll: rand(1, 12) });
  };

  const onNext = () => {
    if (setPoint) {
      const pWon = state.sceneP === 2;
      toast(pWon ? `✅ 拿下${set.name.slice(0, 3)}！` : `❌ ${set.name.slice(0, 3)}丢了……`);
    }
    dispatch({ type: 'NEXT_SCENE' });
  };

  return (
    <section className="screen">
      <Scoreboard state={state} />
      <div className="set-banner">🎾 {set.name} 🎾</div>
      <div className="card">
        <h2>第 {state.sceneIdx + 1} 球 · {scene.q}</h2>
        <p className="hint">{scene.desc || ''}</p>

        {!rally && (
          <div className="opts">
            {set.decider ? (
              <button type="button" className="opt" onClick={() => onPick(0)}>
                <span className="key">⚡</span>
                <span>押上全部！总战力对决！
                  <span className="fx"><em>天赋+体力+技巧+心态 总和比拼</em></span>
                </span>
              </button>
            ) : (
              scene.opts.map((o, i) => (
                <button type="button" className="opt" key={o.t} onClick={() => onPick(i)}>
                  <span className="key">{'AB'[i]}</span>
                  <span>{o.t}<span className="fx"><em>比拼【{FXNAME[o.a]}】</em></span></span>
                </button>
              ))
            )}
          </div>
        )}

        {rally && (
          <div className="battle-log">
            <div className="vsline">
              <span className={`pill ${rally.win ? 'win' : 'lose'}`}>
                {state.player.face} {rally.label} {rally.pBase} + 发挥 {rally.pRoll} = <b>{rally.pTot}</b>
              </span>
              <span>VS</span>
              <span className={`pill ${rally.win ? 'lose' : 'win'}`}>
                {state.opp.face} {rally.label} {rally.oBase} + 发挥 {rally.oRoll} = <b>{rally.oTot}</b>
              </span>
            </div>
            <p className={rally.win ? 'res-win' : 'res-lose'}>
              {rally.win
                ? `🎉 这一球是你的！${state.opp.name} 一脸不可置信。`
                : `😤 ${state.opp.name} 拿下此球，还冲你比了个剪刀手。`}
              {rally.pTot === rally.oTot ? '（平分，鹰眼回放偏向了主队 🦅）' : ''}
            </p>
          </div>
        )}

        {rally && (
          <div className="center" style={{ marginTop: 16 }}>
            <button type="button" className="btn" onClick={onNext}>
              {setPoint ? '结算本盘 →' : '下一球 →'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
