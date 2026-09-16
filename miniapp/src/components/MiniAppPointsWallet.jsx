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
import { SurfaceCard } from './ui';

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

function normalizeStatus(status) {
  return String(status || '').trim().toUpperCase();
}

function titleCaseStatus(status) {
  return statusLabel(status).toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

function orderStatusMeta(status) {
  const key = normalizeStatus(status).toLowerCase();

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
    label: titleCaseStatus(status),
    body: 'Order status is being synchronized.',
    icon: Clock3,
    tone: 'info'
  };
}

const fundingProgressSteps = Object.freeze([
  { key: 'created', label: 'Request created' },
  { key: 'paid', label: 'Payment made' },
  { key: 'review', label: 'Verification' },
  { key: 'credited', label: 'Points credited' }
]);

function getFundingProgress(status) {
  const key = normalizeStatus(status);
  if (key === 'POINTS_CREDITED') return 4;
  if (['PAYMENT_REPORTED', 'UNDER_REVIEW', 'APPROVED', 'MANUAL_REVIEW', 'NEEDS_MORE_INFORMATION'].includes(key)) return 3;
  if (key === 'PAYMENT_INSTRUCTIONS') return 1;
  return 0;
}

function canSubmitEvidence(status) {
  return ['PAYMENT_INSTRUCTIONS', 'NEEDS_MORE_INFORMATION'].includes(normalizeStatus(status));
}

function requestAmount(request) {
  return request.display_amount || formatMinor(request.expected_amount_minor, request.currency);
}

function evidenceSummary(policy) {
  const types = Array.isArray(policy?.allowed_mime_types) ? policy.allowed_mime_types : [];
  const maxBytes = Number(policy?.max_size_bytes || policy?.max_bytes || 0);
  const maxMb = maxBytes ? `${Math.floor(maxBytes / (1024 * 1024))}MB` : 'configured limit';
  const labels = types.map((type) => type.replace('image/', '').replace('application/', '').toUpperCase());

  return labels.length ? `${labels.join(', ')} up to ${maxMb}` : `Screenshot or receipt up to ${maxMb}`;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',').pop() || '');
    reader.onerror = () => reject(new Error('Unable to read selected file.'));
    reader.readAsDataURL(file);
  });
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

function FundingProgress({ status }) {
  const progress = getFundingProgress(status);

  return (
    <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={`Funding progress: ${progress} of ${fundingProgressSteps.length} steps complete`}>
      {fundingProgressSteps.map((step, index) => {
        const complete = index < progress;

        return (
          <li
            key={step.key}
            className={`rounded-[16px] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] ${
              complete
                ? 'bg-[color-mix(in_srgb,var(--tg-button-color)_18%,var(--tg-section-bg-color))] text-[var(--tg-text-color)]'
                : 'bg-[var(--tg-section-bg-color)] text-[var(--tg-hint-color)]'
            }`}
          >
            <span className="sr-only">Step {index + 1}: </span>
            {step.label}
          </li>
        );
      })}
    </ol>
  );
}

