import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  ChevronLeft,
  FileCheck2,
  FlaskConical,
  RefreshCw,
  ShieldAlert,
  WalletCards,
  Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';
import { useTelegramMiniApp } from '../context/TelegramMiniAppContext';
import { SANDBOX_REQUIRED_MARKINGS } from '../lib/serviceCatalogueContract';

const steps = ['Safety', 'Test data', 'Review'];

function createReference() {
  return `TEST-${Math.random().toString(36).slice(2, 12).toUpperCase()}`;
}

function createSessionId() {
  return `SANDBOX-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getNow() {
  return new Date().toTimeString().slice(0, 5);
}

function newSandboxForm() {
  return {
    senderName: '',
    senderAccount: '',
    senderBank: 'Sandbox Source',
    receiverName: '',
    receiverAccount: '',
    receiverBank: 'Sandbox Destination',
    amount: '',
    transactionDate: getToday(),
    transactionTime: getNow(),
    transactionRef: createReference(),
    narration: '',
    sessionId: createSessionId(),
    status: 'Test only'
  };
}

function StudioField({ label, children }) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase text-[var(--tg-hint-color)]">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

const fieldClass = 'w-full rounded-[8px] border border-black/10 bg-[var(--tg-secondary-bg-color)] px-4 py-3 text-sm font-bold text-[var(--tg-text-color)] outline-none transition placeholder:text-[var(--tg-hint-color)] focus:border-[var(--tg-button-color)]';

function Progress({ step }) {
  return (
    <div className="grid grid-cols-3 gap-2" role="list" aria-label="Sandbox generation progress">
      {steps.map((label, index) => (
        <div
          key={label}
          role="listitem"
          aria-current={index === step ? 'step' : undefined}
          className={`rounded-[8px] px-3 py-2 text-center text-[10px] font-black uppercase ${
            index <= step
              ? 'bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]'
              : 'bg-[var(--tg-section-bg-color)] text-[var(--tg-hint-color)]'
          }`}
        >
          {label}
        </div>
      ))}
    </div>
  );
}

function SafetyBanner() {
  return (
    <section className="rounded-[8px] border border-amber-500/40 bg-amber-500/10 p-5" aria-label="Sandbox safety notice">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 shrink-0 text-amber-600" size={24} aria-hidden="true" />
        <div>
          <p className="text-xs font-black uppercase text-amber-700">Permanent output markings</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SANDBOX_REQUIRED_MARKINGS.map((marking) => (
              <span key={marking} className="rounded-[6px] bg-amber-600 px-2.5 py-1 text-[10px] font-black uppercase text-white">
                {marking}
              </span>
            ))}
          </div>
          <p className="mt-3 text-sm font-semibold leading-6 text-[var(--tg-text-color)]">
            This studio creates test data for QA and training. It cannot create a real payment record or a provider-issued receipt.
          </p>
        </div>
      </div>
    </section>
  );
}

function SandboxPreview({ form }) {
  return (
    <section className="rounded-[8px] border-2 border-dashed border-amber-500 bg-[var(--tg-section-bg-color)] p-5" aria-label="Sandbox test data preview">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase text-amber-600">SANDBOX / TEST</p>
          <h3 className="mt-2 text-xl font-black text-[var(--tg-text-color)]">Test transaction data</h3>
        </div>
        <FlaskConical className="text-amber-600" size={26} aria-hidden="true" />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {[
          ['Source', form.senderName || 'Not entered'],
          ['Destination', form.receiverName || 'Not entered'],
          ['Test amount', form.amount || 'Not entered'],
          ['Reference', form.transactionRef],
          ['Narration', form.narration || 'Not entered'],
          ['Status', 'TEST DATA ONLY']
        ].map(([label, value]) => (
          <div key={label} className="rounded-[8px] bg-[var(--tg-secondary-bg-color)] p-3">
            <p className="text-[10px] font-black uppercase text-[var(--tg-hint-color)]">{label}</p>
            <p className="mt-1 break-words text-sm font-bold text-[var(--tg-text-color)]">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 border-t border-amber-500/30 pt-4 text-center text-xs font-black uppercase text-amber-700">
        NOT PROOF OF PAYMENT
      </p>
    </section>
  );
}

export default function MiniAppReceiptStudio() {
  const { addReceipt, config, profile, user } = useAppContext();
  const {
    configureClosingConfirmation,
    configureMainButton,
    configureVerticalSwipe,
    impact,
    notify,
    webApp
  } = useTelegramMiniApp();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(newSandboxForm);
  const [generating, setGenerating] = useState(false);
  const [generatedReceipt, setGeneratedReceipt] = useState(null);

  const cost = Number(config?.bank_slip_cost || 10);
  const points = Number(profile?.points || 0);
  const authenticated = Boolean(user?.id);
  const hasEnoughPoints = points >= cost;
  const qualityChecks = useMemo(() => [
    Boolean(form.senderName && form.receiverName),
    Boolean(form.amount && form.transactionDate && form.transactionTime),
    Boolean(form.transactionRef && form.sessionId),
    Boolean(form.narration && form.status)
  ], [form]);
  const qualityScore = Math.round((qualityChecks.filter(Boolean).length / qualityChecks.length) * 100);
  const detailsComplete = qualityChecks.every(Boolean);
  const canContinue = step === 0 || (step === 1 && detailsComplete) || (step === 2 && authenticated && hasEnoughPoints && detailsComplete);
  const hasDraft = !generatedReceipt && (step > 0 || Boolean(form.senderName || form.receiverName || form.amount || form.narration));

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleGenerate = useCallback(async () => {
    if (generating) return;
    if (!authenticated) {
      toast.error('Open Transferly from Telegram to generate sandbox test data');
      return;
    }
    if (!hasEnoughPoints) {
      toast.error(`You need ${cost} points. Current balance: ${points} pts`);
      return;
    }
    if (!detailsComplete) {
      toast.error('Complete all required test-data fields');
      return;
    }

    setGenerating(true);
    impact('medium');
    webApp?.MainButton?.showProgress?.();

    try {
      const result = await addReceipt({ type: 'bank', serviceSlug: 'faker-data', ...form });
      if (result?.error) {
        toast.error(result.error);
        notify('error');
        return;
      }
      setGeneratedReceipt(result);
      notify('success');
      toast.success('Sandbox test data generated');
    } catch (_error) {
      notify('error');
      toast.error('Failed to generate sandbox test data');
    } finally {
      setGenerating(false);
      webApp?.MainButton?.hideProgress?.();
    }
  }, [addReceipt, authenticated, cost, detailsComplete, form, generating, hasEnoughPoints, impact, notify, points, webApp]);

  const goForward = useCallback(() => {
    if (step < 2) {
      if (!canContinue) {
        toast.error('Complete all required test-data fields');
        return;
      }
      setStep((current) => current + 1);
      impact('light');
      return;
    }
    handleGenerate();
  }, [canContinue, handleGenerate, impact, step]);

  const createAnother = useCallback(() => {
    setGeneratedReceipt(null);
    setForm(newSandboxForm());
    setStep(0);
  }, []);

  useEffect(() => configureMainButton?.({
    text: generatedReceipt ? 'Create Another' : step < 2 ? 'Continue' : 'Generate Test Data',
    enabled: generatedReceipt ? true : canContinue,
    loading: generating,
    onClick: generatedReceipt ? createAnother : goForward
  }), [canContinue, configureMainButton, createAnother, generatedReceipt, generating, goForward, step]);

  useEffect(() => {
    configureClosingConfirmation?.(hasDraft);
    configureVerticalSwipe?.(step !== 1);
    return () => {
      configureClosingConfirmation?.(false);
      configureVerticalSwipe?.(true);
    };
  }, [configureClosingConfirmation, configureVerticalSwipe, hasDraft, step]);

  return (
    <div className="space-y-4">
      <Progress step={step} />
      <section className="rounded-[8px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[8px] bg-amber-600 text-white">
            <FlaskConical size={24} aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-black uppercase text-amber-600">Sandbox tool</p>
            <h2 className="mt-2 text-2xl font-black text-[var(--tg-text-color)]">Receipt Studio</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--tg-subtitle-text-color)]">
              Create permanently marked test transaction data for QA, demos, and internal training.
            </p>
          </div>
        </div>
      </section>

      <SafetyBanner />

      {step === 0 ? (
        <section className="rounded-[8px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <FileCheck2 className="shrink-0 text-[var(--tg-button-color)]" size={24} aria-hidden="true" />
            <div>
              <h3 className="text-lg font-black text-[var(--tg-text-color)]">Sandbox output only</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--tg-subtitle-text-color)]">
                The generator uses neutral labels and test references. Provider brands, real payment claims, and proof-of-payment language are not available.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
          <section className="rounded-[8px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
            <h3 className="text-xl font-black text-[var(--tg-text-color)]">Test data details</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <StudioField label="Sender name"><input className={fieldClass} value={form.senderName} onChange={(event) => update('senderName', event.target.value)} placeholder="Test sender" /></StudioField>
              <StudioField label="Receiver name"><input className={fieldClass} value={form.receiverName} onChange={(event) => update('receiverName', event.target.value)} placeholder="Test receiver" /></StudioField>
              <StudioField label="Amount"><input inputMode="decimal" className={fieldClass} value={form.amount} onChange={(event) => update('amount', event.target.value)} placeholder="25000" /></StudioField>
              <StudioField label="Reference"><input className={fieldClass} value={form.transactionRef} onChange={(event) => update('transactionRef', event.target.value)} /></StudioField>
              <StudioField label="Date"><input type="date" className={fieldClass} value={form.transactionDate} onChange={(event) => update('transactionDate', event.target.value)} /></StudioField>
              <StudioField label="Time"><input type="time" className={fieldClass} value={form.transactionTime} onChange={(event) => update('transactionTime', event.target.value)} /></StudioField>
              <div className="sm:col-span-2">
                <StudioField label="Narration"><textarea className={`${fieldClass} min-h-[104px] resize-none`} value={form.narration} onChange={(event) => update('narration', event.target.value)} placeholder="QA scenario description" /></StudioField>
              </div>
            </div>
          </section>
          <div className="space-y-4">
            <section className="rounded-[8px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm" aria-label="Sandbox data quality">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-[var(--tg-text-color)]">Required fields</p>
                <p className="text-xl font-black text-[var(--tg-button-color)]">{qualityScore}%</p>
              </div>
            </section>
            <SandboxPreview form={form} />
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <SandboxPreview form={form} />
          <section className="rounded-[8px] bg-[var(--tg-section-bg-color)] p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]">
                {generatedReceipt ? <BadgeCheck size={22} aria-hidden="true" /> : <WalletCards size={22} aria-hidden="true" />}
              </div>
              <div>
                <p className="text-xs font-black uppercase text-[var(--tg-hint-color)]">{generatedReceipt ? 'Saved' : 'Generation cost'}</p>
                <p className="mt-1 text-lg font-black text-[var(--tg-text-color)]">{generatedReceipt ? 'Sandbox record saved to vault' : `${cost} points`}</p>
              </div>
            </div>
            <p className="mt-4 text-center text-xl font-black text-[var(--tg-button-color)]">{qualityScore}%</p>
            {!authenticated ? <p className="mt-4 text-xs font-bold text-[var(--tg-destructive-text-color)]">Open Transferly from Telegram before generating.</p> : null}
            {authenticated && !hasEnoughPoints ? <p className="mt-4 text-xs font-bold text-amber-700">Balance: {points.toLocaleString()} points. Top up before generating.</p> : null}
            {generatedReceipt ? (
              <div className="mt-4 grid gap-2">
                <Link to="/miniapp/vault" className="flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-[var(--tg-button-color)] px-4 py-3 text-sm font-black text-[var(--tg-button-text-color)]">Open vault <ArrowRight size={16} aria-hidden="true" /></Link>
                <button type="button" onClick={createAnother} className="flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-[var(--tg-secondary-bg-color)] px-4 py-3 text-sm font-black text-[var(--tg-text-color)]"><RefreshCw size={16} aria-hidden="true" />Create another</button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {step > 0 && !generatedReceipt ? (
          <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} className="flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-[var(--tg-section-bg-color)] px-5 py-3 text-sm font-black text-[var(--tg-text-color)] shadow-sm"><ChevronLeft size={16} aria-hidden="true" />Back</button>
        ) : null}
        {!generatedReceipt ? (
          <button type="button" onClick={goForward} disabled={generating} aria-label={step < 2 ? 'Continue sandbox setup' : 'Generate test data'} aria-busy={generating ? 'true' : 'false'} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[8px] bg-[var(--tg-button-color)] px-5 py-3 text-sm font-black text-[var(--tg-button-text-color)] shadow-sm disabled:opacity-60 sm:flex-none">
            {step < 2 ? 'Continue' : generating ? 'Generating' : 'Generate test data'}
            {step < 2 ? <ArrowRight size={16} aria-hidden="true" /> : <Zap size={16} aria-hidden="true" />}
          </button>
        ) : null}
      </div>
    </div>
  );
}
