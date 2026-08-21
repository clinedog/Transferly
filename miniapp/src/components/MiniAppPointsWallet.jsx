import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  AlertCircle,
  Banknote,
  CheckCircle2,
  Clock3,
  Copy,
  ShieldCheck,
  Sparkles,
  WalletCards
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';
import { useTelegramMiniApp } from '../context/TelegramMiniAppContext';
import MiniAppOperationStatus from './MiniAppOperationStatus';

function formatMinor(amountMinor, currency = 'NGN') {
  const major = Number(amountMinor || 0) / 100;
  if (currency === 'NGN') {
    return `₦${major.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
  }
  return `${currency} ${major.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusLabel(status) {
  return String(status || 'pending').replace(/_/g, ' ');
}

function orderStatusMeta(status) {
  const key = String(status || 'pending').toLowerCase();

  if (key === 'payment_instructions') {
    return {
      label: 'Payment instructions',
      body: 'Transfer exactly the displayed amount to the configured account, then submit evidence.',
      icon: Clock3,
      tone: 'warn'
    };
  }

  if (key === 'payment_reported' || key === 'under_review') {
    return {
      label: 'Awaiting confirmation',
      body: 'Finance is reviewing your payment evidence. Points are not credited yet.',
      icon: ShieldCheck,
      tone: 'info'
    };
  }

  if (key === 'points_credited' || key === 'completed') {
    return {
      label: 'Completed',
      body: 'Points were released to your wallet balance.',
      icon: CheckCircle2,
      tone: 'success'
    };
  }

  if (key === 'needs_more_information') {
    return {
      label: 'More information needed',
      body: 'Open this request and provide the extra payment details requested by support.',
      icon: AlertCircle,
      tone: 'warn'
    };
  }

  if (['failed', 'cancelled', 'rejected'].includes(key)) {
    return {
      label: statusLabel(status),
      body: 'This order needs support review before it can continue.',
      icon: AlertCircle,
      tone: 'danger'
    };
  }

  return {
    label: statusLabel(status),
    body: 'Order status is being synchronized.',
    icon: Clock3,
    tone: 'info'
  };
}

function formatDate(value) {
  if (!value) {
    return 'Just now';
  }

  return new Date(value).toLocaleString();
}

function PillStat({ label, value, tone = 'default' }) {
  const toneClass = tone === 'accent'
    ? 'bg-[color-mix(in_srgb,var(--tg-button-color)_14%,var(--tg-section-bg-color))]'
    : 'bg-[var(--tg-secondary-bg-color)]';

  return (
    <div className={`rounded-[22px] px-4 py-3 ${toneClass}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">{label}</p>
      <p className="mt-1 text-xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">{value}</p>
    </div>
  );
}

function PackageCard({ pack, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`min-h-[188px] rounded-[26px] p-5 text-left shadow-sm transition active:scale-[0.99] ${
        active
          ? 'bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]'
          : 'bg-[var(--tg-section-bg-color)] text-[var(--tg-text-color)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-14 w-14 items-center justify-center rounded-[22px] ${
          active ? 'bg-white/[0.16]' : 'bg-[var(--tg-secondary-bg-color)] text-[var(--tg-button-color)]'
        }`}>
          <Banknote size={24} />
        </div>
        {active ? <CheckCircle2 size={19} /> : <ArrowRight size={18} className="text-[var(--tg-hint-color)]" />}
      </div>
      <h3 className="mt-4 text-lg font-black tracking-[-0.03em]">{pack.name}</h3>
      <p className={`mt-1 text-xs font-bold ${active ? 'text-white/[0.72]' : 'text-[var(--tg-hint-color)]'}`}>
        {formatMinor(pack.price_minor, pack.currency)} • {pack.currency}
      </p>
      <p className={`mt-3 text-sm leading-6 ${active ? 'text-white/[0.78]' : 'text-[var(--tg-subtitle-text-color)]'}`}>
        {Number(pack.points || 0).toLocaleString()} Transferly Points{pack.bonus_points ? ` + ${pack.bonus_points.toLocaleString()} bonus` : ''}.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {['Manual review', 'Bank transfer'].map((metric) => (
          <span
            key={metric}
            className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
              active ? 'bg-white/[0.16] text-white' : 'bg-[var(--tg-secondary-bg-color)] text-[var(--tg-hint-color)]'
            }`}
          >
            {metric}
          </span>
        ))}
      </div>
    </button>
  );
}