function FundingRequestRow({
  request,
  onCopy,
  evidencePolicy,
  selectedEvidenceFile,
  evidenceReference,
  evidenceNote,
  uploading,
  onEvidenceFileChange,
  onEvidenceReferenceChange,
  onEvidenceNoteChange,
  onEvidenceUpload
}) {
  const meta = orderStatusMeta(request.status);
  const StatusIcon = meta.icon;
  const statusTone = meta.tone === 'danger'
    ? 'text-[var(--tg-destructive-text-color)]'
    : meta.tone === 'success'
      ? 'text-[var(--tg-button-color)]'
      : 'text-[var(--tg-hint-color)]';
  const reference = request.public_reference || request.payment_reference || request.id;
  const destination = request.destination_snapshot || {};
  const amount = requestAmount(request);

  return (
    <article className="rounded-[24px] bg-[var(--tg-secondary-bg-color)] p-4" aria-label={`Funding request ${reference}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-[var(--tg-text-color)]">{reference}</p>
          <p className={`mt-1 inline-flex items-center gap-1.5 text-xs font-black capitalize ${statusTone}`}>
            <StatusIcon size={13} />
            {meta.label}
          </p>
        </div>
        <span className="rounded-full bg-[var(--tg-section-bg-color)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--tg-hint-color)]">
          {Number(request.requested_points || 0).toLocaleString()} pts
        </span>
      </div>
      <FundingProgress status={request.status} />
      <div className="mt-4 grid gap-2 text-xs font-bold text-[var(--tg-subtitle-text-color)] sm:grid-cols-3">
        <span>{amount}</span>
        <span>{formatDate(request.created_at)}</span>
        <span>{request.payment_method ? titleCaseStatus(request.payment_method) : 'Manual Bank Transfer'}</span>
      </div>
      <p className="mt-3 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">{meta.body}</p>
      {canSubmitEvidence(request.status) ? (
        <div className="mt-3 rounded-[16px] bg-[var(--tg-section-bg-color)] p-3 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">
          <p className="font-black text-[var(--tg-text-color)]">Next step: submit payment evidence</p>
          <p className="mt-1">
            Pay exactly {amount}, include reference {reference}, then upload your receipt or screenshot here. Uploading evidence starts review only; it never credits points by itself.
          </p>
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--tg-hint-color)]">Payment Evidence</span>
              <input
                type="file"
                accept={(evidencePolicy?.allowed_mime_types || []).join(',') || 'image/jpeg,image/png,image/webp,application/pdf'}
                onChange={(event) => onEvidenceFileChange?.(request.id, event.target.files?.[0] || null)}
                className="mt-2 block w-full rounded-[16px] bg-[var(--tg-secondary-bg-color)] p-3 text-xs font-bold text-[var(--tg-text-color)] file:mr-3 file:rounded-full file:border-0 file:bg-[var(--tg-button-color)] file:px-3 file:py-2 file:text-xs file:font-black file:text-[var(--tg-button-text-color)]"
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--tg-hint-color)]">Bank Reference</span>
                <input
                  type="text"
                  value={evidenceReference || ''}
                  onChange={(event) => onEvidenceReferenceChange?.(request.id, event.target.value)}
                  placeholder="Optional transaction ID"
                  className="mt-2 w-full rounded-[16px] border border-[var(--miniapp-border-color)] bg-[var(--tg-secondary-bg-color)] px-3 py-3 text-xs font-bold text-[var(--tg-text-color)] outline-none focus:border-[var(--tg-button-color)]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--tg-hint-color)]">Note</span>
                <input
                  type="text"
                  value={evidenceNote || ''}
                  onChange={(event) => onEvidenceNoteChange?.(request.id, event.target.value)}
                  placeholder="Optional note"
                  className="mt-2 w-full rounded-[16px] border border-[var(--miniapp-border-color)] bg-[var(--tg-secondary-bg-color)] px-3 py-3 text-xs font-bold text-[var(--tg-text-color)] outline-none focus:border-[var(--tg-button-color)]"
                />
              </label>
            </div>
            {selectedEvidenceFile ? (
              <p className="rounded-[14px] bg-[var(--tg-secondary-bg-color)] p-2 text-[11px] font-bold text-[var(--tg-text-color)]">
                Selected: {selectedEvidenceFile.name} · {(selectedEvidenceFile.size / 1024 / 1024).toFixed(2)}MB
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => onEvidenceUpload?.(request)}
              disabled={!selectedEvidenceFile || uploading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[16px] bg-[var(--tg-button-color)] px-4 py-3 text-xs font-black text-[var(--tg-button-text-color)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? 'Uploading evidence…' : 'Upload Evidence'}
            </button>
          </div>
        </div>
      ) : null}
      {request.admin_note || request.rejection_reason ? (
        <p className="mt-3 rounded-[16px] bg-[var(--tg-section-bg-color)] p-3 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">
          {request.rejection_reason || request.admin_note}
        </p>
      ) : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => onCopy(reference, 'Funding reference')}
          className="inline-flex items-center justify-center gap-2 rounded-[16px] bg-[var(--tg-section-bg-color)] px-3 py-2 text-xs font-black text-[var(--tg-text-color)]"
        >
          <Copy size={14} />
          Copy reference
        </button>
        <button
          type="button"
          onClick={() => onCopy(destination.account_number || request.payment_reference, destination.account_number ? 'Account number' : 'Payment reference')}
          className="inline-flex items-center justify-center gap-2 rounded-[16px] bg-[var(--tg-section-bg-color)] px-3 py-2 text-xs font-black text-[var(--tg-text-color)]"
        >
          <Copy size={14} />
          Copy pay detail
        </button>
        <Link
          to="/miniapp/support"
          className="inline-flex items-center justify-center gap-2 rounded-[16px] bg-[var(--tg-button-color)] px-3 py-2 text-xs font-black text-[var(--tg-button-text-color)]"
        >
          Support handoff
          <ArrowRight size={14} />
        </Link>
      </div>
    </article>
  );
}

function FundingStatusCenter({ requests, evidencePolicy, onCopy, evidenceUploads }) {
  const activeRequest = requests.find((request) => ['PAYMENT_INSTRUCTIONS', 'PAYMENT_REPORTED', 'UNDER_REVIEW', 'NEEDS_MORE_INFORMATION'].includes(request.status)) || requests[0] || null;
  const renderRequest = (request) => {
    const draft = evidenceUploads?.drafts?.[request.id] || {};
    return (
      <FundingRequestRow
        key={request.id}
        request={request}
        onCopy={onCopy}
        evidencePolicy={evidencePolicy}
        selectedEvidenceFile={draft.file || null}
        evidenceReference={draft.reference || ''}
        evidenceNote={draft.note || ''}
        uploading={evidenceUploads?.uploadingEvidenceId === request.id}
        onEvidenceFileChange={evidenceUploads?.onEvidenceFileChange}
        onEvidenceReferenceChange={evidenceUploads?.onEvidenceReferenceChange}
        onEvidenceNoteChange={evidenceUploads?.onEvidenceNoteChange}
        onEvidenceUpload={evidenceUploads?.onEvidenceUpload}
      />
    );
  };

  return (
    <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm" aria-labelledby="funding-status-heading">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Funding status center</p>
          <h3 id="funding-status-heading" className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--tg-text-color)]">Track verification</h3>
          <p className="mt-2 text-sm font-bold leading-6 text-[var(--tg-subtitle-text-color)]">
            Points are credited only after finance approval and a successful ledger credit. Screenshot submission alone never changes your balance.
          </p>
        </div>
        <Clock3 size={24} className="shrink-0 text-[var(--tg-button-color)]" />
      </div>

      <div className="mt-4 rounded-[20px] bg-[var(--tg-secondary-bg-color)] p-4 text-xs font-bold leading-5 text-[var(--tg-subtitle-text-color)]">
        <p className="font-black text-[var(--tg-text-color)]">Evidence policy</p>
        <p className="mt-1">{evidenceSummary(evidencePolicy)}. Keep your funding reference visible where possible.</p>
      </div>

      <div className="mt-5 space-y-3">
        {activeRequest ? (
          renderRequest(activeRequest)
        ) : (
          <div className="rounded-[24px] bg-[var(--tg-secondary-bg-color)] p-5 text-center">
            <CheckCircle2 className="mx-auto text-[var(--tg-button-color)]" size={28} />
            <p className="mt-3 text-sm font-black text-[var(--tg-text-color)]">No funding requests yet</p>
            <p className="mt-1 text-xs font-bold leading-5 text-[var(--tg-hint-color)]">
              Create a backend-backed request to receive an exact amount, unique reference, and review status.
            </p>
          </div>
        )}
        {requests.filter((request) => request.id !== activeRequest?.id).slice(0, 3).map(renderRequest)}
      </div>
    </section>
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
    <SurfaceCard as="section" aria-label="Point order readiness" className="p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tg-hint-color)]">Order readiness</p>
          <h3 className="mt-2 text-2xl font-black text-[var(--tg-text-color)]">Ready before checkout</h3>
        </div>
        <ShieldCheck className="shrink-0 text-[var(--tg-button-color)]" size={26} />
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-4">
        {items.map((item) => (
          <SurfaceCard as="div" key={item.label} className="rounded-2xl bg-[var(--tg-secondary-bg-color)] p-3 shadow-none">
            {item.complete ? (
              <CheckCircle2 className="text-[var(--tg-button-color)]" size={18} />
            ) : (
              <AlertCircle className="text-[var(--tg-destructive-text-color)]" size={18} />
            )}
            <p className="mt-3 text-sm font-black text-[var(--tg-text-color)]">{item.label}</p>
            <p className="mt-1 text-xs font-bold text-[var(--tg-subtitle-text-color)]">{item.detail}</p>
          </SurfaceCard>
        ))}
      </div>
    </SurfaceCard>
  );
}

export default function MiniAppPointsWallet() {
  const {
    config,
    createPointsFundingRequest,
    profile,
    pointsFundingConfig,
    pointsFundingRequests,
    uploadPointsFundingEvidence,
    user
  } = useAppContext();
  const {
    configureMainButton,
    impact,
    notify
  } = useTelegramMiniApp();
  const packages = pointsFundingConfig?.packages || [];
  const paymentDestination = pointsFundingConfig?.payment_destination || null;
  const evidencePolicy = pointsFundingConfig?.evidence_policy || null;
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [creating, setCreating] = useState(false);
  const [evidenceDrafts, setEvidenceDrafts] = useState({});
  const [uploadingEvidenceId, setUploadingEvidenceId] = useState('');
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
    } catch {
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
    } catch {
      toast.error(`Unable to copy ${label.toLowerCase()}`);
      notify('error');
    }
  };

  const updateEvidenceDraft = (requestId, updates) => {
    setEvidenceDrafts((previous) => ({
      ...previous,
      [requestId]: {
        ...(previous[requestId] || {}),
        ...updates
      }
    }));
  };

  const selectEvidenceFile = (requestId, file) => {
    const allowedTypes = evidencePolicy?.allowed_mime_types || [];
    const maxBytes = Number(evidencePolicy?.max_size_bytes || evidencePolicy?.max_bytes || 0);
    if (!file) {
      updateEvidenceDraft(requestId, { file: null });
      return;
    }
    if (allowedTypes.length && !allowedTypes.includes(file.type)) {
      toast.error('Unsupported evidence file type');
      notify('error');
      return;
    }
    if (maxBytes && file.size > maxBytes) {
      toast.error(`Evidence must be ${Math.floor(maxBytes / 1024 / 1024)}MB or smaller`);
      notify('error');
      return;
    }
    updateEvidenceDraft(requestId, { file });
  };

  const uploadEvidence = async (request) => {
    const draft = evidenceDrafts[request.id] || {};
    if (!draft.file || uploadingEvidenceId) return;
    setUploadingEvidenceId(request.id);
    setOperationState({
      status: 'loading',
      title: 'Uploading payment evidence',
      description: 'Transferly is storing your evidence privately before finance review.'
    });
    try {
      const contentBase64 = await fileToBase64(draft.file);
      const result = await uploadPointsFundingEvidence(request.id, {
        fileName: draft.file.name,
        mimeType: draft.file.type,
        contentBase64,
        userTransactionReference: draft.reference || '',
        userNote: draft.note || ''
      });
      if (!result.success) {
        setOperationState({
          status: 'retry',
          title: 'Evidence upload failed',
          description: result.message || 'Your points were not credited. Retry the upload or contact support.'
        });
        toast.error(result.message || 'Evidence upload failed');
        notify('error');
        return;
      }
      setEvidenceDrafts((previous) => ({ ...previous, [request.id]: {} }));
      setOperationState({
        status: 'success',
        title: 'Evidence submitted for review',
        description: `${result.fundingRequest?.public_reference || request.public_reference} is under review. You do not need to submit another payment.`
      });
      toast.success('Evidence submitted for review');
      notify('success');
    } catch {
      setOperationState({
        status: 'retry',
        title: 'Evidence upload failed',
        description: 'Your points were not credited. Check your connection and retry the upload.'
      });
      toast.error('Evidence upload failed');
      notify('error');
    } finally {
      setUploadingEvidenceId('');
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

      <FundingStatusCenter
        requests={latestRequests}
        evidencePolicy={evidencePolicy}
        onCopy={copyText}
        evidenceUploads={{
          drafts: evidenceDrafts,
          uploadingEvidenceId,
          onEvidenceFileChange: selectEvidenceFile,
          onEvidenceReferenceChange: (requestId, reference) => updateEvidenceDraft(requestId, { reference }),
          onEvidenceNoteChange: (requestId, note) => updateEvidenceDraft(requestId, { note }),
          onEvidenceUpload: uploadEvidence
        }}
      />

      <section className="rounded-[30px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <PillStat label="Service action cost" value={`${Number(config?.default_service_point_charge || 250).toLocaleString()} pts`} tone="accent" />
          <PillStat label="Naira equivalent" value={`₦${Number(config?.default_service_point_charge || 250).toLocaleString('en-NG')}`} />
          <PillStat label="Funding method" value="Manual bank transfer" />
        </div>
        <Link to="/miniapp/orders" className="mt-4 flex items-center justify-center gap-2 rounded-[20px] bg-[var(--tg-secondary-bg-color)] px-5 py-3 text-sm font-black text-[var(--tg-text-color)] shadow-sm">
          Service orders
          <ArrowRight size={16} />
        </Link>
      </section>
    </div>
  );
}
