import React from 'react';
import { Link } from 'react-router-dom';
import { getProviderWorkspaceRoute } from '../../lib/providerManifests';

export default function ProviderTabs({ manifest, activeLane }) {
  const lanes = Array.isArray(manifest.lanes) ? manifest.lanes : [];

  return (
    <nav className="miniapp-provider-tabs w-full max-w-full overflow-x-auto rounded-[22px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-secondary-surface)] p-1.5" aria-label={`${manifest.displayName} workspace sections`}>
      <div className="flex min-w-max gap-1.5">
        {lanes.map((lane) => {
          const active = lane.id === activeLane;
          return (
            <Link
              key={lane.id}
              to={getProviderWorkspaceRoute(manifest.slug, lane.id)}
              className={
                active
                  ? 'miniapp-provider-tab miniapp-touch-target inline-flex flex-none items-center justify-center rounded-2xl border border-[var(--provider-accent-border)] bg-[var(--provider-accent-soft)] px-3 py-2 text-xs font-black text-[var(--miniapp-text-primary)]'
                  : 'miniapp-provider-tab miniapp-touch-target inline-flex flex-none items-center justify-center rounded-2xl border border-transparent px-3 py-2 text-xs font-black text-[var(--miniapp-text-secondary)] motion-safe:transition hover:border-[var(--miniapp-border-color)] hover:bg-[var(--miniapp-nav-hover-bg)] hover:text-[var(--miniapp-text-primary)]'
              }
              aria-current={active ? 'page' : undefined}
              aria-label={`${lane.label}${active ? ', current section' : ''}`}
            >
              {active ? <span className="sr-only">Current section: </span> : null}
              {lane.shortLabel || lane.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
