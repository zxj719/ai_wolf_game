const SNAPSHOT_VERSION = 1;
const SNAPSHOT_PREFIX = 'wolfgame:snapshot';

function getUserKey(user, isGuestMode = false) {
  if (user?.id !== undefined && user?.id !== null) return `user:${user.id}`;
  if (user?.email) return `user:${user.email}`;
  if (user?.username) return `user:${user.username}`;
  return isGuestMode ? 'guest' : 'anonymous';
}

export function getWerewolfSnapshotKey(user, isGuestMode = false) {
  return `${SNAPSHOT_PREFIX}:${getUserKey(user, isGuestMode)}`;
}

export function createWerewolfGameSnapshot({ state, moduleState }) {
  const gameMode = moduleState?.gameMode || null;
  const phase = state?.phase || 'setup';
  const hasPlayers = Array.isArray(state?.players) && state.players.length > 0;

  if (!gameMode && phase === 'setup' && !hasPlayers) {
    return null;
  }

  return {
    version: SNAPSHOT_VERSION,
    savedAt: Date.now(),
    state,
    moduleState: {
      gameMode,
      selectedSetup: moduleState?.selectedSetup || null,
      customRoleSelections: moduleState?.customRoleSelections || null,
      victoryMode: moduleState?.victoryMode || null,
      gameStartTime: moduleState?.gameStartTime || null,
      hunterShooting: moduleState?.hunterShooting || null,
      selectedTarget: moduleState?.selectedTarget ?? null,
      speakerIndex: moduleState?.speakerIndex ?? -1,
      speakingOrder: moduleState?.speakingOrder || 'left',
      spokenCount: moduleState?.spokenCount ?? 0,
      userInput: moduleState?.userInput || '',
      gameResult: moduleState?.gameResult || null,
    },
  };
}

export function saveWerewolfGameSnapshot({ user, isGuestMode = false, snapshot }) {
  if (!snapshot || typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(getWerewolfSnapshotKey(user, isGuestMode), JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function loadWerewolfGameSnapshot({ user, isGuestMode = false } = {}) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getWerewolfSnapshotKey(user, isGuestMode));
    if (!raw) return null;
    const snapshot = JSON.parse(raw);
    if (snapshot?.version !== SNAPSHOT_VERSION || !snapshot.state || !snapshot.moduleState) {
      return null;
    }
    return snapshot;
  } catch {
    return null;
  }
}

export function clearWerewolfGameSnapshot({ user, isGuestMode = false } = {}) {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(getWerewolfSnapshotKey(user, isGuestMode));
}
