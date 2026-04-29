# Server Codex Runbook: Werewolf Claude Code + MiniMax Coding Plan

This guide is written for Codex running on the Aliyun ECS host. Follow it end to end to install, configure, deploy, and debug the Werewolf AI runtime that uses Claude Code with a MiniMax Coding Plan key and `MiniMax-M2.7`.

## Operating Rules

- Work on the ECS host, not the local Windows workspace.
- Do not commit or print live API keys. Put them in `/root/.config/wolfgame/werewolf-ai.env`.
- Use `--noproxy '*'` for local and own-domain curl checks when proxy env vars exist.
- Do not run `git reset --hard` unless the human explicitly approves discarding server-local edits.
- If a command fails, stop at that layer, collect logs, and fix the layer before continuing.

## Target Architecture

```text
Browser
-> https://zhaxiaoji.com/api/werewolf/session/ask
-> Cloudflare Worker
-> https://novel-origin.zhaxiaoji.com
-> ECS bt-server /bt/session/ask
-> Claude Code CLI
-> MiniMax Coding Plan / Anthropic-compatible provider
-> MiniMax-M2.7
```

The production runtime is `WEREWOLF_SESSION_PROVIDER=claude-code`. Direct MiniMax API mode is only an emergency fallback.

## 0. Confirm Baseline

```bash
set -e

cd /var/www/wolfgame
pwd
git remote -v
git status --short
node -v
npm -v
pm2 -v
```

Expected:

- Repo is `/var/www/wolfgame`.
- Node is 18 or newer.
- PM2 is installed.

If `git status --short` shows local edits, inspect them before pulling:

```bash
git diff --stat
git diff -- ecosystem.config.cjs server/werewolfSession.js docs/werewolf-claude-session-deployment.md || true
```

If the edits are unrelated server experiments, preserve them:

```bash
git stash push -u -m "ecs backup before werewolf claude deploy $(date +%F-%H%M%S)"
```

## 1. Pull Latest Code

```bash
cd /var/www/wolfgame
git pull --ff-only
git log --oneline -3

grep -n "MiniMax-M2.7" server/werewolfSession.js ecosystem.config.cjs docs/werewolf-claude-session-deployment.md
grep -n "claude-code-minimax-codingplan" server/werewolfSession.js
```

Expected:

- Latest commits include the Claude Code runtime work.
- `MiniMax-M2.7` appears in server defaults and docs.
- `claude-code-minimax-codingplan` appears in `server/werewolfSession.js`.

## 2. Install Runtime Dependencies

```bash
cd /var/www/wolfgame
npm install
npm install --prefix server

npm i -g @anthropic-ai/claude-code
which claude
claude --version
```

If `which claude` is not `/usr/local/bin/claude`, keep the actual path and use it as `CLAUDE_CODE_BIN` later.

If global npm install fails because of proxy/network, check Mihomo first:

```bash
systemctl status mihomo --no-pager || true
ss -lntp | grep 7890 || true
curl --proxy http://127.0.0.1:7890 -I https://registry.npmjs.org/@anthropic-ai/claude-code
```

Then temporarily export proxy env vars for npm:

```bash
export HTTP_PROXY="http://127.0.0.1:7890"
export HTTPS_PROXY="http://127.0.0.1:7890"
export ALL_PROXY="socks5://127.0.0.1:7890"
export NO_PROXY="127.0.0.1,localhost,::1,zhaxiaoji.com,.zhaxiaoji.com"
export no_proxy="$NO_PROXY"
```

## 3. Write ECS Secret Env

Create the root-only env file:

```bash
install -d -m 700 /root/.config/wolfgame
nano /root/.config/wolfgame/werewolf-ai.env
chmod 600 /root/.config/wolfgame/werewolf-ai.env
```

Use this template. Replace every `PASTE_MINIMAX_CODING_PLAN_KEY_HERE` with the real MiniMax Coding Plan `sk-cp-...` key on the server.

```bash
WEREWOLF_SESSION_PROVIDER="claude-code"
WEREWOLF_SESSION_TIMEOUT_MS="90000"

CLAUDE_CODE_BIN="/usr/local/bin/claude"
CLAUDE_CODE_ARGS="--print --output-format json"
CLAUDE_CODE_SESSION_ROOT="/var/lib/wolfgame/claude-sessions"
CLAUDE_CODE_RESUME="true"

MINIMAX_API_KEY="PASTE_MINIMAX_CODING_PLAN_KEY_HERE"
ANTHROPIC_AUTH_TOKEN="PASTE_MINIMAX_CODING_PLAN_KEY_HERE"
ANTHROPIC_API_KEY="PASTE_MINIMAX_CODING_PLAN_KEY_HERE"
ANTHROPIC_BASE_URL="https://api.minimaxi.com/anthropic"
ANTHROPIC_MODEL="MiniMax-M2.7"

MINIMAX_API_URL="https://api.minimaxi.com/anthropic/v1/messages"
MINIMAX_MODEL="MiniMax-M2.7"
```

