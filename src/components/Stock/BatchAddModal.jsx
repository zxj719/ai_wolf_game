import { useState } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';
import { STOCK_MAP } from '../../config/stockList';

const SYMBOL_RE = /^\d{6}\.(SH|SZ)$/i;

/**
 * BatchAddModal - 批量添加股票弹窗
 */
export function BatchAddModal({ onClose, onAdd, existingSymbols }) {
  const [input, setInput] = useState('');

  // 解析输入，支持逗号、换行、空格分隔
  const parsed = input
    .split(/[\n,\s]+/)
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);

  const results = parsed.map(sym => {
    const valid = SYMBOL_RE.test(sym);
    const exists = existingSymbols.includes(sym);
    const info = STOCK_MAP[sym];
    return { sym, valid, exists, name: info?.name || '' };
  });

  const toAdd = results.filter(r => r.valid && !r.exists);

  const handleSubmit = () => {
    if (!toAdd.length) return;
    onAdd(toAdd.map(r => ({ symbol: r.sym, name: r.name })));
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-bg-raised border border-line rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <span className="text-sm font-medium text-ink">批量添加股票</span>
          <button onClick={onClose} className="text-ink-muted hover:text-ink">
            <X size={16} />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4 space-y-3">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="输入股票代码，每行一个或用逗号分隔&#10;例如：600519.SH, 000858.SZ&#10;300750.SZ"
            className="w-full h-28 px-3 py-2 bg-bg-sunken border border-line rounded-lg text-sm text-ink placeholder-ink-faint resize-none focus:outline-none focus:border-accent"
            autoFocus
          />

          {/* 解析预览 — 语义校验态：错误=danger / 已存在=中性 / 可添加=success */}
          {results.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              <div className="text-xs text-ink-muted mb-1">
                解析到 {results.length} 个代码，{toAdd.length} 个可添加
              </div>
              {results.map((r, i) => (
                <div key={i} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${
                  !r.valid ? 'bg-danger-soft text-danger'
                    : r.exists ? 'bg-bg-sunken text-ink-muted'
                      : 'bg-success-soft text-success'
                }`}>
                  {!r.valid && <AlertCircle size={10} />}
                  <span className="font-mono">{r.sym}</span>
                  {r.name && <span className="text-ink-muted">{r.name}</span>}
                  {r.exists && <span className="text-ink-faint ml-auto">已存在</span>}
                  {!r.valid && <span className="ml-auto">格式错误</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-line">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-ink-muted hover:text-ink transition-colors">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!toAdd.length}
            className="px-4 py-1.5 text-sm bg-accent hover:bg-accent-hover disabled:bg-bg-sunken disabled:text-ink-faint text-white rounded-lg transition-colors flex items-center gap-1"
          >
            <Plus size={13} />
            添加 {toAdd.length > 0 ? `(${toAdd.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
