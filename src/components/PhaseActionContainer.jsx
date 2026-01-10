import React from 'react';
import { ActionPanel } from './ActionPanel';
import { SpeechPanel } from './SpeechPanel';
import { VotePanel } from './VotePanel';

export const PhaseActionContainer = ({
  phase,
  gameMode,
  isThinking,
  hunterShooting,
  selectedTarget,
  handleUserHunterShoot,
  handleAIHunterShoot,
  speakerIndex,
  players,
  speakingOrder,
  setSpeakingOrder,
  userInput,
  setUserInput,
  handleUserSpeak,
  userPlayer,
  nightDecisions,
  mergeNightDecisions,
  proceedNight,
  setPlayers,
  setUserPlayer,
  witchHistory,
  setWitchHistory,
  getPlayer,
  addLog,
  seerChecks,
  setSeerChecks,
  dayCount,
  nightStep,
  currentNightSequence,
  ROLE_DEFINITIONS,
  getCurrentNightRole,
  isUserTurn,
  handleVote,
  exportGameLog,
  restartGame,
  setSelectedTarget
}) => {
  return (
    <div className="mt-auto bg-zinc-900/60 border border-white/5 rounded-[3rem] p-8 shadow-2xl min-h-[180px] flex flex-col justify-center">
        {phase === 'game_over' && (
          <ActionPanel
            type="game_over"
            exportGameLog={exportGameLog}
            restartGame={restartGame}
          />
        )}

        {phase === 'hunter_shoot' && hunterShooting && (
          <ActionPanel
            type="hunter_shoot"
            selectedTarget={selectedTarget}
            handleUserHunterShoot={() => handleUserHunterShoot(hunterShooting.source || 'vote')}
            hunterPlayer={hunterShooting}
          />
        )}

        {phase === 'day_discussion' && speakerIndex !== -1 && (
          <SpeechPanel
            players={players}
            speakerIndex={speakerIndex}
            speakingOrder={speakingOrder}
            setSpeakingOrder={setSpeakingOrder}
            userInput={userInput}
            setUserInput={setUserInput}
            handleUserSpeak={handleUserSpeak}
            isThinking={isThinking}
            gameMode={gameMode}
          />
        )}

        {(phase === 'night' && isUserTurn()) && (
          <ActionPanel
            type="night_user"
            userPlayer={userPlayer}
            players={players}
            nightDecisions={nightDecisions}
            mergeNightDecisions={mergeNightDecisions}
            proceedNight={proceedNight}
            setPlayers={setPlayers}
            setUserPlayer={setUserPlayer}
            witchHistory={witchHistory}
            setWitchHistory={setWitchHistory}
            selectedTarget={selectedTarget}
            getPlayer={getPlayer}
            addLogFn={addLog}
            seerChecks={seerChecks}
            setSeerChecks={setSeerChecks}
            dayCount={dayCount}
            nightStep={nightStep}
            isUserTurn={isUserTurn}
            currentNightSequence={currentNightSequence}
            ROLE_DEFINITIONS={ROLE_DEFINITIONS}
          />
        )}

        {(phase === 'night' && !isUserTurn() && phase !== 'game_over') && (
          <ActionPanel type="night_ai" getCurrentNightRole={getCurrentNightRole} />
        )}

        {phase === 'day_voting' && (
          <VotePanel
            players={players}
            selectedTarget={selectedTarget}
            isThinking={isThinking}
            handleVote={handleVote}
          />
        )}

        {phase === 'day_announce' && (
          <ActionPanel type="day_announce" />
        )}
    </div>
  );
};
