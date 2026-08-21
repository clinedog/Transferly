import React from 'react';
import { Code2, Settings, ShieldCheck } from 'lucide-react';

function Row({ label, value }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">{label}</p>
      <p className="mt-1 text-sm font-black text-[var(--tg-text-color)]">{value || 'Not configured'}</p>
    </div>
  );
}

export default function ProviderSettingsPanel({ dashboard, manifest }) {
  const settings = dashboard?.settings || {};
  const contract = dashboard?.adapter_contract || {};
  const enabledActions = Array.isArray(settings.enabled_actions) ? settings.enabled_actions : [];
  const supportedCurrencies = Array.isArray(settings.supported_currencies) ? settings.supported_currencies : [];
  const requiredEnv = Array.isArray(settings.required_env) ? settings.required_env : contract.required_env || [];
  const missingEnv = Array.isArray(settings.missing_env) ? settings.missing_env : contract.missing_env || [];

  return (
    <section className="rounded-[28px] border border-white/10 bg-[var(--tg-section-bg-color)] p-4">
      <div className="flex items-start gap-3">
        <Settings className="mt-0.5 shrink-0 text-[var(--tg-button-color)]" size={20} />
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Settings</p>
          <h2 className="mt-2 text-xl font-black text-[var(--tg-text-color)]">Provider configuration</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--tg-subtitle-text-color)]">
            Configuration summaries never expose secret values. Use server environment variables for provider credentials.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <Row label="Environment" value={settings.environment_mode || contract.mode || manifest.environmentSupport?.join(' / ')} />
        <Row label="Webhook endpoint" value={settings.webhook_endpoint_status || dashboard?.webhook_status?.status} />
        <Row label="Webhook secret" value={settings.webhook_secret_status} />
        <Row label="Actions" value={enabledActions.length ? enabledActions.join(', ') : 'No live actions'} />
        <Row label="Currencies" value={supportedCurrencies.length ? supportedCurrencies.join(', ') : 'Provider default'} />
        <Row label="Missing config" value={missingEnv.length ? missingEnv.join(', ') : 'None reported'} />
        <Row label="Payout limits" value={settings.payout_limits?.message || settings.payout_limits?.status || 'Limits not published'} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
          <ShieldCheck className="text-[var(--tg-button-color)]" size={18} />
          <p className="mt-3 text-sm font-black text-[var(--tg-text-color)]">Required environment variables</p>
          <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">
            {requiredEnv.join(', ') || 'No required variables listed.'}
          </p>
        </div>
        <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
          <Code2 className="text-[var(--tg-button-color)]" size={18} />
          <p className="mt-3 text-sm font-black text-[var(--tg-text-color)]">Contract metadata</p>
          <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">
            {dashboard?.metadata?.contract_version || 'Provider contract pending'} · Request {dashboard?.metadata?.request_id || 'not available'}
          </p>
        </div>
      </div>
    </section>
  );
}