If `which claude` returned another path, update `CLAUDE_CODE_BIN`.

Create the Claude session workspace:

```bash
install -d -m 700 /var/lib/wolfgame/claude-sessions
```

Load the env into the current shell:

```bash
set -a
. /root/.config/wolfgame/werewolf-ai.env
set +a
```

Check non-secret values only:

```bash
printf 'provider=%s\nmodel=%s\nbase=%s\nclaude=%s\nargs=%s\n' \
  "$WEREWOLF_SESSION_PROVIDER" "$ANTHROPIC_MODEL" "$ANTHROPIC_BASE_URL" "$CLAUDE_CODE_BIN" "$CLAUDE_CODE_ARGS"
test -n "$ANTHROPIC_AUTH_TOKEN" && echo "ANTHROPIC_AUTH_TOKEN is set"
```

## 4. Verify MiniMax Anthropic Endpoint Directly

This proves the Coding Plan key and endpoint work before Claude Code is involved.

```bash
curl --noproxy '*' -sS -X POST "$MINIMAX_API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MINIMAX_API_KEY" \
  -d '{
    "model":"MiniMax-M2.7",
    "max_tokens":100,
    "system":"You are a JSON echo service.",
    "messages":[
      {
        "role":"user",
        "content":[{"type":"text","text":"Return exactly {\"ok\":true} and nothing else."}]
      }
    ]
  }' | jq .
```

Expected: a response containing text with `{"ok":true}`.

If this fails:

- `401/403`: key is wrong or not a Coding Plan key.
- timeout: proxy/network issue. Try with `HTTPS_PROXY=http://127.0.0.1:7890`.
- model error: confirm the model name is exactly `MiniMax-M2.7`.

## 5. Verify Claude Code With MiniMax

```bash
cd /var/www/wolfgame
set -a
. /root/.config/wolfgame/werewolf-ai.env
set +a

printf 'Return exactly {"ok":true} and nothing else.\n' \
  | "$CLAUDE_CODE_BIN" $CLAUDE_CODE_ARGS
```

Expected: Claude Code exits with status 0 and prints a result that includes `{"ok":true}`.

If it fails:

```bash
"$CLAUDE_CODE_BIN" --version
env | grep -E "ANTHROPIC|MINIMAX|CLAUDE_CODE|WEREWOLF_SESSION" | sed -E 's/(KEY|TOKEN)=.*/\1=***REDACTED***/'
```

Common fixes:

- `spawn claude ENOENT`: `CLAUDE_CODE_BIN` points to the wrong path.
- Authentication error: set both `ANTHROPIC_AUTH_TOKEN` and `ANTHROPIC_API_KEY`.
- Wrong model: set `ANTHROPIC_MODEL="MiniMax-M2.7"`.
- Non-JSON result is acceptable at this layer if the result wrapper contains text; the game server extracts JSON from the final text.

## 6. Restart PM2 With Runtime Env

```bash
cd /var/www/wolfgame
set -a
. /root/.config/wolfgame/werewolf-ai.env
set +a

pm2 restart ecosystem.config.cjs --update-env
pm2 save
pm2 env 0 | grep -E "WEREWOLF_SESSION|CLAUDE_CODE|ANTHROPIC|MINIMAX|PORT" | sed -E 's/(KEY|TOKEN): .*/\1: ***REDACTED***/'
pm2 logs bt-server --lines 60
```

Expected:

- `WEREWOLF_SESSION_PROVIDER: claude-code`
- `ANTHROPIC_MODEL: MiniMax-M2.7`
- `CLAUDE_CODE_BIN` is set.
- `bt-server` is online.

## 7. Verify ECS Backend

```bash
curl --noproxy '*' -i http://127.0.0.1:3001/health

curl --noproxy '*' -sS -X POST http://127.0.0.1:3001/bt/session/ask \
  -H "Content-Type: application/json" \
  -d '{
    "gameSessionId":"manual-test-local",
    "player":{"id":1,"name":"AI-1","role":"村民","isAlive":true},
    "actionType":"DAY_SPEECH",
    "systemInstruction":"你是狼人杀玩家。只输出 JSON。",
    "prompt":"请输出 {\"speech\":\"测试发言\",\"voteIntention\":null,\"identity_table\":{}}",
    "gameStateMeta":{"dayCount":1,"phase":"day_discussion"}
  }' | jq .
```

Expected:

```json
{
  "success": true,
  "result": {
    "_modelInfo": {
      "provider": "claude-code-minimax-codingplan",
      "modelId": "MiniMax-M2.7"
    },
    "_sessionInfo": {
      "mode": "claude-code-single-match-multi-agent"
    }
  }
}
```

