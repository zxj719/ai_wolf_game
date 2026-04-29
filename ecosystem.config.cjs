/**
 * PM2 production config.
 *
 * On ECS:
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup
 */
module.exports = {
  apps: [
    {
      name: 'bt-server',
      script: './server/index.js',
      cwd: '/var/www/wolfgame',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        ALLOWED_ORIGIN: 'https://zhaxiaoji.com',
        NOVEL_WORKSPACE_DIR: '/var/www/novel_generator/meta_writing',
        CODEX_HOME: '/root/.codex',
        NOVEL_CODEX_ARGS: 'exec --full-auto --skip-git-repo-check',
        // OPENAI_API_KEY / CRS_API_KEY must be provided by the host environment.
        // Do not commit the live cr_ key.
        WEREWOLF_SESSION_PROVIDER: process.env.WEREWOLF_SESSION_PROVIDER || 'claude-code',
        WEREWOLF_SESSION_TIMEOUT_MS: process.env.WEREWOLF_SESSION_TIMEOUT_MS || '90000',
        CLAUDE_CODE_BIN: process.env.CLAUDE_CODE_BIN || 'claude',
        CLAUDE_CODE_ARGS: process.env.CLAUDE_CODE_ARGS || '--print --output-format json',
        CLAUDE_CODE_SESSION_ROOT: process.env.CLAUDE_CODE_SESSION_ROOT || '/var/lib/wolfgame/claude-sessions',
        CLAUDE_CODE_RESUME: process.env.CLAUDE_CODE_RESUME || 'true',
        MINIMAX_API_KEY: process.env.MINIMAX_API_KEY || '',
        MINIMAX_API_URL: process.env.MINIMAX_API_URL || 'https://api.minimaxi.com/anthropic/v1/messages',
        MINIMAX_MODEL: process.env.MINIMAX_MODEL || 'MiniMax-M2',
        ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN || process.env.MINIMAX_API_KEY || '',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || process.env.MINIMAX_API_KEY || '',
        ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL || process.env.MINIMAX_ANTHROPIC_BASE_URL || 'https://api.minimaxi.com/anthropic',
        ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || process.env.MINIMAX_MODEL || 'MiniMax-M2',
      },
      out_file: '/var/log/wolfgame/bt-server-out.log',
      error_file: '/var/log/wolfgame/bt-server-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