function FundingRequestRow({ request }) {
  const meta = orderStatusMeta(request.status);
  const StatusIcon = meta.icon;
  const statusTone = meta.tone === 'danger'
    ? 'text-[var(--tg-destructive-text-color)]'
    : meta.tone === 'success'
      ? 'text-[var(--tg-button-color)]'
      : 'text-[var(--tg-hint-color)]';

  return (
    <article className="rounded-[24px] bg-[var(--tg-secondary-bg-color)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-[var(--tg-text-color)]">{request.public_reference || request.id}</p>
          <p className={`mt-1 inline-flex items-center gap-1.5 text-xs font-black capitalize ${statusTone}`}>
            <StatusIcon size={13} />
            {meta.label}
          </p>
        </div>
        <span className="rounded-full bg-[var(--tg-section-bg-color)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--tg-hint-color)]">
          {Number(request.requested_points || 0).toLocaleString()} pts
        </span>
      </div>
      <div className="mt-4 grid gap-2 text-xs font-bold text-[var(--tg-subtitle-text-color)] sm:grid-cols-2">
        <span>{request.display_amount || formatMinor(request.expected_amount_minor, request.currency)}</span>
        <span>{formatDate(request.created_at)}</span>
      </div>
      <p className="mt-3 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">{meta.body}</p>
      {request.admin_note || request.rejection_reason ? (
        <p className="mt-3 rounded-[16px] bg-[var(--tg-section-bg-color)] p-3 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">
          {request.rejection_reason || request.admin_note}
        </p>
      ) : null}
    </article>
  );
}

