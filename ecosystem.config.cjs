/**
 * PM2 生态配置文件
 *
 * 在 ECS 上启动：
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup   # 设置开机自启
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
        // 从 /var/www/wolfgame/server/.env 读取 secrets
        // 也可直接在这里写入（不推荐提交到 git）
      },
      // 日志路径
      out_file: '/var/log/wolfgame/bt-server-out.log',
      error_file: '/var/log/wolfgame/bt-server-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
