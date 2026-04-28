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
      },
      out_file: '/var/log/wolfgame/bt-server-out.log',
      error_file: '/var/log/wolfgame/bt-server-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
