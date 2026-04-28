# Novel Codex Deployment

This site exposes the novel workspace through:

- Frontend route: `/novel`
- Cloudflare Worker proxy: `/api/novel/*`
- ECS backend route: `/novel/*`
- Local novel workspace: `NOVEL_WORKSPACE_DIR`, usually the deployed copy of `meta_writing`

## ECS Setup

Install Codex globally on the Aliyun ECS host:

```powershell
npm i -g @openai/codex
```

Create or update `~/.codex/config.toml` on the ECS user that runs PM2:

```toml
model_provider = "crs"
model = "gpt-5.5"
model_reasoning_effort = "xhigh"
disable_response_storage = true
preferred_auth_method = "apikey"

[model_providers.crs]
name = "crs"
base_url = "https://apikey.soxio.me/openai"
wire_api = "responses"
requires_openai_auth = true
```

Set server secrets as environment variables. Do not commit the API key.

On Linux / Aliyun ECS bash:

```bash
export OPENAI_API_KEY="<cr_...>"
export NOVEL_WORKSPACE_DIR="/var/www/novel_generator/meta_writing"
export CODEX_HOME="/root/.codex"
export NOVEL_CODEX_ARGS="exec --full-auto --skip-git-repo-check"
```

If PM2 runs as a non-root user such as `www`, put the config under that user's home and point `CODEX_HOME` there:

```bash
sudo -u www mkdir -p /home/www/.codex
sudo -u www nano /home/www/.codex/config.toml
export CODEX_HOME="/home/www/.codex"
```

On Windows PowerShell:

```powershell
$env:OPENAI_API_KEY = "<cr_...>"
$env:NOVEL_WORKSPACE_DIR = "/var/www/novel_generator/meta_writing"
$env:CODEX_HOME = "/home/www/.codex"
$env:NOVEL_CODEX_ARGS = "exec --full-auto --skip-git-repo-check"
```

For PM2, put those values in the host environment, in `ecosystem.config.cjs` on the server, or in an ignored server-side env file loaded by your process manager. The repository `ecosystem.config.cjs` keeps only non-secret placeholders.

## Optional ECS Proxy With Mihomo

`clash` is no longer the best-maintained Linux core. Use `mihomo` (Clash Meta compatible core) on ECS, and keep the subscription URL only on the server.

Install the core:

```bash
apt update
apt install -y curl gzip

mkdir -p /etc/mihomo
cd /tmp

VERSION="v1.19.24"
ASSET="mihomo-linux-amd64-compatible-${VERSION}.gz"

curl -fL --connect-timeout 15 --max-time 180 \
  -o mihomo.gz \
  "https://github.com/MetaCubeX/mihomo/releases/download/${VERSION}/${ASSET}"

test "$(stat -c%s mihomo.gz)" -gt 1000000
file mihomo.gz
gzip -t mihomo.gz
gzip -f -d mihomo.gz
install -m 0755 mihomo /usr/local/bin/mihomo

mihomo -v
```

If GitHub release download stalls at `0%` on ECS, use one of these fallbacks:

```bash
# Force IPv4 and fail fast instead of hanging forever.
VERSION="v1.19.24"
ASSET="mihomo-linux-amd64-compatible-${VERSION}.gz"
curl -4 -fL --connect-timeout 15 --max-time 180 -o mihomo.gz "https://github.com/MetaCubeX/mihomo/releases/download/${VERSION}/${ASSET}"
```

```bash
# GitHub proxy fallback. Keep only one successful download.
VERSION="v1.19.24"
ASSET="mihomo-linux-amd64-compatible-${VERSION}.gz"
curl -fL --connect-timeout 15 --max-time 180 -o mihomo.gz "https://gh.llkk.cc/https://github.com/MetaCubeX/mihomo/releases/download/${VERSION}/${ASSET}"
```

```bash
# Alternate GitHub proxy fallback.
VERSION="v1.19.24"
ASSET="mihomo-linux-amd64-compatible-${VERSION}.gz"
curl -fL --connect-timeout 15 --max-time 180 -o mihomo.gz "https://gh-proxy.com/https://github.com/MetaCubeX/mihomo/releases/download/${VERSION}/${ASSET}"
```

After any successful fallback download:

```bash
test "$(stat -c%s mihomo.gz)" -gt 1000000
file mihomo.gz
gzip -t mihomo.gz
gzip -f -d mihomo.gz
install -m 0755 mihomo /usr/local/bin/mihomo
mihomo -v
```

Fetch the private subscription into the server config path:

```bash
curl -L "YOUR_CLASH_OR_MIHOMO_SUBSCRIPTION_URL" -o /etc/mihomo/config.yaml
chmod 600 /etc/mihomo/config.yaml
```

Create a systemd service:

```bash
cat >/etc/systemd/system/mihomo.service <<'EOF'
[Unit]
Description=Mihomo Proxy
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/mihomo -d /etc/mihomo
Restart=on-failure
RestartSec=5
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now mihomo
systemctl status mihomo --no-pager
```

Most subscriptions expose a local mixed proxy on `127.0.0.1:7890`. If your config uses a different port, check it with:

```bash
grep -E "mixed-port|port|socks-port" /etc/mihomo/config.yaml
```

If this prints nothing, the subscription does not declare an inbound listening port. Add a local-only mixed port at the top of the config:

```bash
cp /etc/mihomo/config.yaml "/etc/mihomo/config.yaml.bak.$(date +%Y%m%d%H%M%S)"

tmpfile="$(mktemp)"
{
  printf '%s\n' 'mixed-port: 7890'
  printf '%s\n' 'allow-lan: false'
  printf '%s\n' 'bind-address: 127.0.0.1'
  printf '%s\n' 'mode: rule'
  printf '\n'
  cat /etc/mihomo/config.yaml
} > "$tmpfile"
install -m 600 "$tmpfile" /etc/mihomo/config.yaml
rm -f "$tmpfile"

grep -E "mixed-port|allow-lan|bind-address|mode:" /etc/mihomo/config.yaml
```

If `mihomo -t -d /etc/mihomo` reports `yaml: line N: could not find expected ':'`, stop the service and inspect the file around that line:

```bash
systemctl stop mihomo
nl -ba /etc/mihomo/config.yaml | sed -n '1,30p'
file /etc/mihomo/config.yaml
```

The subscription must be Clash/Mihomo YAML and should contain keys such as `proxies:`, `proxy-groups:`, and `rules:`. If the file contains plain node links like `vmess://`, `trojan://`, `ss://`, `hysteria2://`, or HTML/error text, download the provider's Clash-format subscription instead, or convert the subscription before writing it to `/etc/mihomo/config.yaml`.

Some providers return a single long base64 line. That is also not a Mihomo config. You can confirm it with:

```bash
curl -L "YOUR_SUBSCRIPTION_URL" -o /tmp/sub.raw
head -c 80 /tmp/sub.raw; echo
base64 -d /tmp/sub.raw | sed -n '1,20p'
```

If decoding prints `vmess://`, `trojan://`, `ss://`, or `socks://` links, get the provider's Clash/Mihomo/YAML subscription URL from the panel, or run a trusted subscription converter before saving the result to `/etc/mihomo/config.yaml`.

To make Codex and the Node server use the proxy, set:

```bash
export HTTP_PROXY="http://127.0.0.1:7890"
export HTTPS_PROXY="http://127.0.0.1:7890"
export ALL_PROXY="socks5://127.0.0.1:7890"
```

For PM2, restart with the proxy environment:

```bash
cd /var/www/wolfgame
pm2 restart ecosystem.config.cjs --update-env
```

Verify outbound access:

```bash
curl -I --proxy http://127.0.0.1:7890 https://apikey.soxio.me/openai
codex exec --full-auto --skip-git-repo-check "Reply with OK if the proxy and Codex are available."
```

If `curl` reports `Connection refused` on `127.0.0.1:7890`, first confirm the service is still running and that the port is actually listening:

```bash
systemctl status mihomo --no-pager
journalctl -u mihomo -n 80 --no-pager
ss -lntp | grep mihomo
grep -nE "mixed-port|^port:|socks-port|redir-port|tproxy-port|external-controller" /etc/mihomo/config.yaml
```

`systemctl status` immediately after restart can show `active` for a few milliseconds even if the process exits right after parsing or runtime initialization. Trust `journalctl` and `ss`.

