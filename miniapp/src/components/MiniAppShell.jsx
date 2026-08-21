import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bot,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Copy,
  HelpCircle,
  Home,
  Mail,
  Maximize2,
  Megaphone,
  MessageCircle,
  Minimize2,
  Moon,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Sun,
  Users,
  WalletCards,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';
import { useTelegramMiniApp } from '../context/TelegramMiniAppContext';
import AuthErrorRecoveryPanel from './AuthErrorRecoveryPanel';

const MiniAppCommandPalette = React.lazy(() => import('./miniapp/MiniAppCommandPalette'));

const railItems = [
  { label: 'Wallet Home', to: '/miniapp', icon: Home },
  { label: 'Services', to: '/miniapp/services', icon: Sparkles },
  { label: 'Vault', to: '/miniapp/vault', icon: Clock3 },
  { label: 'Studio', to: '/miniapp/studio', icon: Mail },
  { label: 'Referral', to: '/miniapp/profile', icon: Users },
  { label: 'Settings', to: '/miniapp/settings', icon: Settings }
];

const bottomItems = [
  { label: 'Wallet', to: '/miniapp', icon: Home },
  { label: 'Services', to: '/miniapp/services', icon: Sparkles },
  { label: 'Studio', to: '/miniapp/studio', icon: Mail },
  { label: 'Points', to: '/miniapp/wallet', icon: WalletCards },
  { label: 'Settings', to: '/miniapp/settings', icon: Settings }
];

const COMMUNITY_MODAL_KEY = 'transferly_telegram_modal_dismissed';
const THEME_STORAGE_KEY = 'transferly_miniapp_theme';

const communityPoints = [
  { icon: HelpCircle, text: 'Get help & answers to your questions' },
  { icon: WalletCards, text: 'Learn how to buy & manage points' },
  { icon: ShieldAlert, text: 'Report orders that have not released points' },
  { icon: Megaphone, text: 'Updates, tips & community support' }
];

function formatName(telegramUser, profile, user) {
  const telegramName = [telegramUser?.first_name, telegramUser?.last_name].filter(Boolean).join(' ');
  return telegramName || profile?.name || user?.name || user?.email || 'Transferly user';
}

function initialsFromName(displayName) {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0].toUpperCase())
    .join('') || 'TR';
}

function hasTelegramLaunch(telegram) {
  return Boolean(telegram.available || telegram.initData);
}

function getSessionLabel(telegram, telegramAuthState) {
  const launchDetected = hasTelegramLaunch(telegram);

  if (!launchDetected) {
    return 'Guest preview mode';
  }

  if (telegramAuthState === 'authenticated') {
    return 'Telegram session secured';
  }

  if (telegramAuthState === 'authenticating') {
    return 'Securing Telegram session';
  }

  if (telegramAuthState === 'failed') {
    return 'Telegram sign-in needs retry';
  }

  if (telegramAuthState === 'pending' || telegramAuthState === 'unavailable') {
    return 'Telegram session pending';
  }

  return 'Telegram session detected';
}

function getSessionTone(telegram, telegramAuthState, user) {
  const launchDetected = hasTelegramLaunch(telegram);

  if (telegramAuthState === 'failed') {
    return 'text-[var(--tg-destructive-text-color)]';
  }

  if (launchDetected && telegramAuthState === 'authenticated' && user?.id) {
    return 'text-emerald-500';
  }

  if (launchDetected || telegramAuthState === 'authenticating') {
    return 'text-[var(--tg-button-color)]';
  }

  return 'text-[var(--miniapp-shell-text-muted)]';
}

function readStoredThemeMode() {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  return window.localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
}

