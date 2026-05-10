// Always use the server session path. Legacy browser-side LLM (fetchLLM)
// is obsolete for this project — the ECS server handles all game actions
// via the v1 contract adapter. This also fixes stale CF-cached bundles
// where SESSION_MODE was baked as 'legacy': the session URL is correctly
// derived from API_BASE (https://zhaxiaoji.com) even in old bundles, so
// the call reaches the Worker → ECS pipeline regardless of build-time env.
export async function requestWerewolfAI({
  sessionEnabled,
  sessionRequest,
  legacyRequest,
}) {
  return sessionRequest();
}
