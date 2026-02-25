import { useState, useRef, useEffect } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

const SORT_OPTIONS = [
  { key: 'default', label: '默认' },
  { key: 'name', label: '名称' },
  { key: 'price', label: '价格' },
  { key: 'changePct', label: '涨跌幅' },
];

/**
 * WatchlistSorter - 排序下拉组件
 */
export function WatchlistSorter({ sortConfig, onSort }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = SORT_OPTIONS.find(o => o.key === sortConfig.key) || SORT_OPTIONS[0];

  const handleSelect = (key) => {
    if (key === sortConfig.key) {
      onSort({ key, asc: !sortConfig.asc });
    } else {
      onSort({ key, asc: key === 'name' });
    }
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
      >
        {sortConfig.key !== 'default' ? (
          sortConfig.asc ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        ) : (
          <ArrowUpDown size={12} />
        )}
        {current.label}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden z-20 min-w-[100px] shadow-xl">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => handleSelect(opt.key)}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                sortConfig.key === opt.key
                  ? 'bg-amber-600/20 text-amber-400'
                  : 'text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
