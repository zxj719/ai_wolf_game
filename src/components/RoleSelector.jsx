import React from 'react';
import { Minus, Plus, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { ROLE_METADATA, UNIQUE_ROLES, MULTI_ROLES } from '../config/roles';
import { formatRoleSummary, getRoleDescription, getRoleLabel, getUiCopy } from '../i18n/locale.js';

const ROLE_ICONS = {
  WEREWOLF: '🐺',
  VILLAGER: '👤',
  SEER: '👁️',
  WITCH: '🧪',
  HUNTER: '🎯',
  GUARD: '🛡️',
  MAGICIAN: '🎩',
  KNIGHT: '⚔️',
  DREAMWEAVER: '🌙',
};

function MultiRoleCard({ roleKey, count, onChange, maxCount, locale }) {
  return (
    <div className="mac-panel flex items-center justify-between gap-4 p-4">
      <div className="flex items-center gap-4">
        <span className="text-2xl">{ROLE_ICONS[roleKey]}</span>
        <div>
          <div className="font-semibold text-slate-900">{getRoleLabel(roleKey, locale)}</div>
          <div className="text-xs text-slate-500">{getRoleDescription(roleKey, locale)}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, count - 1))}
          disabled={count <= 0}
          className="mac-button mac-button-secondary h-10 w-10 rounded-2xl p-0"
        >
          <Minus size={16} />
        </button>
        <span className="w-10 text-center text-lg font-semibold text-slate-900">{count}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(maxCount, count + 1))}
          disabled={count >= maxCount}
          className="mac-button mac-button-secondary h-10 w-10 rounded-2xl p-0"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

function UniqueRoleCard({ roleKey, selected, onChange, locale }) {
  return (
    <button
      type="button"
      onClick={() => onChange(selected ? 0 : 1)}
      className={`flex items-center justify-between gap-4 rounded-[22px] border p-4 text-left transition-all ${
        selected
          ? 'bg-sky-500/10 border-sky-400/40 shadow-[0_10px_26px_rgba(40,121,255,0.14)]'
          : 'mac-panel hover:border-slate-300'
      }`}
    >
      <div className="flex items-center gap-4">
        <span className="text-2xl">{ROLE_ICONS[roleKey]}</span>
        <div>
          <div className="font-semibold text-slate-900">{getRoleLabel(roleKey, locale)}</div>
          <div className="text-xs text-slate-500">{getRoleDescription(roleKey, locale)}</div>
        </div>
      </div>
      <div className={`h-7 w-14 rounded-full p-1 transition-colors ${selected ? 'bg-sky-500' : 'bg-slate-300'}`}>
        <div className={`h-5 w-5 rounded-full bg-white transition-transform ${selected ? 'translate-x-7' : 'translate-x-0'}`} />
      </div>
    </button>
  );
}

export function RoleSelector({ selections, onChange, validation, locale = 'zh' }) {
  const copy = getUiCopy(locale).setup;

  const handleChange = (roleKey, newCount) => {
    onChange({
      ...selections,
      [roleKey]: newCount,
    });
  };

  const description = formatRoleSummary(selections, locale);

  return (
    <div className="mac-window w-full max-w-3xl p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mac-eyebrow">{copy.roleCounts}</div>
          <h3 className="mac-section-title mt-1">{copy.customRoles}</h3>
        </div>
        <div className="mac-badge">
          {copy.totalPlayers}: <span className="font-semibold text-slate-900">{validation.total}</span>
        </div>
      </div>

      <div className="space-y-6">
        <section className="space-y-3">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-rose-500">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            {copy.wolfCamp}
          </h4>
          <MultiRoleCard
            roleKey="WEREWOLF"
            count={selections.WEREWOLF || 0}
            onChange={(value) => handleChange('WEREWOLF', value)}
            maxCount={ROLE_METADATA.WEREWOLF.maxCount}
            locale={locale}
          />
        </section>

        <section className="space-y-3">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-600">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            {copy.specialRoles}
          </h4>
          <div className="grid gap-3 md:grid-cols-2">
            {UNIQUE_ROLES.map((roleKey) => (
              <UniqueRoleCard
                key={roleKey}
                roleKey={roleKey}
                selected={(selections[roleKey] || 0) > 0}
                onChange={(value) => handleChange(roleKey, value)}
                locale={locale}
              />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {copy.goodCamp}
          </h4>
          <div className="grid gap-3 md:grid-cols-2">
            {MULTI_ROLES.filter((roleKey) => roleKey !== 'WEREWOLF').map((roleKey) => (
              <MultiRoleCard
                key={roleKey}
                roleKey={roleKey}
                count={selections[roleKey] || 0}
                onChange={(value) => handleChange(roleKey, value)}
                maxCount={ROLE_METADATA[roleKey].maxCount}
                locale={locale}
              />
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 space-y-3 border-t border-slate-200/70 pt-5">
        <div className="text-sm text-slate-500">
          {copy.configSummary}: <span className="font-medium text-slate-900">{copy.buildSummary(description)}</span>
        </div>

        {validation.errors.length > 0 && (
          <div className="rounded-[22px] border border-rose-200 bg-rose-50/90 p-4">
            <div className="flex items-start gap-3 text-sm text-rose-600">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <div className="space-y-1">
                {validation.errors.map((error, index) => (
                  <div key={index}>{error}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {validation.warnings.length > 0 && validation.isValid && (
          <div className="rounded-[22px] border border-amber-200 bg-amber-50/90 p-4">
            <div className="flex items-start gap-3 text-sm text-amber-700">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div className="space-y-1">
                {validation.warnings.map((warning, index) => (
                  <div key={index}>{warning}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {validation.isValid && validation.errors.length === 0 && (
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
            <CheckCircle size={18} />
            <span>{copy.validConfig}</span>
          </div>
        )}
      </div>
    </div>
  );
}
