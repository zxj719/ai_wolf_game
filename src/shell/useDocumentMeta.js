import { useEffect } from 'react';

const SITE_BASE_URL = 'https://zhaxiaoji.com';

/**
 * 根据当前路由 + 模块信息更新 document.title 与 SEO meta。
 *
 * 从 App.jsx 的 211–275 行 useEffect 抽出。调用方（Router / AppShell）
 * 每次路由变化时调用一次即可。
 */
export function useDocumentMeta({ title, description, pathname = window.location.pathname }) {
  useEffect(() => {
    const canonicalUrl = `${SITE_BASE_URL}${pathname}`;
    if (title) document.title = title;

    const updateMetaContent = (selector, content) => {
      if (!content) return;
      const element = document.querySelector(selector);
      if (element) element.setAttribute('content', content);
    };

    updateMetaContent('meta[name="description"]', description);
    updateMetaContent('meta[property="og:title"]', title);
    updateMetaContent('meta[property="og:description"]', description);
    updateMetaContent('meta[property="og:url"]', canonicalUrl);
    updateMetaContent('meta[name="twitter:title"]', title);
    updateMetaContent('meta[name="twitter:description"]', description);

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', canonicalUrl);
  }, [title, description, pathname]);
}