If this returns 502:

```bash
pm2 logs bt-server --lines 120
ls -la /var/lib/wolfgame/claude-sessions
```

Look for:

- `Claude Code timed out`: raise `WEREWOLF_SESSION_TIMEOUT_MS` to `120000`.
- `Invalid JSON from werewolf session AI`: Claude Code returned prose. Re-test the prompt in section 5.
- `Claude Code exited`: inspect the stderr text in PM2 logs.

## 8. Verify Tunnel / Public Origin

```bash
curl --noproxy '*' -i https://novel-origin.zhaxiaoji.com/health

curl --noproxy '*' -sS -X POST https://novel-origin.zhaxiaoji.com/bt/session/ask \
  -H "Content-Type: application/json" \
  -d '{
    "gameSessionId":"manual-test-origin",
    "player":{"id":1,"name":"AI-1","role":"村民","isAlive":true},
    "actionType":"DAY_SPEECH",
    "systemInstruction":"你是狼人杀玩家。只输出 JSON。",
    "prompt":"请输出 {\"speech\":\"测试发言\",\"voteIntention\":null,\"identity_table\":{}}",
    "gameStateMeta":{"dayCount":1,"phase":"day_discussion"}
  }' | jq .
```

If `novel-origin.zhaxiaoji.com` fails but localhost works:

```bash
systemctl status cloudflared --no-pager
journalctl -u cloudflared -n 80 --no-pager
```

## 9. Build And Deploy Frontend / Worker

Only deploy after backend checks pass.

```bash
cd /var/www/wolfgame
export VITE_AI_PROVIDER=ecs-session
export VITE_WEREWOLF_AI_MODE=session

npm run build || exit 1
npm exec -- wrangler deploy --assets ./dist
```

Expected Wrangler output includes:

```text
env.ECS_BT_URL ("https://novel-origin.zhaxiaoji.com")
env.ECS_NOVEL_URL ("https://novel-origin.zhaxiaoji.com")
Uploaded wolfgame
Deployed wolfgame triggers
```

If Wrangler tries OAuth and fails with `xdg-open`, export Cloudflare token/account env from the root shell history or existing deployment notes, then retry:

```bash
npm exec -- wrangler whoami
```

## 10. Verify Production Route

```bash
curl --noproxy '*' -i https://zhaxiaoji.com/api/health

TOKEN="$(curl --noproxy '*' -sS -X POST "https://zhaxiaoji.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"xingjian_zhang719@outlook.com","password":"REDACTED_FOR_DOC"}' | jq -r '.token // empty')"
echo "token length: ${#TOKEN}"

curl --noproxy '*' -i "https://zhaxiaoji.com/api/werewolf/session/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"gameSessionId":"manual-test-origin"}'
```

For the UI:

1. Open `https://zhaxiaoji.com/werewolf/setup`.
2. Confirm it does not require a ModelScope token when session mode is deployed.
3. Start a game.
4. Watch PM2 logs:

```bash
pm2 logs bt-server --lines 120
```

You should see no browser-side ModelScope dependency; AI decisions should hit `/bt/session/ask`.

## 11. Emergency Fallback

If Claude Code cannot run but direct MiniMax works, temporarily switch the ECS env:

```bash
sed -i 's/^WEREWOLF_SESSION_PROVIDER=.*/WEREWOLF_SESSION_PROVIDER="minimax-api"/' /root/.config/wolfgame/werewolf-ai.env
set -a
. /root/.config/wolfgame/werewolf-ai.env
set +a
pm2 restart ecosystem.config.cjs --update-env
```

Verify:

```bash
curl --noproxy '*' -sS -X POST http://127.0.0.1:3001/bt/session/ask \
  -H "Content-Type: application/json" \
  -d '{
    "gameSessionId":"fallback-test",
    "player":{"id":1,"name":"AI-1","role":"村民","isAlive":true},
    "actionType":"DAY_SPEECH",
    "systemInstruction":"你是狼人杀玩家。只输出 JSON。",
    "prompt":"请输出 {\"speech\":\"fallback ok\",\"voteIntention\":null,\"identity_table\":{}}",
    "gameStateMeta":{"dayCount":1,"phase":"day_discussion"}
  }' | jq .
```

Change it back to `claude-code` after Claude Code is fixed.

## Report Back To The Human

When done, report only these items:

- Latest git commit deployed.
- `claude --version`.
- PM2 env summary with keys redacted.
- Result of localhost `/bt/session/ask`.
- Result of `https://novel-origin.zhaxiaoji.com/bt/session/ask`.
- Whether `wrangler deploy` was run and its version id.
- Any remaining blocker and the exact PM2 log lines, with keys redacted.
