import React from 'react';
import { ExternalLink, ShieldCheck } from 'lucide-react';

function formatStatus(value) {
  return String(value || 'preview')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ProviderLogo({ manifest }) {
  const [failed, setFailed] = React.useState(false);

  if (manifest.logoAsset && !failed) {
    return (
      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[18px] border border-[var(--provider-accent-border)] bg-white p-2 shadow-[0_14px_38px_rgba(0,0,0,0.18)] sm:h-14 sm:w-14 sm:rounded-[20px]">
        <img src={manifest.logoAsset} alt="" className="max-h-8 max-w-8 object-contain sm:max-h-9 sm:max-w-9" onError={() => setFailed(true)} />
      </div>
    );
  }

  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] border border-[var(--provider-accent-border)] bg-[var(--provider-accent-soft)] text-sm font-black text-[var(--miniapp-text-primary)] sm:h-14 sm:w-14 sm:rounded-[20px]">
      {manifest.iconLabel || manifest.displayName?.slice(0, 2) || 'TP'}
    </div>
  );
}

export default function ProviderHeader({ manifest, dashboard, workspaceData }) {
  const status = dashboard?.status?.status || dashboard?.readiness?.status || workspaceData?.connectionStatus || manifest.status;
  const health = dashboard?.health?.status || 'unknown';
  const environment = dashboard?.settings?.environment_mode || workspaceData?.environment || manifest.environmentSupport;

  return (
    <section className="rounded-[24px] border border-[var(--provider-accent-border)] bg-[linear-gradient(150deg,var(--provider-accent-soft),var(--miniapp-card-surface))] p-4 sm:rounded-[28px] sm:p-5">
      <div className="flex flex-col gap-4 min-[360px]:flex-row min-[360px]:items-start">
        <ProviderLogo manifest={manifest} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--miniapp-text-muted)]">Provider operations workspace</p>
          <h2 className="mt-2 text-xl font-black text-[var(--miniapp-text-primary)] sm:text-2xl">{manifest.displayName}</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[var(--miniapp-text-secondary)]">
            {manifest.shortDescription || 'Manage provider readiness, operations, activity, and settings from one Transferly-owned workspace.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--provider-accent-border)] bg-[var(--provider-accent-soft)] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--miniapp-text-primary)]">
              {formatStatus(status)}
            </span>
            <span className="rounded-full border border-[var(--miniapp-border-color)] bg-[var(--miniapp-surface)] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--miniapp-text-secondary)]">
              Health {formatStatus(health)}
            </span>
            <span className="rounded-full border border-[var(--miniapp-border-color)] bg-[var(--miniapp-surface)] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--miniapp-text-secondary)]">
              {Array.isArray(environment) ? environment.join(' / ') : environment || 'environment pending'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[20px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-surface)] p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 shrink-0 text-[var(--tg-button-color)]" size={18} />
            <p className="text-xs font-bold leading-5 text-[var(--miniapp-text-secondary)]">
              Transferly remains the primary product shell. Provider names and assets are used only as secondary service context.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-[20px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-surface)] p-4">
          {manifest.docsUrl ? (
            <a href={manifest.docsUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-[40px] items-center gap-2 rounded-2xl border border-[var(--miniapp-border-color)] bg-[var(--miniapp-card-surface)] px-3 text-xs font-black text-[var(--miniapp-text-primary)]">
              Docs <ExternalLink size={13} />
            </a>
          ) : null}
          {manifest.supportUrl ? (
            <a href={manifest.supportUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-[40px] items-center gap-2 rounded-2xl border border-[var(--miniapp-border-color)] bg-[var(--miniapp-card-surface)] px-3 text-xs font-black text-[var(--miniapp-text-primary)]">
              Support <ExternalLink size={13} />
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