If the latest log stops at `MMDB invalid, remove and download`, Mihomo is trying to download its geodata before opening the local proxy port. On ECS this can stall if GitHub is slow. Manually seed the MMDB file, then restart:

```bash
systemctl stop mihomo
rm -f /etc/mihomo/Country.mmdb

curl -4 -fL --connect-timeout 15 --max-time 180 \
  -o /etc/mihomo/Country.mmdb \
  "https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/country.mmdb"

# If GitHub direct download stalls, use a GitHub proxy:
curl -fL --connect-timeout 15 --max-time 180 \
  -o /etc/mihomo/Country.mmdb \
  "https://gh.llkk.cc/https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/country.mmdb"

test "$(stat -c%s /etc/mihomo/Country.mmdb)" -gt 1000000
chmod 644 /etc/mihomo/Country.mmdb

systemctl restart mihomo
sleep 3
journalctl -u mihomo -n 60 --no-pager
ss -lntp | grep 7890
```

## Cloudflare Worker

The Worker proxies `https://zhaxiaoji.com/api/novel/*` to ECS after JWT auth. If the novel service runs on the same Express server as BT, `ECS_BT_URL` is enough:

```toml
[vars]
ECS_BT_URL = "http://bt.zhaxiaoji.com"
```

If you split it later, add:

```toml
ECS_NOVEL_URL = "https://novel.zhaxiaoji.com"
```

Keep the public API base on the frontend as `https://zhaxiaoji.com` or same-origin. Do not use `*.workers.dev` for production.

## Runtime Behavior

The browser starts generation with `POST /api/novel/projects/:project/generate`. The ECS server starts a Codex process in `novels/<project>` and immediately returns a job id. The browser polls `/api/novel/jobs/:jobId` and refreshes the project after completion.

Codex receives a prompt that tells it to follow the `meta_writing` manual workflow: read recent chapters, guidance, learned rules, and Story Bible; write the next chapter; then update chapter summaries, characters, timeline, pacing, and foreshadowing. It does not git commit.

## Deploy Meta Writing Workspace

Deploy the novel workspace from GitHub on the ECS host:

```bash
apt update
apt install -y git python3 python3-venv python3-pip

mkdir -p /var/www/novel_generator
cd /var/www/novel_generator

if [ -d meta_writing/.git ]; then
  cd meta_writing
  git pull --ff-only
else
  git clone https://github.com/zxj719/meta_writing.git
  cd meta_writing
fi
```

The website backend only reads `novels/*`, `chapters/*`, and `story_data/*` directly, and chapter generation is delegated to Codex running inside the project directory. A Python install is optional unless you want to run `meta_writing.cli`, pytest, or the Python auto-runner on the ECS host.

If you do want the Python tools, use Python 3.12 or newer. Ubuntu 22.04 often ships Python 3.10, which will fail with `Package 'meta-writing' requires a different Python`.

Optional Python tool install:

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
```

Optional Python CLI verification:

```bash
python -m meta_writing.cli --workspace-dir . project list
python -m meta_writing.cli --workspace-dir . --project rescue-male-lead status
```

If the server only uses Codex for manual generation, verify the workspace without Python instead:

```bash
find /var/www/novel_generator/meta_writing/novels -maxdepth 2 -type d
find /var/www/novel_generator/meta_writing/novels -path "*/chapters/*.md" | head
find /var/www/novel_generator/meta_writing/novels -path "*/story_data/*" | head
```

Then point the website backend to this workspace:

```bash
cd /var/www/wolfgame

npm install
npm install --prefix server

export NOVEL_WORKSPACE_DIR="/var/www/novel_generator/meta_writing"
export CODEX_HOME="/root/.codex"
export NOVEL_CODEX_ARGS="exec --full-auto --skip-git-repo-check"
export NO_PROXY="127.0.0.1,localhost,::1"
export no_proxy="127.0.0.1,localhost,::1"
export HTTP_PROXY="http://127.0.0.1:7890"
export HTTPS_PROXY="http://127.0.0.1:7890"
export ALL_PROXY="socks5://127.0.0.1:7890"

pm2 restart ecosystem.config.cjs --update-env
pm2 logs bt-server --lines 80
```

Check the ECS backend can read the novels:

```bash
curl http://127.0.0.1:3001/novel/projects
```
