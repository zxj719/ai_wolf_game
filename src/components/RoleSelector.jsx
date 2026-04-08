import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Crosshair,
  Eye,
  FlaskConical,
  Minus,
  Shield,
  Sparkles,
  Swords,
  User,
  Users,
} from 'lucide-react';
import { ROLE_METADATA, UNIQUE_ROLES, MULTI_ROLES } from '../config/roles';
import { formatRoleSummary, getRoleDescription, getRoleLabel, getUiCopy } from '../i18n/locale.js';

const ROLE_ICONS = {
  WEREWOLF: Swords,
  VILLAGER: Users,
  SEER: Eye,
  WITCH: FlaskConical,
  HUNTER: Crosshair,
  GUARD: Shield,
  MAGICIAN: Sparkles,
  KNIGHT: Sparkles,
  DREAMWEAVER: User,
};

function RoleIcon({ roleKey }) {
  const Icon = ROLE_ICONS[roleKey] || User;
  return (
    <span className="mac-icon-tile h-10 w-10 rounded-[16px]">
      <Icon size={17} />
    </span>
  );
}

function MultiRoleCard({ roleKey, count, onChange, maxCount, locale }) {
  return (
    <div className="mac-list-row">
      <div className="flex items-center gap-3">
        <RoleIcon roleKey={roleKey} />
        <div>
          <div className="text-sm font-semibold text-slate-900">{getRoleLabel(roleKey, locale)}</div>
          <div className="text-sm text-slate-500">{getRoleDescription(roleKey, locale)}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, count - 1))}
          disabled={count <= 0}
          className="mac-button mac-button-secondary h-9 w-9 rounded-[14px] p-0"
        >
          <Minus size={14} />
        </button>
        <span className="w-8 text-center text-base font-semibold text-slate-900">{count}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(maxCount, count + 1))}
          disabled={count >= maxCount}
          className="mac-button mac-button-secondary h-9 w-9 rounded-[14px] p-0"
        >
          <span className="text-base leading-none">+</span>
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
      className={`w-full rounded-[18px] border px-4 py-3 text-left transition-colors ${
        selected
          ? 'border-slate-900/12 bg-slate-900 text-white'
          : 'border-slate-200/80 bg-white/76 text-slate-900'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`mac-icon-tile h-10 w-10 rounded-[16px] ${selected ? '!bg-white/12 !text-white !border-white/10' : ''}`}>
            {React.createElement(ROLE_ICONS[roleKey] || User, { size: 17 })}
          </span>
          <div>
            <div className={`text-sm font-semibold ${selected ? 'text-white' : 'text-slate-900'}`}>{getRoleLabel(roleKey, locale)}</div>
            <div className={`text-sm ${selected ? 'text-white/72' : 'text-slate-500'}`}>{getRoleDescription(roleKey, locale)}</div>
          </div>
        </div>
        <div className={`rounded-full px-2.5 py-1 text-xs font-semibold ${selected ? 'bg-white/12 text-white' : 'bg-slate-100 text-slate-500'}`}>
          {selected ? 'On' : 'Off'}
        </div>
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
    <div className="mac-panel p-5 md:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mac-eyebrow">{copy.roleCounts}</div>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">{copy.customRoles}</h3>
        </div>
        <div className="mac-badge">
          {copy.totalPlayers}: <span className="font-semibold text-slate-900">{validation.total}</span>
        </div>
      </div>

      <div className="space-y-6">
        <section className="space-y-3">
          <div className="text-sm font-semibold text-slate-900">{copy.wolfCamp}</div>
          <MultiRoleCard
            roleKey="WEREWOLF"
            count={selections.WEREWOLF || 0}
            onChange={(value) => handleChange('WEREWOLF', value)}
            maxCount={ROLE_METADATA.WEREWOLF.maxCount}
            locale={locale}
          />
        </section>

        <section className="space-y-3">
          <div className="text-sm font-semibold text-slate-900">{copy.specialRoles}</div>
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
          <div className="text-sm font-semibold text-slate-900">{copy.goodCamp}</div>
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
          <div className="rounded-[18px] border border-rose-200 bg-rose-50/90 p-4">
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
          <div className="rounded-[18px] border border-amber-200 bg-amber-50/90 p-4">
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
