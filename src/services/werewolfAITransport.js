export async function requestWerewolfAI({
  sessionEnabled,
  sessionRequest,
  legacyRequest,
}) {
  if (sessionEnabled) {
    return sessionRequest();
  }
  return legacyRequest();
}
