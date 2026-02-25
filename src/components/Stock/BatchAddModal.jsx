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
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <span className="text-sm font-medium text-zinc-200">批量添加股票</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X size={16} />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-4 space-y-3">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="输入股票代码，每行一个或用逗号分隔&#10;例如：600519.SH, 000858.SZ&#10;300750.SZ"
            className="w-full h-28 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-amber-600"
            autoFocus
          />

          {/* 解析预览 */}
          {results.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              <div className="text-xs text-zinc-500 mb-1">
                解析到 {results.length} 个代码，{toAdd.length} 个可添加
              </div>
              {results.map((r, i) => (
                <div key={i} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${
                  !r.valid ? 'bg-red-950/30 text-red-400'
                    : r.exists ? 'bg-zinc-800 text-zinc-500'
                      : 'bg-green-950/20 text-green-400'
                }`}>
                  {!r.valid && <AlertCircle size={10} />}
                  <span className="font-mono">{r.sym}</span>
                  {r.name && <span className="text-zinc-400">{r.name}</span>}
                  {r.exists && <span className="text-zinc-600 ml-auto">已存在</span>}
                  {!r.valid && <span className="ml-auto">格式错误</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-zinc-800">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!toAdd.length}
            className="px-4 py-1.5 text-sm bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg transition-colors flex items-center gap-1"
          >
            <Plus size={13} />
            添加 {toAdd.length > 0 ? `(${toAdd.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
