import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  BadgeHelp,
  CreditCard,
  FileText,
  Home,
  Mail,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  WalletCards
} from 'lucide-react';
import { BottomSheet, PremiumInput } from '../ui';

const commands = [
  {
    title: 'Wallet home',
    description: 'Open the Transferly command center.',
    group: 'Workspace',
    path: '/miniapp',
    icon: Home,
    keywords: ['dashboard', 'home', 'balance']
  },
  {
    title: 'Provider services',
    description: 'Review available financial service lanes.',
    group: 'Providers',
    path: '/miniapp/services',
    icon: Sparkles,
    keywords: ['services', 'providers', 'catalog']
  },
  {
    title: 'Points wallet',
    description: 'Review wallet balance, points, and account activity.',
    group: 'Wallet',
    path: '/miniapp/wallet',
    icon: WalletCards,
    keywords: ['points', 'wallet', 'balance']
  },
  {
    title: 'Receipt studio',
    description: 'Create and manage receipt workflows.',
    group: 'Tools',
    path: '/miniapp/studio',
    icon: Mail,
    keywords: ['receipt', 'email', 'studio']
  },
  {
    title: 'Receipt vault',
    description: 'Open stored receipts and historical records.',
    group: 'Tools',
    path: '/miniapp/vault',
    icon: FileText,
    keywords: ['history', 'vault', 'receipts']
  },
  {
    title: 'Orders',
    description: 'Review order status and point release history.',
    group: 'Operations',
    path: '/miniapp/orders',
    icon: FileText,
    keywords: ['orders', 'status', 'release']
  },
  {
    title: 'Support desk',
    description: 'Open help, support, and issue reporting.',
    group: 'Support',
    path: '/miniapp/support',
    icon: BadgeHelp,
    keywords: ['help', 'support', 'contact']
  },
  {
    title: 'Provider operations',
    description: 'Open operational provider readiness and controls.',
    group: 'Providers',
    path: '/miniapp/ops',
    icon: Activity,
    keywords: ['ops', 'operations', 'readiness']
  },
  {
    title: 'Settings',
    description: 'Adjust theme, haptics, and Mini App preferences.',
    group: 'Workspace',
    path: '/miniapp/settings',
    icon: Settings,
    keywords: ['settings', 'theme', 'haptics']
  },
  {
    title: 'PayPal overview',
    description: 'Open the PayPal provider workspace overview.',
    group: 'Providers',
    path: '/miniapp/services/paypal',
    icon: CreditCard,
    keywords: ['paypal', 'provider']
  },
  {
    title: 'Stripe overview',
    description: 'Open the Stripe provider workspace overview.',
    group: 'Providers',
    path: '/miniapp/services/stripe/overview',
    icon: CreditCard,
    keywords: ['stripe', 'provider']
  },
  {
    title: 'Wise receive',
    description: 'Open the Wise receive lane.',
    group: 'Providers',
    path: '/miniapp/services/wise/receive',
    icon: ShieldCheck,
    keywords: ['wise', 'receive', 'provider']
  }
];

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function commandMatches(command, query) {
  const needle = normalize(query);

  if (!needle) {
    return true;
  }

  return [
    command.title,
    command.description,
    command.group,
    command.path,
    ...(command.keywords || [])
  ].some((value) => normalize(value).includes(needle));
}

export default function MiniAppCommandPalette({ open, onClose, onCommand }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  const filteredCommands = React.useMemo(
    () => commands.filter((command) => commandMatches(command, query)),
    [query]
  );

  const runCommand = (command) => {
    onCommand?.(command);
    navigate(command.path);
    onClose?.();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Search Transferly"
      description="Jump to wallet tools, provider lanes, support, and settings."
      closeLabel="Close Transferly command search"
      panelClassName="max-h-[min(760px,calc(var(--tg-viewport-stable-height,100dvh)-24px))] overflow-hidden"
    >
      <div className="space-y-4">
        <PremiumInput
          type="search"
          role="searchbox"
          label="Search actions"
          aria-label="Search Transferly actions"
          placeholder="Wallet, provider, receipt, support..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          icon={Search}
          autoComplete="off"
        />

        <div className="max-h-[min(520px,calc(var(--tg-viewport-stable-height,100dvh)-250px))] space-y-2 overflow-y-auto pr-1">
          {filteredCommands.length ? (
            filteredCommands.map((command) => {
              const Icon = command.icon;
              const isCurrent = location.pathname === command.path;

              return (
                <button
                  type="button"
                  key={command.path}
                  onClick={() => runCommand(command)}
                  className="miniapp-pressable miniapp-touch-target flex w-full items-center gap-3 rounded-[20px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-panel-bg)] p-3 text-left text-[var(--tg-text-color)] hover:border-[var(--miniapp-accent-border)] hover:bg-[var(--miniapp-nav-hover-bg)]"
                  aria-label={`Open ${command.title}`}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[16px] bg-[var(--miniapp-accent-soft)] text-[var(--tg-button-color)]">
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-black">{command.title}</span>
                      {isCurrent ? (
                        <span className="rounded-full border border-[var(--miniapp-accent-border)] bg-[var(--miniapp-nav-active-bg)] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--miniapp-nav-active-text)]">
                          Current
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block truncate text-xs font-semibold text-[var(--tg-hint-color)]">
                      {command.group} - {command.description}
                    </span>
                  </span>
                </button>
              );
            })
          ) : (
            <div className="rounded-[20px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-panel-bg)] p-5 text-center">
              <p className="text-sm font-black text-[var(--tg-text-color)]">No matching actions</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-[var(--tg-hint-color)]">
                Try provider, wallet, receipt, support, or settings.
              </p>
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
