import React from 'react';
import { Minus, Plus, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { ROLE_METADATA, UNIQUE_ROLES, MULTI_ROLES, generateDescription } from '../config/roles';

// 角色图标映射
const ROLE_ICONS = {
  WEREWOLF: '🐺',
  VILLAGER: '👤',
  SEER: '👁️',
  WITCH: '🧙',
  HUNTER: '🎯',
  GUARD: '🛡️'
};

// 单个角色选择卡片（多选类型：+/- 按钮）
const MultiRoleCard = ({ roleKey, count, onChange, maxCount }) => {
  const meta = ROLE_METADATA[roleKey];
  const icon = ROLE_ICONS[roleKey];

  return (
    <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <div className="font-medium text-zinc-100">{meta.name}</div>
          <div className="text-xs text-zinc-400">{meta.description}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(0, count - 1))}
          disabled={count <= 0}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Minus size={16} />
        </button>
        <span className="w-8 text-center font-bold text-lg">{count}</span>
        <button
          onClick={() => onChange(Math.min(maxCount, count + 1))}
          disabled={count >= maxCount}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
};

// 单个角色选择卡片（唯一类型：开关）
const UniqueRoleCard = ({ roleKey, selected, onChange }) => {
  const meta = ROLE_METADATA[roleKey];
  const icon = ROLE_ICONS[roleKey];

  return (
    <button
      onClick={() => onChange(selected ? 0 : 1)}
      className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
        selected
          ? 'bg-indigo-900/50 border-indigo-500 text-indigo-100'
          : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-500'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="text-left">
          <div className={`font-medium ${selected ? 'text-indigo-100' : 'text-zinc-100'}`}>
            {meta.name}
          </div>
          <div className="text-xs text-zinc-400">{meta.description}</div>
        </div>
      </div>
      <div className={`w-12 h-6 rounded-full p-1 transition-colors ${
        selected ? 'bg-indigo-600' : 'bg-zinc-600'
      }`}>
        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
          selected ? 'translate-x-6' : 'translate-x-0'
        }`} />
      </div>
    </button>
  );
};

export const RoleSelector = ({ selections, onChange, validation }) => {
  const handleChange = (roleKey, newCount) => {
    onChange({
      ...selections,
      [roleKey]: newCount
    });
  };

  const description = generateDescription(selections);

  return (
    <div className="w-full max-w-lg bg-zinc-900/80 rounded-2xl border border-zinc-700 p-6 space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-zinc-100">自定义角色配置</h3>
        <div className="px-3 py-1 bg-zinc-800 rounded-full text-sm">
          总人数: <span className="font-bold text-indigo-400">{validation.total}</span>
        </div>
      </div>

      {/* 狼人阵营 */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-red-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          狼人阵营
        </h4>
        <MultiRoleCard
          roleKey="WEREWOLF"
          count={selections.WEREWOLF || 0}
          onChange={(v) => handleChange('WEREWOLF', v)}
          maxCount={ROLE_METADATA.WEREWOLF.maxCount}
        />
      </div>

      {/* 神职角色 */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-amber-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          神职角色（每种最多1个）
        </h4>
        <div className="space-y-2">
          {UNIQUE_ROLES.map(roleKey => (
            <UniqueRoleCard
              key={roleKey}
              roleKey={roleKey}
              selected={(selections[roleKey] || 0) > 0}
              onChange={(v) => handleChange(roleKey, v)}
            />
          ))}
        </div>
      </div>

      {/* 好人阵营 */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-green-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          好人阵营
        </h4>
        <div className="space-y-2">
          {MULTI_ROLES.filter(r => r !== 'WEREWOLF').map(roleKey => (
            <MultiRoleCard
              key={roleKey}
              roleKey={roleKey}
              count={selections[roleKey] || 0}
              onChange={(v) => handleChange(roleKey, v)}
              maxCount={ROLE_METADATA[roleKey].maxCount}
            />
          ))}
        </div>
      </div>

      {/* 配置摘要和验证状态 */}
      <div className="pt-4 border-t border-zinc-700 space-y-3">
        <div className="text-sm text-zinc-400">
          配置: <span className="text-zinc-200 font-medium">{description || '请选择角色'}</span>
        </div>

        {/* 错误提示 */}
        {validation.errors.length > 0 && (
          <div className="flex items-start gap-2 p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
            <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-300 space-y-1">
              {validation.errors.map((err, i) => (
                <div key={i}>{err}</div>
              ))}
            </div>
          </div>
        )}

        {/* 警告提示 */}
        {validation.warnings.length > 0 && validation.isValid && (
          <div className="flex items-start gap-2 p-3 bg-amber-900/30 border border-amber-700/50 rounded-lg">
            <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-300 space-y-1">
              {validation.warnings.map((warn, i) => (
                <div key={i}>{warn}</div>
              ))}
            </div>
          </div>
        )}

        {/* 有效状态 */}
        {validation.isValid && validation.errors.length === 0 && (
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle size={18} />
            <span className="text-sm">配置有效，可以开始游戏</span>
          </div>
        )}
      </div>
    </div>
  );
};
