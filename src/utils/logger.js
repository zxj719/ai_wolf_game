/**
 * 环境感知日志工具
 * 开发模式：输出所有级别
 * 生产模式：仅 warn 和 error（Vite 的 drop 会移除 console，这里作为额外保障）
 */
const IS_DEV = import.meta.env.DEV;

export const logger = {
  debug: (...args) => {
    if (IS_DEV) console.log(...args);
  },
  info: (...args) => {
    if (IS_DEV) console.info(...args);
  },
  warn: (...args) => {
    console.warn(...args);
  },
  error: (...args) => {
    console.error(...args);
  },
};
