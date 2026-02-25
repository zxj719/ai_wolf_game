import { useState, useCallback } from 'react';

const STORAGE_KEY = 'stock_watchlist_tags';

const TAG_COLORS = ['red', 'blue', 'green', 'amber', 'purple', 'pink', 'cyan', 'orange'];

const defaultData = { tags: [], stockTags: {} };

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : defaultData;
  } catch {
    return defaultData;
  }
}

function save(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

/**
 * useWatchlistTags - 自选股标签管理 hook
 * 数据结构: { tags: [{id, name, color}], stockTags: { symbol: [tagId] } }
 */
export function useWatchlistTags() {
  const [data, setData] = useState(load);

  const update = useCallback((fn) => {
    setData(prev => {
      const next = fn(prev);
      save(next);
      return next;
    });
  }, []);

  const createTag = useCallback((name, color = TAG_COLORS[0]) => {
    const id = crypto.randomUUID();
    update(d => ({ ...d, tags: [...d.tags, { id, name, color }] }));
    return id;
  }, [update]);

  const deleteTag = useCallback((tagId) => {
    update(d => {
      const stockTags = { ...d.stockTags };
      for (const sym of Object.keys(stockTags)) {
        stockTags[sym] = stockTags[sym].filter(id => id !== tagId);
        if (!stockTags[sym].length) delete stockTags[sym];
      }
      return { tags: d.tags.filter(t => t.id !== tagId), stockTags };
    });
  }, [update]);

  const tagStock = useCallback((symbol, tagId) => {
    update(d => {
      const existing = d.stockTags[symbol] || [];
      if (existing.includes(tagId)) return d;
      return { ...d, stockTags: { ...d.stockTags, [symbol]: [...existing, tagId] } };
    });
  }, [update]);

  const untagStock = useCallback((symbol, tagId) => {
    update(d => {
      const existing = d.stockTags[symbol] || [];
      const next = existing.filter(id => id !== tagId);
      const stockTags = { ...d.stockTags };
      if (next.length) stockTags[symbol] = next;
      else delete stockTags[symbol];
      return { ...d, stockTags };
    });
  }, [update]);

  const getStockTags = useCallback((symbol) => {
    const tagIds = data.stockTags[symbol] || [];
    return data.tags.filter(t => tagIds.includes(t.id));
  }, [data]);

  const getStocksByTag = useCallback((tagId) => {
    return Object.entries(data.stockTags)
      .filter(([, ids]) => ids.includes(tagId))
      .map(([sym]) => sym);
  }, [data]);

  return {
    tags: data.tags,
    stockTags: data.stockTags,
    TAG_COLORS,
    createTag,
    deleteTag,
    tagStock,
    untagStock,
    getStockTags,
    getStocksByTag,
  };
}
