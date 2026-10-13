/**
 * haptics.js — 触感反馈。
 *   Android / Chrome：navigator.vibrate
 *   iOS 18+ Safari：没有 vibrate，但切换 <input type=checkbox switch> 会触发系统 Taptic，
 *   用一个隐藏的 label 代点即可（必须在用户手势回调里调用）。
 *   桌面端两者都是无副作用的空操作。
 */

const PATTERNS = {
  light: 6,
  medium: 12,
  heavy: 22,
  success: [10, 60, 18],
  error: [22, 40, 22, 40, 22],
};

let iosLabel = null;
const isIOS = typeof navigator !== 'undefined'
  && /iP(hone|ad|od)/.test(navigator.userAgent || '');

export function haptic(kind = 'light') {
  try {
    // 用户还没点过页面时浏览器会拦截振动（并在控制台报错），由推送触发的反馈直接跳过
    if (typeof navigator !== 'undefined' && navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && !isIOS) {
      navigator.vibrate(PATTERNS[kind] ?? 6);
      return;
    }
    if (!isIOS || typeof document === 'undefined') return;
    if (!iosLabel) {
      iosLabel = document.createElement('label');
      iosLabel.setAttribute('aria-hidden', 'true');
      iosLabel.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;opacity:0;overflow:hidden';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.tabIndex = -1;
      iosLabel.appendChild(input);
      document.body.appendChild(iosLabel);
    }
    iosLabel.click();
  } catch {
    // 触感只是锦上添花，失败静默
  }
}