export default function MiniAppShell({
  children,
  title = 'Transferly Mini App',
  subtitle = 'Telegram-native command center',
  immersive = false
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, telegramAuthState, authState, lastInitializationIssue, retryInitialization } = useAppContext();
  const telegram = useTelegramMiniApp();
  const { configureBackButton, configureSettingsButton, impact } = telegram;
  const viewport = telegram.viewport || {};
  const displayMode = viewport.mode || telegram.displayMode || (hasTelegramLaunch(telegram) ? 'expanded' : 'browser');
  const isFullscreen = Boolean(viewport.isFullscreen);
  const supportsFullscreen = Boolean(viewport.supportsFullscreen);
  const shellStyle = useMemo(() => (
    viewport.stableHeight
      ? { '--miniapp-current-height': `${viewport.stableHeight}px` }
      : undefined
  ), [viewport.stableHeight]);
  const shellData = {
    mode: displayMode,
    orientation: viewport.orientation || 'portrait',
    platform: viewport.platform || telegram.platform || 'unknown'
  };
  const isRoot = location.pathname === '/miniapp';
  const [showCommunityModal, setShowCommunityModal] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [themeMode, setThemeMode] = useState(readStoredThemeMode);
  const displayName = formatName(telegram.user, profile, user);
  const initials = initialsFromName(displayName);
  const sessionLabel = getSessionLabel(telegram, telegramAuthState);
  const sessionTone = getSessionTone(telegram, telegramAuthState, user);
  const points = Number(profile?.points || 0);
  const currentScreen = isRoot ? 'home' : location.pathname.replace('/miniapp/', '') || 'home';
  const settingsPath = `/miniapp/settings?from=${encodeURIComponent(currentScreen)}`;
  const lightMode = themeMode === 'light';
  const shellClassName = `transferly-miniapp-skin ${lightMode ? 'transferly-miniapp-skin-light' : ''}`;
  const showCustomBackControl = isRoot || !hasTelegramLaunch(telegram);

  const referralLink = useMemo(() => {
    const referralCode = profile?.referral_code;
    return referralCode
      ? `https://t.me/TransferlyBot?start=${encodeURIComponent(referralCode)}`
      : 'https://t.me/TransferlyBot';
  }, [profile?.referral_code]);

  const copyReferral = async () => {
    if (!referralLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(referralLink);
      telegram.notify('success');
      toast.success('Referral link copied');
    } catch (_error) {
      telegram.notify('error');
      toast.error('Unable to copy referral link');
    }
  };

  const dismissCommunityModal = () => {
    setShowCommunityModal(false);
    try {
      window.localStorage.setItem(COMMUNITY_MODAL_KEY, 'true');
    } catch (_error) {
      // Ignore storage restrictions in embedded webviews.
    }
  };

  const toggleTheme = () => {
    const nextMode = lightMode ? 'dark' : 'light';
    setThemeMode(nextMode);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
    } catch (_error) {
      // Ignore storage restrictions in embedded webviews.
    }

    impact('light');
  };

  const toggleFullscreen = () => {
    const result = isFullscreen
      ? telegram.exitFullscreen?.()
      : telegram.requestFullscreen?.();

    if (!result?.ok) {
      toast.error(result?.reason === 'unsupported' ? 'Fullscreen is not supported on this Telegram client' : 'Unable to change fullscreen mode');
      telegram.notify('error');
      return;
    }

    telegram.impact('medium');
  };

  const openCommandPalette = useCallback(() => {
    impact('light');
    setCommandPaletteOpen(true);
  }, [impact]);

  const closeCommandPalette = useCallback(() => {
    setCommandPaletteOpen(false);
  }, []);

  const handleCommandSelected = useCallback(() => {
    impact('medium');
  }, [impact]);

  useEffect(() => {
    if (!isRoot || typeof window === 'undefined') {
      return;
    }

    try {
      setShowCommunityModal(window.localStorage.getItem(COMMUNITY_MODAL_KEY) !== 'true');
    } catch (_error) {
      setShowCommunityModal(true);
    }
  }, [isRoot]);

  const handleNativeBack = useCallback(() => {
    if (window.history.length > 1 && !isRoot) {
      navigate(-1);
    } else {
      navigate('/miniapp');
    }
  }, [isRoot, navigate]);

  useEffect(() => {
    return configureBackButton?.({
      visible: !isRoot,
      onClick: handleNativeBack
    });
  }, [configureBackButton, handleNativeBack, isRoot]);

  const handleNativeSettings = useCallback(() => {
    impact('light');
    navigate(settingsPath);
  }, [impact, navigate, settingsPath]);

  useEffect(() => {
    const cleanup = configureSettingsButton?.({
      visible: true,
      onClick: handleNativeSettings
    });

    return () => {
      cleanup?.();
    };
  }, [configureSettingsButton, handleNativeSettings]);

  const renderNavItem = (item, compact = false) => {
    const Icon = item.icon;
    const active = item.to === '/miniapp'
      ? location.pathname === '/miniapp'
      : location.pathname.startsWith(item.to);

    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={() => telegram.impact('light')}
        className={`miniapp-pressable miniapp-touch-target group relative flex min-w-0 items-center justify-center overflow-hidden ${
          compact
            ? `h-14 flex-col gap-1 rounded-[18px] px-1 text-center text-[10px] font-black ${active ? 'miniapp-active-shadow border border-[var(--miniapp-accent-border)] bg-[var(--miniapp-nav-active-bg)] text-[var(--miniapp-nav-active-text)]' : 'text-[var(--miniapp-nav-idle-text)] hover:bg-[var(--miniapp-nav-hover-bg)] hover:text-[var(--miniapp-shell-text)]'}`
            : `h-12 w-12 rounded-[19px] ${active ? 'miniapp-active-shadow border border-[var(--miniapp-accent-border)] bg-[var(--miniapp-nav-active-bg)] text-[var(--miniapp-nav-active-text)]' : 'text-[var(--miniapp-nav-idle-text)] hover:bg-[var(--miniapp-nav-hover-bg)] hover:text-[var(--miniapp-shell-text)]'}`
        }`}
        aria-label={`${item.label}${active ? ', current section' : ''}`}
        aria-current={active ? 'page' : undefined}
        title={item.label}
      >
        {active ? (
          <span
            aria-hidden="true"
            className={`absolute rounded-full ${
              compact
                ? 'inset-x-5 top-1 h-0.5 bg-[var(--tg-button-color)]'
                : 'left-1 top-1/2 h-5 w-1 -translate-y-1/2 bg-[var(--tg-button-color)]'
            }`}
          />
        ) : null}
        <Icon size={compact ? 18 : 20} className="relative z-10 shrink-0" aria-hidden="true" />
        {compact ? (
          <span className="relative z-10 max-w-full truncate leading-none">
            {active ? <span className="sr-only">Current section: </span> : null}
            {item.label}
          </span>
        ) : null}
      </Link>
    );
  };

  const renderFullscreenButton = () => {
    if (!supportsFullscreen && !isFullscreen) {
      return null;
    }

    return (
      <button
        type="button"
        onClick={toggleFullscreen}
        className="miniapp-pressable miniapp-touch-target inline-flex items-center justify-center rounded-full border border-[var(--miniapp-border-color)] bg-[var(--miniapp-panel-bg)] text-[var(--miniapp-shell-text-muted)] hover:text-[var(--miniapp-shell-text)]"
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {isFullscreen ? <Minimize2 size={17} aria-hidden="true" /> : <Maximize2 size={17} aria-hidden="true" />}
      </button>
    );
  };

  const bottomNavigation = (
    <nav
      className={`${shellClassName} miniapp-bottom-nav md:hidden`}
      aria-label="Transferly navigation"
      data-testid="miniapp-bottom-navigation"
      data-miniapp-mode={shellData.mode}
      data-miniapp-orientation={shellData.orientation}
      data-miniapp-platform={shellData.platform}
      style={shellStyle}
    >
      <div className="miniapp-bottom-nav-panel mx-auto grid max-w-[640px] grid-cols-5 gap-1 rounded-[24px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-bottom-panel-bg)] p-1 shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
        {bottomItems.map((item) => renderNavItem(item, true))}
      </div>
    </nav>
  );

  if (immersive) {
    return (
      <div
        className={`${shellClassName} miniapp-shell-root bg-[var(--tg-bg-color)] text-[var(--tg-text-color)]`}
        data-miniapp-mode={shellData.mode}
        data-miniapp-orientation={shellData.orientation}
        data-miniapp-platform={shellData.platform}
        style={shellStyle}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={`${shellClassName} miniapp-shell-root text-[var(--tg-text-color)]`}
      data-miniapp-mode={shellData.mode}
      data-miniapp-orientation={shellData.orientation}
      data-miniapp-platform={shellData.platform}
      style={shellStyle}
    >
      <div className="miniapp-shell-frame flex w-full">
        <aside className="miniapp-elevated-surface sticky top-0 hidden h-[var(--tg-viewport-stable-height)] w-[86px] shrink-0 flex-col items-center border-r border-[var(--miniapp-border-color)] bg-[var(--miniapp-shell-bg)] px-3 py-4 backdrop-blur-2xl md:flex">
          <Link
            to="/miniapp"
            className="miniapp-pressable miniapp-logo-mark flex h-[52px] w-[52px] items-center justify-center rounded-[23px] text-sm font-black"
            aria-label="Transferly dashboard"
          >
            TR
          </Link>

          <nav className="mt-8 flex flex-1 flex-col items-center gap-3">
            {railItems.map((item) => renderNavItem(item))}
          </nav>

          <a
            href="https://t.me/+DhQqLRVqOHpmMmQ0"
            target="_blank"
            rel="noreferrer"
            className="miniapp-pressable flex h-12 w-12 items-center justify-center rounded-full bg-[#229ed9] text-white shadow-[0_18px_40px_rgba(34,158,217,0.24)]"
            aria-label="Open Telegram community"
          >
            <MessageCircle size={20} aria-hidden="true" />
          </a>
        </aside>

        <div className="miniapp-shell-main flex min-w-0 flex-1 flex-col">
          <header className="miniapp-shell-header sticky top-0 z-30 border-b border-[var(--miniapp-border-color)] bg-[var(--miniapp-header-bg)] px-4 pb-3 shadow-[0_12px_44px_rgba(0,0,0,0.12)] backdrop-blur-2xl md:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {showCustomBackControl ? (
                  <button
                    type="button"
                    onClick={() => (isRoot ? telegram.webApp?.close?.() : navigate(-1))}
                    className="miniapp-pressable miniapp-touch-target flex shrink-0 items-center justify-center rounded-full border border-[var(--miniapp-border-color)] bg-[var(--miniapp-panel-bg)] text-[var(--miniapp-shell-text-muted)] md:hidden"
                    aria-label={isRoot ? 'Close Mini App' : 'Go back'}
                  >
                    <ChevronLeft size={18} aria-hidden="true" />
                  </button>
                ) : null}
                <Link
                  to="/miniapp"
                  className="miniapp-pressable miniapp-logo-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] text-xs font-black md:hidden"
                  aria-label="Transferly dashboard"
                >
                  TR
                </Link>
                <div className="min-w-0 md:hidden">
                  <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-[var(--miniapp-shell-text-muted)]">
                    {subtitle}
                  </p>
                  <h1 className="truncate text-lg font-black text-[var(--miniapp-shell-text)] md:text-xl">
                    {title}
                  </h1>
                </div>
                <button
                  type="button"
                  onClick={copyReferral}
                  aria-label="Copy referral link"
                  title="Copy referral link"
                  className="miniapp-pressable hidden items-center gap-2 rounded-full border border-[var(--miniapp-border-color)] bg-[var(--miniapp-panel-bg)] px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--miniapp-shell-text-muted)] hover:text-[var(--miniapp-shell-text)] md:inline-flex"
                >
                  <Users size={14} className="text-[var(--tg-button-color)]" aria-hidden="true" />
                  Referred: {Number(profile?.referral_count || 0).toLocaleString()}
                  <Copy size={13} aria-hidden="true" />
                </button>
              </div>

              <div className="hidden min-w-0 items-center gap-3 sm:flex">
                <button
                  type="button"
                  onClick={openCommandPalette}
                  className="miniapp-pressable miniapp-touch-target inline-flex items-center gap-2 rounded-full border border-[var(--miniapp-border-color)] bg-[var(--miniapp-panel-bg)] px-3 text-sm font-black text-[var(--miniapp-shell-text-muted)] hover:text-[var(--miniapp-shell-text)]"
                  aria-label="Open Transferly command search"
                  title="Open Transferly command search"
                >
                  <Search size={17} aria-hidden="true" />
                  <span className="hidden lg:inline">Search</span>
                </button>
                <Link
                  to="/miniapp/profile"
                  className="miniapp-pressable miniapp-touch-target inline-flex items-center gap-2 rounded-full border border-[var(--miniapp-border-color)] bg-[var(--miniapp-panel-bg)] px-2.5 py-2 text-[var(--miniapp-shell-text)]"
                  aria-label={`${initials} ${displayName} profile, ${points.toLocaleString()} points`}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--tg-button-color)] text-xs font-black text-[var(--tg-button-text-color)]">
                    {initials}
                  </span>
                  <span className="hidden min-w-0 text-left md:block">
                    <span className="block max-w-[120px] truncate text-xs font-black">{displayName}</span>
                    <span className="block text-[11px] font-black text-[var(--miniapp-shell-text-muted)]">{points.toLocaleString()}pts</span>
                  </span>
                </Link>
                {renderFullscreenButton()}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="miniapp-pressable miniapp-touch-target inline-flex items-center justify-center rounded-full border border-[var(--miniapp-border-color)] bg-[var(--miniapp-panel-bg)] text-[var(--miniapp-shell-text-muted)] hover:text-[var(--miniapp-shell-text)]"
                  aria-label="Toggle theme"
                  title="Toggle theme"
                >
                  {lightMode ? <Moon size={17} aria-hidden="true" /> : <Sun size={17} aria-hidden="true" />}
                </button>
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:hidden">
              <div className="flex items-center justify-between gap-3 rounded-[18px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-panel-bg)] px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-black text-[var(--miniapp-shell-text-muted)]">{sessionLabel}</p>
                  <p className="truncate text-sm font-black text-[var(--miniapp-shell-text)]">{displayName}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={openCommandPalette}
                    className="miniapp-pressable miniapp-touch-target flex items-center justify-center rounded-full bg-[var(--tg-secondary-bg-color)] text-[var(--tg-text-color)]"
                    aria-label="Open Transferly command search"
                    title="Open Transferly command search"
                  >
                    <Search size={16} aria-hidden="true" />
                  </button>
                  {renderFullscreenButton()}
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="miniapp-pressable miniapp-touch-target flex items-center justify-center rounded-full bg-[var(--tg-secondary-bg-color)] text-[var(--tg-text-color)]"
                    aria-label="Toggle theme"
                    title="Toggle theme"
                  >
                    {lightMode ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
                  </button>
                  <Link
                    to="/miniapp/wallet"
                    aria-label={`Open points wallet with ${points.toLocaleString()} points`}
                    className="miniapp-pressable miniapp-touch-target inline-flex items-center rounded-full bg-[var(--tg-button-color)] px-3 py-2 text-xs font-black text-[var(--tg-button-text-color)]"
                  >
                    {points.toLocaleString()}pts
                  </Link>
                </div>
              </div>
            </div>
          </header>

          <main
            className="miniapp-shell-content mx-auto w-full max-w-[1100px] flex-1 px-4 py-4 md:px-6 md:py-6"
            data-testid="miniapp-shell-content"
          >
            {children}
          </main>

          {typeof document === 'undefined' ? bottomNavigation : createPortal(bottomNavigation, document.body)}

          <div
            className={`pointer-events-none fixed right-4 top-[96px] hidden rounded-full border border-[var(--miniapp-border-color)] bg-[var(--miniapp-panel-bg)] px-3 py-2 text-xs font-black shadow-lg lg:flex lg:items-center lg:gap-2 ${sessionTone}`}
            role="status"
            aria-live="polite"
            aria-label={sessionLabel}
          >
            <Bot size={14} aria-hidden="true" />
            {sessionLabel}
          </div>

          <AuthErrorRecoveryPanel
            authState={authState}
            initializationIssue={lastInitializationIssue}
            onRetry={retryInitialization}
          />

          <Suspense fallback={null}>
            <MiniAppCommandPalette
              open={commandPaletteOpen}
              onClose={closeCommandPalette}
              onCommand={handleCommandSelected}
            />
          </Suspense>

          {showCommunityModal ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 px-4 py-6 backdrop-blur-sm">
              <section
                className="miniapp-enter relative w-full max-w-[420px] rounded-[30px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-card-bg)] p-5 text-[var(--tg-text-color)] shadow-[0_26px_90px_rgba(0,0,0,0.6)]"
                role="dialog"
                aria-modal="true"
                aria-labelledby="transferly-community-title"
                aria-describedby="transferly-community-description"
              >
                <button
                  type="button"
                  onClick={dismissCommunityModal}
                  className="miniapp-pressable miniapp-touch-target absolute right-4 top-4 flex items-center justify-center rounded-full bg-[var(--miniapp-accent-soft)] text-[var(--miniapp-shell-text-muted)] hover:text-[var(--miniapp-shell-text)]"
                  aria-label="Close community prompt"
                >
                  <X size={18} aria-hidden="true" />
                </button>
                <div className="miniapp-brand-mark flex h-16 w-16 items-center justify-center rounded-[24px] bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]">
                  <MessageCircle size={30} aria-hidden="true" />
                </div>
                <h2 id="transferly-community-title" className="mt-5 pr-10 text-2xl font-black tracking-[-0.04em]">Join our Telegram Community</h2>
                <p id="transferly-community-description" className="mt-2 text-sm font-semibold leading-6 text-[var(--miniapp-shell-text-muted)]">
                  Stay connected for updates, support & more.
                </p>

                <div className="mt-5 space-y-2">
                  {communityPoints.map((point) => {
                    const Icon = point.icon;
                    return (
                      <div key={point.text} className="flex items-center gap-3 rounded-[20px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-panel-bg)] px-3 py-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[15px] bg-[var(--miniapp-accent-soft)] text-[var(--tg-button-color)]">
                          <Icon size={18} aria-hidden="true" />
                        </span>
                        <span className="text-sm font-bold leading-5 text-[var(--miniapp-shell-text)]">{point.text}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 grid gap-3">
                  <a
                    href="https://t.me/+DhQqLRVqOHpmMmQ0"
                    target="_blank"
                    rel="noreferrer"
                    onClick={dismissCommunityModal}
                    aria-label="Join Transferly Telegram community channel"
                    className="miniapp-pressable miniapp-touch-target miniapp-brand-mark flex items-center justify-center gap-2 rounded-[20px] bg-[var(--tg-button-color)] px-5 py-3 text-sm font-black text-[var(--tg-button-text-color)]"
                  >
                    <MessageCircle size={17} aria-hidden="true" />
                    Join Telegram Channel
                  </a>
                  <button
                    type="button"
                    onClick={dismissCommunityModal}
                    aria-label="Dismiss community prompt because I already joined"
                    className="miniapp-pressable miniapp-touch-target flex items-center justify-center gap-2 rounded-[20px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-panel-bg)] px-5 py-3 text-sm font-black text-[var(--miniapp-shell-text)]"
                  >
                    <CheckCircle2 size={17} aria-hidden="true" />
                    I've already joined
                  </button>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