function WalletReadiness({ authenticated, selectedPackage, paymentDestination }) {
  const items = [
    {
      label: 'Telegram session',
      detail: authenticated ? 'Account linked' : 'Open from Telegram',
      complete: authenticated
    },
    {
      label: 'Points package',
      detail: selectedPackage ? `${Number(selectedPackage.points || 0).toLocaleString()} pts selected` : 'Choose a package',
      complete: Boolean(selectedPackage)
    },
    {
      label: 'Payment destination',
      detail: paymentDestination?.provider || 'Loaded from Transferly API',
      complete: Boolean(paymentDestination?.id)
    },
    {
      label: 'Admin verification',
      detail: 'Points credit after approval only',
      complete: true
    }
  ];

  return (
    <section aria-label="Point order readiness" className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Order readiness</p>
          <h3 className="mt-2 text-2xl font-black text-[var(--tg-text-color)]">Ready before checkout</h3>
        </div>
        <ShieldCheck className="shrink-0 text-[var(--tg-button-color)]" size={26} />
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="rounded-[20px] bg-[var(--tg-secondary-bg-color)] p-3">
            {item.complete ? (
              <CheckCircle2 className="text-[var(--tg-button-color)]" size={18} />
            ) : (
              <AlertCircle className="text-[var(--tg-destructive-text-color)]" size={18} />
            )}
            <p className="mt-3 text-sm font-black text-[var(--tg-text-color)]">{item.label}</p>
            <p className="mt-1 text-xs font-bold text-[var(--tg-subtitle-text-color)]">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function MiniAppPointsWallet() {
  const {
    config,
    createPointsFundingRequest,
    profile,
    pointsFundingConfig,
    pointsFundingRequests,
    user
  } = useAppContext();
  const {
    configureMainButton,
    impact,
    notify
  } = useTelegramMiniApp();
  const packages = pointsFundingConfig?.packages || [];
  const paymentDestination = pointsFundingConfig?.payment_destination || null;
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [creating, setCreating] = useState(false);
  const [operationState, setOperationState] = useState({ status: 'idle' });

  const selectedPackage = packages.find((pack) => pack.id === selectedPackageId) || packages[0] || null;
  const pointsValueNote = pointsFundingConfig?.economy?.value_note || selectedPackage?.points_value_note || '1 Transferly Point = ₦1';
  const authenticated = Boolean(user?.id);
  const pendingRequests = pointsFundingRequests.filter((request) => ['PAYMENT_INSTRUCTIONS', 'PAYMENT_REPORTED', 'UNDER_REVIEW', 'NEEDS_MORE_INFORMATION'].includes(request.status));
  const awaitingRequests = pointsFundingRequests.filter((request) => ['PAYMENT_REPORTED', 'UNDER_REVIEW'].includes(request.status));
  const completedRequests = pointsFundingRequests.filter((request) => request.status === 'POINTS_CREDITED');
  const latestRequests = pointsFundingRequests.slice(0, 4);
  const amountLabel = selectedPackage ? formatMinor(selectedPackage.price_minor, selectedPackage.currency) : 'Select package';

  const canCreate = authenticated && !creating && Boolean(selectedPackage?.id) && Boolean(paymentDestination?.id);

  const selectPackage = (packageId) => {
    setSelectedPackageId(packageId);
    setOperationState({ status: 'idle' });
    impact('light');
  };

  const createOrder = useCallback(async () => {
    if (creating) {
      return;
    }

    if (!authenticated) {
      setOperationState({
        status: 'error',
        title: 'Telegram session required',
        description: 'Open Transferly from Telegram to create a funding order.'
      });
      toast.error('Open Transferly from Telegram to create a funding order');
      notify('error');
      return;
    }

    if (!selectedPackage?.id) {
      setOperationState({
        status: 'error',
        title: 'Choose a package',
        description: 'Select an available Transferly Points package.'
      });
      toast.error('Choose a points package');
      impact('light');
      return;
    }

    setCreating(true);
    setOperationState({
      status: 'loading',
      title: 'Creating funding request',
      description: `Preparing payment instructions for ${selectedPackage.name}.`
    });
    impact('medium');

    try {
      const result = await createPointsFundingRequest({
        packageId: selectedPackage.id,
        userNote: `Mini App funding request for ${selectedPackage.name}`
      });

      if (!result.success) {
        setOperationState({
          status: 'retry',
          title: 'Funding request was not created',
          description: result.message || 'Try again when the Telegram session is active.'
        });
        toast.error(result.message || 'Unable to create funding request');
        notify('error');
        return;
      }

      setOperationState({
        status: 'success',
        title: 'Payment instructions ready',
        description: `${result.fundingRequest?.public_reference || 'Your reference'} is ready. Transfer exactly ${amountLabel} and submit evidence after payment.`
      });
      toast.success('Funding request created');
      notify('success');
    } catch (_error) {
      setOperationState({
        status: 'retry',
        title: 'Funding request was not created',
        description: 'Check your connection and try again.'
      });
      toast.error('Unable to create funding request');
      notify('error');
    } finally {
      setCreating(false);
    }
  }, [
    amountLabel,
    authenticated,
    createPointsFundingRequest,
    creating,
    impact,
    notify,
    selectedPackage?.id,
    selectedPackage?.name
  ]);

  useEffect(() => {
    return configureMainButton?.({
      text: creating ? 'Creating Request' : 'Buy Points',
      enabled: canCreate,
      loading: creating,
      onClick: createOrder
    });
  }, [canCreate, configureMainButton, createOrder, creating]);

  const copyText = async (value, label) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(String(value));
      toast.success(`${label} copied`);
      notify('success');
    } catch (_error) {
      toast.error(`Unable to copy ${label.toLowerCase()}`);
      notify('error');
    }
  };

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[30px] bg-[var(--tg-section-bg-color)] shadow-sm">
        <div className="relative p-5">
          <div className="absolute right-[-44px] top-[-54px] h-32 w-32 rounded-full bg-[color-mix(in_srgb,var(--tg-button-color)_24%,transparent)] blur-2xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Buy Points</p>
              <h2 className="mt-3 text-5xl font-black leading-none tracking-[-0.06em] text-[var(--tg-text-color)]">
                {Number(profile?.points || 0).toLocaleString()}
              </h2>
              <p className="mt-2 text-sm font-bold text-[var(--tg-subtitle-text-color)]">points ready to spend</p>
            </div>
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[28px] bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]">
              <WalletCards size={34} />
            </div>
          </div>

          <div className="relative mt-5 grid gap-2 sm:grid-cols-3">
            <PillStat label="Pending Funding" value={pendingRequests.length.toLocaleString()} tone="accent" />
            <PillStat label="Awaiting Review" value={awaitingRequests.length.toLocaleString()} />
            <PillStat label="Credited" value={completedRequests.length.toLocaleString()} />
          </div>
        </div>
      </section>

      <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]">
            <Banknote size={26} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Buy Points</p>
            <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">{amountLabel}</h3>
            <p className="mt-2 text-sm leading-7 text-[var(--tg-subtitle-text-color)]">
              Select a backend-configured package. {pointsValueNote}. Transferly will generate a unique payment reference and bank-transfer instructions.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {packages.length ? (
            packages.map((pack) => (
              <PackageCard
                key={pack.id}
                pack={pack}
                active={selectedPackage?.id === pack.id}
                onSelect={() => selectPackage(pack.id)}
              />
            ))
          ) : (
            <div className="rounded-[24px] bg-[var(--tg-secondary-bg-color)] p-5 text-sm font-bold text-[var(--tg-subtitle-text-color)] lg:col-span-3">
              Points packages are not available yet. Please try again after Transferly syncs configuration.
            </div>
          )}
        </div>
      </section>

      <WalletReadiness
        authenticated={authenticated}
        selectedPackage={selectedPackage}
        paymentDestination={paymentDestination}
      />

      <MiniAppOperationStatus
        status={operationState.status}
        title={operationState.title}
        description={operationState.description}
        actionLabel={operationState.status === 'retry' ? 'Try again' : undefined}
        onAction={operationState.status === 'retry' ? createOrder : undefined}
      />

      <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Funding handoff</p>
            <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">Confirm Points Purchase</h3>
            <p className="mt-2 text-sm leading-7 text-[var(--tg-subtitle-text-color)]">
              Pay only to the server-controlled destination below. Points are credited only after admin verification and ledger success.
            </p>
          </div>
          <ShieldCheck className="shrink-0 text-[var(--tg-button-color)]" size={26} />
        </div>

        <div className="mt-5 rounded-[24px] bg-[var(--tg-secondary-bg-color)] p-4">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--tg-hint-color)]">Pay to</p>
          <div className="mt-3 grid gap-3 text-sm font-bold text-[var(--tg-subtitle-text-color)] sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--tg-hint-color)]">Account Name</p>
              <p className="mt-1 text-[var(--tg-text-color)]">{paymentDestination?.account_name || 'Not configured'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--tg-hint-color)]">Bank</p>
              <p className="mt-1 text-[var(--tg-text-color)]">{paymentDestination?.provider || 'Not configured'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--tg-hint-color)]">Account Number</p>
              <button type="button" onClick={() => copyText(paymentDestination?.account_number, 'Account number')} className="mt-1 inline-flex items-center gap-2 text-left font-black text-[var(--tg-text-color)]">
                {paymentDestination?.account_number || 'Not configured'} <Copy size={14} />
              </button>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--tg-hint-color)]">Amount</p>
              <p className="mt-1 text-[var(--tg-text-color)]">{amountLabel}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--tg-hint-color)]">Point Value</p>
              <p className="mt-1 text-[var(--tg-text-color)]">{pointsValueNote}</p>
            </div>
          </div>
          <p className="mt-4 rounded-[18px] bg-[var(--tg-section-bg-color)] p-3 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">
            A unique payment reference is generated after you create the funding request. Include it in your bank narration where possible.
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={createOrder}
            disabled={!canCreate}
            className="flex items-center justify-center gap-2 rounded-[20px] bg-[var(--tg-button-color)] px-5 py-3 text-sm font-black text-[var(--tg-button-text-color)] shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? 'Creating request' : 'Create funding request'}
            <Sparkles size={16} />
          </button>
          <button
            type="button"
            onClick={() => copyText(paymentDestination?.account_number, 'Account number')}
            disabled={!paymentDestination?.account_number}
            className="flex items-center justify-center gap-2 rounded-[20px] bg-[var(--tg-secondary-bg-color)] px-5 py-3 text-sm font-black text-[var(--tg-text-color)] shadow-sm"
          >
            <Copy size={16} />
            Copy account
          </button>
        </div>
        {!authenticated ? (
          <p className="mt-4 rounded-[18px] bg-[color-mix(in_srgb,var(--tg-destructive-text-color)_10%,var(--tg-secondary-bg-color))] p-3 text-xs font-bold leading-5 text-[var(--tg-destructive-text-color)]">
            Open Transferly from Telegram before creating a funding order.
          </p>
        ) : null}
      </section>

      <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Recent funding</p>
            <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">Funding history</h3>
          </div>
          <Clock3 size={24} className="text-[var(--tg-button-color)]" />
        </div>

        <div className="mt-5 space-y-3">
          {latestRequests.length ? (
            latestRequests.map((request) => (
              <FundingRequestRow key={request.id} request={request} />
            ))
          ) : (
            <div className="rounded-[24px] bg-[var(--tg-secondary-bg-color)] p-5 text-center">
              <CheckCircle2 className="mx-auto text-[var(--tg-button-color)]" size={28} />
              <p className="mt-3 text-sm font-black text-[var(--tg-text-color)]">No funding requests yet</p>
              <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-hint-color)]">
                Your next points funding request will appear here with verification status.
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link to="/miniapp/orders" className="flex items-center justify-center gap-2 rounded-[20px] bg-[var(--tg-secondary-bg-color)] px-5 py-3 text-sm font-black text-[var(--tg-text-color)] shadow-sm">
            Service orders
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <PillStat label="Wallet record cost" value={`${Number(config?.bank_slip_cost || 10).toLocaleString()} pts`} tone="accent" />
          <PillStat label="Notification cost" value={`${Number(config?.email_receipt_cost || 5).toLocaleString()} pts`} />
          <PillStat label="Funding method" value="Manual bank transfer" />
        </div>
      </section>
    </div>
  );
}
