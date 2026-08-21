const assert = require("node:assert/strict");
const test = require("node:test");

process.env.ADMIN_TELEGRAM_ID ||= "1001";
process.env.ADMIN_TELEGRAM_USERNAME ||= "admin";
process.env.API_URL ||= "http://localhost:3000";
process.env.BOT_TOKEN ||= "123456:test-token";
process.env.ADMIN_API_TOKEN ||= "admin-token";
process.env.MINI_APP_URL ||= "https://mini.transferly.test";

const {
  SCREEN_TYPES,
  BOT_UX_BOUNDARY,
  CONTROL_ACTIONS,
  CONTROL_LABELS,
  PRIMARY_MINI_APP_LABEL,
  TELEGRAM_COMMANDS,
  MINI_APP_SECTIONS,
  buildMiniAppButton,
  buildMiniAppUrl,
  isMiniAppDelegatedAction,
  runtimeStatusPayload,
  buildScreenKeyboard,
  buildStartKeyboard,
  buildMainMenuKeyboard,
  buildCommandHubKeyboard,
  buildSupportKeyboard,
  buildCommandSectionKeyboard,
  formatCommandSectionBody,
  buildProvidersKeyboard,
  buildInvoiceCenterKeyboard,
  buildPayoutCenterKeyboard,
  buildOpsCommandCenterKeyboard,
  buildBackKeyboard,
  buildUsersKeyboard,
  buildUsersListKeyboard,
  buildUserDetailKeyboard,
  buildUsersAuditKeyboard,
  buildPaymentAuditKeyboard,
  buildBotAnalyticsKeyboard,
  buildSubscriptionAlertsKeyboard,
  buildSubscriptionDurationKeyboard,
  buildUserConfirmKeyboard,
  buildServiceGroupsKeyboard,
  buildServiceDetailKeyboard,
  buildServiceLaneKeyboard,
  buildServiceSearchResultsKeyboard,
  buildProviderWorkspaceKeyboard,
  buildPayPalWorkspaceKeyboard,
  buildPayPalListKeyboard,
  buildInvoiceDetailKeyboard,
  buildInvoiceResultKeyboard,
  buildPayoutDetailKeyboard,
  buildPayoutResultKeyboard,
  buildCallbackRecoveryKeyboard,
  classifyBotError,
  invoiceReleaseGuard,
  payoutActionGuard,
  rememberScreen,
  prepareNavigationAction,
  popBackAction,
  resetNavigation,
} = require("../bot");
const { handlePublicCallback } = require("../callbacks/public");
const {
  SERVICE_CATALOG,
  searchServices,
  canGenerateService,
  getServiceCommandCenter,
  getServiceLane,
} = require("../utils/serviceCatalog");
const { ROLES, STATUS, CAPABILITIES, hasCapability, getActionCapability, getCommandCapability } = require("../utils/capabilities");
const { initialSessionState } = require("../utils/sessionState");

function ctx() {
  return {
    session: initialSessionState(),
  };
}

function labels(keyboard) {
  return (keyboard.inline_keyboard || []).flat().map((button) => button.text);
}

function callbackActions(keyboard) {
  return (keyboard.inline_keyboard || [])
    .flat()
    .map((button) => button.callback_data)
    .filter(Boolean)
    .map((data) => {
      const value = String(data);
      return value.startsWith("cb|") ? value.split("|")[1] : value;
    });
}

test("visible Telegram command menu stays intentionally small", () => {
  assert.deepEqual(
    TELEGRAM_COMMANDS.map((command) => command.command),
    BOT_UX_BOUNDARY.visibleCommands,
  );
  assert.deepEqual(BOT_UX_BOUNDARY.miniAppOwnedAreas, [
    "dashboard",
    "services",
    "payments",
    "wallet",
    "settings",
    "advanced workflows",
  ]);
});

test("start launcher exposes one primary Mini App entry point", () => {
  const startLabels = labels(buildStartKeyboard(ctx(), { role: ROLES.OWNER, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: true, isOwner: true }));
  assert.deepEqual(startLabels, [
    PRIMARY_MINI_APP_LABEL,
    CONTROL_LABELS.account,
    CONTROL_LABELS.notifications,
    CONTROL_LABELS.settings,
    CONTROL_LABELS.help,
  ]);
  assert.equal(startLabels.filter((label) => label.includes("Open")).length, 1);
  assert.equal(startLabels.includes("💳 Providers"), false);
  assert.equal(startLabels.includes("🧰 Services"), false);
  assert.equal(startLabels.includes("📄 Invoices"), false);
  assert.equal(startLabels.includes("👥 Users"), false);
});

test("mini app launch URLs use the exact configured launcher URL", () => {
  assert.equal(buildMiniAppUrl("home"), "https://mini.transferly.test");
  assert.equal(buildMiniAppUrl("dashboard"), "https://mini.transferly.test");
  assert.equal(buildMiniAppUrl("invoices"), "https://mini.transferly.test");
  assert.equal(buildMiniAppUrl("generate"), "https://mini.transferly.test");
  assert.equal(buildMiniAppUrl("history"), "https://mini.transferly.test");
  assert.equal(buildMiniAppUrl("wallet"), "https://mini.transferly.test");
  assert.equal(buildMiniAppUrl("services/paypal/invoices"), "https://mini.transferly.test");
  assert.equal(buildMiniAppUrl("../admin"), "https://mini.transferly.test");
});

test("known Mini App route contract remains delegated to the same launcher", () => {
  for (const section of Object.keys(MINI_APP_SECTIONS)) {
    const url = buildMiniAppUrl(section);
    assert.equal(url, "https://mini.transferly.test");
  }
});

test("runtime status does not expose configured tokens", () => {
  const payload = runtimeStatusPayload();
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes(process.env.BOT_TOKEN), false);
  assert.equal(serialized.includes(process.env.ADMIN_API_TOKEN), false);
  assert.equal(payload.miniApp.primarySection, "dashboard");
  assert.equal(payload.updates.allowedUpdates.includes("message"), true);
});

test("mini app buttons use Telegram Web App launch by default", () => {
  assert.deepEqual(buildMiniAppButton(PRIMARY_MINI_APP_LABEL, "dashboard"), {
    text: PRIMARY_MINI_APP_LABEL,
    web_app: {
      url: "https://mini.transferly.test",
    },
  });
  assert.deepEqual(buildMiniAppButton(PRIMARY_MINI_APP_LABEL, "dashboard", { forceUrl: true }), {
    text: PRIMARY_MINI_APP_LABEL,
    url: "https://mini.transferly.test",
  });
});

test("primary control menu exposes focused account notification settings callbacks", () => {
  const actions = callbackActions(buildStartKeyboard(ctx(), { role: ROLES.USER, status: STATUS.ACTIVE, isAuthorized: true }));

  assert.deepEqual(actions, [
    CONTROL_ACTIONS.ACCOUNT,
    CONTROL_ACTIONS.NOTIFICATIONS,
    CONTROL_ACTIONS.SETTINGS,
    CONTROL_ACTIONS.HELP,
  ]);
});

test("main menu is role-aware", () => {
  const guestLabels = labels(buildMainMenuKeyboard(ctx(), { role: ROLES.GUEST, isAuthorized: false }));
  assert.deepEqual(guestLabels.slice(0, 3), ["🚀 Open Transferly", CONTROL_LABELS.account, CONTROL_LABELS.notifications]);
  assert.equal(guestLabels.includes("🏦 Wallet Records"), false);

  const userLabels = labels(buildMainMenuKeyboard(ctx(), { role: ROLES.USER, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: false }));
  assert.ok(userLabels.includes("🚀 Open Transferly"));
  assert.ok(userLabels.includes(CONTROL_LABELS.account));
  assert.ok(userLabels.includes(CONTROL_LABELS.notifications));
  assert.ok(userLabels.includes(CONTROL_LABELS.settings));
  assert.ok(userLabels.includes(CONTROL_LABELS.help));
  assert.equal(userLabels.includes("💳 Providers"), false);
  assert.equal(userLabels.includes("🧰 Services"), false);
  assert.equal(userLabels.includes("📊 Activity"), false);
  assert.equal(userLabels.includes("🏦 Wallet Records"), false);
  assert.equal(userLabels.includes("🧾 Receipts"), false);
  assert.equal(userLabels.includes("📄 Invoices"), false);
  assert.equal(userLabels.includes("💸 Payouts"), false);
  assert.equal(userLabels.includes("👥 Users"), false);

  const adminLabels = labels(buildMainMenuKeyboard(ctx(), { role: ROLES.ADMIN, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: true }));
  assert.ok(adminLabels.includes("🚀 Open Transferly"));
  assert.ok(adminLabels.includes(CONTROL_LABELS.settings));
  assert.equal(adminLabels.includes("📄 Invoices"), false);
  assert.equal(adminLabels.includes("💸 Payouts"), false);
  assert.equal(adminLabels.includes("📊 Activity"), false);
  assert.equal(adminLabels.includes("🛡️ Risk"), false);
  assert.equal(adminLabels.includes("🔐 Security"), false);
  assert.equal(adminLabels.includes("🤖 Bot Ops"), false);
  assert.equal(adminLabels.includes("👥 Users"), false);

  const ownerLabels = labels(buildMainMenuKeyboard(ctx(), { role: ROLES.OWNER, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: true, isOwner: true }));
  assert.ok(ownerLabels.includes("🚀 Open Transferly"));
  assert.ok(ownerLabels.includes(CONTROL_LABELS.settings));
  assert.equal(ownerLabels.includes("👥 Users"), false);
});

test("command hub stays launcher-first and minimal", () => {
  const guestLabels = labels(buildCommandHubKeyboard(ctx(), { role: ROLES.GUEST, isAuthorized: false }));
  assert.deepEqual(guestLabels.slice(0, 3), ["🚀 Open Transferly", CONTROL_LABELS.account, CONTROL_LABELS.notifications]);

  const userCtx = ctx();
  userCtx.session.lastProvider = "stripe";
  const userLabels = labels(buildCommandHubKeyboard(userCtx, { role: ROLES.USER, status: STATUS.ACTIVE, isAuthorized: true }));
  assert.ok(userLabels.includes("🚀 Open Transferly"));
  assert.ok(userLabels.includes(CONTROL_LABELS.account));
  assert.ok(userLabels.includes(CONTROL_LABELS.notifications));
  assert.ok(userLabels.includes(CONTROL_LABELS.settings));
  assert.ok(userLabels.includes(CONTROL_LABELS.help));
  assert.equal(userLabels.includes("↩️ Continue Stripe"), false);
  assert.equal(userLabels.includes("🧾 Collect"), false);
  assert.equal(userLabels.includes("💸 Send"), false);
  assert.equal(userLabels.includes("🏦 Account"), false);
  assert.equal(userLabels.includes("🧩 Operations"), false);

  const adminLabels = labels(buildCommandHubKeyboard(ctx(), { role: ROLES.ADMIN, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: true }));
  assert.ok(adminLabels.includes(CONTROL_LABELS.settings));
  assert.equal(adminLabels.includes("🧩 Operations"), false);
  assert.equal(adminLabels.includes("📊 Activity"), false);
  assert.equal(adminLabels.includes("📈 Analytics"), false);
  assert.equal(adminLabels.includes("🔐 Security"), false);
});

test("legacy command section callbacks return minimal navigation", () => {
  const admin = { role: ROLES.ADMIN, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: true };
  const collectKeyboard = buildCommandSectionKeyboard(ctx(), "MENU_COLLECT", admin);
  const sendKeyboard = buildCommandSectionKeyboard(ctx(), "MENU_SEND", admin);
  const accountKeyboard = buildCommandSectionKeyboard(ctx(), "MENU_ACCOUNT", admin);
  const supportKeyboard = buildCommandSectionKeyboard(ctx(), "MENU_SUPPORT", admin);

  assert.equal(callbackActions(collectKeyboard).includes("PP:INV"), false);
  assert.equal(labels(collectKeyboard).includes("📄 Open Collection Center"), false);
  assert.equal(callbackActions(sendKeyboard).includes("PP:PO"), false);
  assert.equal(labels(sendKeyboard).includes("💸 Open Sending Center"), false);
  assert.equal(callbackActions(accountKeyboard).includes("PROFILE"), false);
  assert.equal(labels(accountKeyboard).includes("👤 Open Profile"), false);
  assert.ok(labels(accountKeyboard).includes("🚀 Open Transferly"));
  assert.equal(callbackActions(supportKeyboard).includes("HELP"), false);
  assert.equal(callbackActions(supportKeyboard).includes("STATUS"), false);
  assert.ok(callbackActions(supportKeyboard).includes("SUPPORT_ACCOUNT"));
  assert.ok(callbackActions(supportKeyboard).includes("SUPPORT_PAYMENT"));
  assert.ok(callbackActions(supportKeyboard).includes("SUPPORT_TECHNICAL"));
  assert.ok(callbackActions(supportKeyboard).includes("SUPPORT_CONTACT"));
  assert.equal(callbackActions(supportKeyboard).includes("ACTIVITY"), false);
  assert.equal(labels(supportKeyboard).includes("🛟 Open Support"), false);
  assert.equal(callbackActions(buildCommandSectionKeyboard(ctx(), "MENU_ADMIN", admin)).includes("PAYMENT_AUDIT"), false);
});

test("command section bodies describe guided bot and mini app workflows", () => {
  const collectBody = formatCommandSectionBody("MENU_COLLECT");
  assert.match(collectBody, /Collections/);
  assert.match(collectBody, /Mini App mirror/);
  assert.match(collectBody, /Mini App owns invoices/);
  assert.match(collectBody, /chat navigation minimal/);

  const sendBody = formatCommandSectionBody("MENU_SEND");
  assert.match(sendBody, /Sending/);
  assert.match(sendBody, /Mini App owns payouts/);
  assert.match(sendBody, /crowded chat menus/);

  const accountBody = formatCommandSectionBody("MENU_ACCOUNT");
  assert.match(accountBody, /Mini App owns profile/);
  assert.match(accountBody, /Simple identity checks/);

  const adminBody = formatCommandSectionBody("MENU_ADMIN");
  assert.match(adminBody, /Mini App owns dashboard/);
  assert.match(adminBody, /Fast operator orientation/);

  const supportBody = formatCommandSectionBody("MENU_SUPPORT");
  assert.match(supportBody, /Help and Support/);
  assert.match(supportBody, /support, profile, dashboard/);
});

test("screen router prevents detail screens from rendering the main grid", () => {
  const detailLabels = labels(buildScreenKeyboard(ctx(), SCREEN_TYPES.DETAIL));
  assert.deepEqual(detailLabels, ["⬅️ Back", "Start"]);

  const mainLabels = labels(buildScreenKeyboard(ctx(), SCREEN_TYPES.MAIN, { access: { role: ROLES.ADMIN, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: true } }));
  assert.ok(mainLabels.includes("🚀 Open Transferly"));
  assert.ok(mainLabels.includes(CONTROL_LABELS.settings));
  assert.equal(mainLabels.includes("📄 Invoices"), false);
  assert.equal(mainLabels.includes("💸 Payouts"), false);
});

test("service catalog keyboard hands off to the Mini App", () => {
  const serviceLabels = labels(buildServiceGroupsKeyboard(ctx()));
  assert.ok(serviceLabels.includes("🚀 Open Transferly"));
  assert.ok(serviceLabels.includes(CONTROL_LABELS.account));
  assert.ok(serviceLabels.includes(CONTROL_LABELS.notifications));
  assert.ok(serviceLabels.includes(CONTROL_LABELS.settings));
  assert.equal(serviceLabels.includes("🔎 Search Service"), false);

  const matches = searchServices("paypal");
  assert.equal(matches[0].slug, "paypal");

  const resultLabels = labels(buildServiceSearchResultsKeyboard(ctx(), matches.slice(0, 1)));
  assert.ok(resultLabels.includes("🚀 Open Transferly"));
  assert.equal(resultLabels.includes("PayPal"), false);
  assert.equal(resultLabels.includes("🔎 Search Again"), false);
});

test("service command centers stay delegated to the Mini App", () => {
  const service = searchServices("faker-data")[0];
  const lane = getServiceLane(service, "sandbox-payload");
  assert.equal(lane.label, "Sandbox Payload");

  const detailKeyboard = buildServiceDetailKeyboard(ctx(), service);
  const detailLabels = labels(detailKeyboard);
  assert.ok(detailLabels.includes("🚀 Open Transferly"));
  assert.ok(detailLabels.includes(CONTROL_LABELS.help));
  assert.equal(detailLabels.includes("✅ Sandbox Payload"), false);
  assert.equal(callbackActions(detailKeyboard).includes("SERVICE_LANE:faker-data:sandbox-payload"), false);

  const laneKeyboard = buildServiceLaneKeyboard(ctx(), service, lane);
  assert.ok(labels(laneKeyboard).includes("🚀 Open Transferly"));
  assert.equal(labels(laneKeyboard).includes("🚀 Start Lane"), false);
  assert.equal(labels(laneKeyboard).includes("✍️ Custom Details"), false);
  assert.equal(callbackActions(laneKeyboard).includes("SERVICE_ACTION:faker-data:sandbox-payload"), false);
});

test("service catalog permits only the explicitly labelled sandbox legacy generator", () => {
  const generatable = SERVICE_CATALOG.filter(canGenerateService).map((service) => service.slug);
  assert.deepEqual(generatable, ["faker-data"]);

  const sandbox = searchServices("faker-data")[0];
  assert.equal(sandbox.status, "sandbox");
  assert.equal(sandbox.executionMode, "sandbox");

  for (const slug of ["opay", "binance", "paypal", "crypto-receipts", "transaction-record"]) {
    assert.equal(canGenerateService(searchServices(slug)[0]), false, `${slug} must not use legacy generation`);
  }

  assert.equal(getServiceCommandCenter(searchServices("opay")[0]), null);
  assert.equal(getServiceCommandCenter(searchServices("pass-clone")[0]), null);
});

test("PayPal workspace stays a clean Mini App handoff", () => {
  const userLabels = labels(buildPayPalWorkspaceKeyboard(ctx(), { role: ROLES.USER, status: STATUS.ACTIVE, isAuthorized: true }));
  assert.ok(userLabels.includes("🚀 Open Transferly"));
  assert.ok(userLabels.includes(CONTROL_LABELS.help));
  assert.equal(userLabels.includes("🔎 Search Invoice"), false);
  assert.equal(userLabels.includes("🔎 Search Payout"), false);
  assert.equal(userLabels.includes("✉️ Notification"), false);

  const paypalLabels = labels(buildPayPalWorkspaceKeyboard(ctx(), { role: ROLES.ADMIN, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: true }));
  assert.ok(paypalLabels.includes("🚀 Open Transferly"));
  assert.ok(paypalLabels.includes(CONTROL_LABELS.settings));
  assert.equal(paypalLabels.includes("🔎 Search Invoice"), false);
  assert.equal(paypalLabels.includes("🔎 Search Payout"), false);
});

test("provider cockpit stays a clean Mini App handoff", () => {
  const userLabels = labels(buildProvidersKeyboard(ctx(), { role: ROLES.USER, status: STATUS.ACTIVE, isAuthorized: true }));
  assert.ok(userLabels.includes("🚀 Open Transferly"));
  assert.ok(userLabels.includes(CONTROL_LABELS.help));
  assert.equal(userLabels.includes("PayPal"), false);
  assert.equal(userLabels.includes("Stripe"), false);
  assert.equal(userLabels.includes("🧰 Service Catalog"), false);
  assert.equal(userLabels.includes("📄 Invoices"), false);

  const adminLabels = labels(buildProvidersKeyboard(ctx(), { role: ROLES.ADMIN, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: true }));
  assert.ok(adminLabels.includes("🚀 Open Transferly"));
  assert.ok(adminLabels.includes(CONTROL_LABELS.settings));
  assert.equal(adminLabels.includes("📄 Invoices"), false);
  assert.equal(adminLabels.includes("💸 Payouts"), false);
  assert.equal(adminLabels.includes("📊 Activity"), false);
  assert.equal(adminLabels.includes("🔐 Security"), false);

  const stripe = searchServices("stripe")[0];
  const stripeWorkspaceLabels = labels(buildProviderWorkspaceKeyboard(ctx(), stripe, { role: ROLES.ADMIN, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: true }));
  assert.ok(stripeWorkspaceLabels.includes("🚀 Open Transferly"));
  assert.equal(stripeWorkspaceLabels.includes("📄 Open Invoices"), false);
  assert.equal(stripeWorkspaceLabels.includes("💸 Open Payouts"), false);
  assert.equal(stripeWorkspaceLabels.includes("💰 Provider Balance"), false);
  assert.equal(stripeWorkspaceLabels.includes("🛰 Webhooks"), false);
  assert.equal(stripeWorkspaceLabels.includes("⚠️ Issues"), false);
});

test("invoice and payout command centers hand off to the Mini App", () => {
  const admin = { role: ROLES.ADMIN, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: true };
  const invoiceKeyboard = buildInvoiceCenterKeyboard(ctx(), admin);
  const invoiceLabels = labels(invoiceKeyboard);
  assert.ok(invoiceLabels.includes("🚀 Open Transferly"));
  assert.ok(invoiceLabels.includes(CONTROL_LABELS.settings));
  assert.equal(invoiceLabels.includes("✅ PayPal Invoices"), false);
  assert.equal(invoiceLabels.includes("✅ Stripe Payments"), false);
  assert.equal(invoiceLabels.includes("All Providers"), false);
  assert.equal(callbackActions(invoiceKeyboard).includes("PP:INV"), false);

  const payoutKeyboard = buildPayoutCenterKeyboard(ctx(), admin);
  const payoutLabels = labels(payoutKeyboard);
  assert.ok(payoutLabels.includes("🚀 Open Transferly"));
  assert.ok(payoutLabels.includes(CONTROL_LABELS.settings));
  assert.equal(payoutLabels.includes("✅ PayPal Payouts"), false);
  assert.equal(payoutLabels.includes("🛠 Wise Send"), false);
  assert.equal(payoutLabels.includes("All Providers"), false);
  assert.equal(callbackActions(payoutKeyboard).includes("PP:PO"), false);
});

test("operations command center hands off to the Mini App", () => {
  const keyboard = buildOpsCommandCenterKeyboard(ctx());
  const opsLabels = labels(keyboard);
  assert.ok(opsLabels.includes(CONTROL_LABELS.settings));
  assert.ok(opsLabels.includes("🚀 Open Transferly"));
  assert.equal(opsLabels.includes("📊 Activity"), false);
  assert.equal(opsLabels.includes("🧾 Payment Audit"), false);
  assert.equal(opsLabels.includes("💳 Provider Dashboard"), false);
  assert.equal(callbackActions(keyboard).includes("ACTIVITY"), false);
  assert.equal(callbackActions(keyboard).includes("PAYMENT_AUDIT"), false);
  assert.equal(callbackActions(keyboard).includes("PROVIDERS"), false);
});

test("provider record keyboards return to their originating provider workspace", () => {
  const fakeCtx = ctx();
  const stripeInvoice = {
    provider: "stripe",
    metadata: {
      provider: "stripe",
    },
  };
  const cryptoPayout = {
    metadata: {
      provider: "crypto",
    },
  };

  assert.ok(callbackActions(buildInvoiceDetailKeyboard(fakeCtx, stripeInvoice, "inv_1")).includes("PROVIDER_INV:stripe"));
  assert.ok(callbackActions(buildInvoiceResultKeyboard(fakeCtx, "inv_1", stripeInvoice)).includes("PROVIDER:stripe"));
  assert.ok(callbackActions(buildPayoutDetailKeyboard(fakeCtx, cryptoPayout, "po_1")).includes("PROVIDER_PO:crypto"));
  assert.ok(callbackActions(buildPayoutResultKeyboard(fakeCtx, "po_1", cryptoPayout)).includes("PROVIDER:crypto"));
});

test("capabilities allow authorized users to use services but block payment ops", () => {
  const user = { role: ROLES.USER, status: STATUS.ACTIVE };
  const admin = { role: ROLES.ADMIN, status: STATUS.ACTIVE };
  const guest = { role: ROLES.GUEST, status: STATUS.ACTIVE };

  assert.equal(hasCapability(user, CAPABILITIES.SERVICES_USE), true);
  assert.equal(hasCapability(user, CAPABILITIES.PAYMENTS_READ), false);
  assert.equal(hasCapability(admin, CAPABILITIES.PAYMENTS_READ), true);
  assert.equal(hasCapability(admin, CAPABILITIES.USERS_MANAGE), false);
  assert.equal(hasCapability({ role: ROLES.OWNER, status: STATUS.ACTIVE }, CAPABILITIES.USERS_MANAGE), true);
  assert.equal(hasCapability({ role: ROLES.OWNER, status: STATUS.ACTIVE, subscriptionExpired: true }, CAPABILITIES.USERS_MANAGE), true);
  assert.equal(hasCapability({ role: ROLES.ADMIN, status: STATUS.ACTIVE, subscriptionExpired: true }, CAPABILITIES.PAYMENTS_READ), false);
  assert.equal(hasCapability({ role: ROLES.USER, status: STATUS.ACTIVE, subscriptionExpired: true }, CAPABILITIES.SERVICES_USE), false);
  assert.equal(hasCapability(guest, CAPABILITIES.SERVICES_USE), false);
  assert.equal(getActionCapability("GROUP:BANK"), CAPABILITIES.SERVICES_USE);
  assert.equal(getActionCapability("SERVICE_ACTION:opay:wallet-record"), CAPABILITIES.SERVICES_USE);
  assert.equal(getActionCapability("SERVICE_LANE:opay:wallet-record"), CAPABILITIES.SERVICES_USE);
  assert.equal(getActionCapability("PROVIDERS"), CAPABILITIES.SERVICES_USE);
  assert.equal(getActionCapability("MENU_COLLECT"), CAPABILITIES.SERVICES_USE);
  assert.equal(getActionCapability("MENU_SEND"), CAPABILITIES.SERVICES_USE);
  assert.equal(getActionCapability("MENU_ACCOUNT"), CAPABILITIES.ACCOUNT_READ);
  assert.equal(getActionCapability("MENU_ADMIN"), CAPABILITIES.SYSTEM_STATUS);
  assert.equal(getActionCapability("MENU_SUPPORT"), CAPABILITIES.PUBLIC);
  assert.equal(getActionCapability("APP"), CAPABILITIES.PUBLIC);
  assert.equal(getActionCapability("ACCOUNT"), CAPABILITIES.ACCOUNT_READ);
  assert.equal(getActionCapability("NOTIFICATIONS"), CAPABILITIES.PUBLIC);
  assert.equal(getActionCapability("SETTINGS"), CAPABILITIES.PUBLIC);
  assert.equal(getCommandCapability("app"), CAPABILITIES.PUBLIC);
  assert.equal(getCommandCapability("account"), CAPABILITIES.ACCOUNT_READ);
  assert.equal(getCommandCapability("notifications"), CAPABILITIES.PUBLIC);
  assert.equal(getCommandCapability("settings"), CAPABILITIES.PUBLIC);
  assert.equal(getCommandCapability("stripe"), CAPABILITIES.SERVICES_USE);
  assert.equal(getCommandCapability("paypal"), CAPABILITIES.SERVICES_USE);
  assert.equal(getCommandCapability("invoices"), CAPABILITIES.PAYMENTS_READ);
  assert.equal(getActionCapability("ACTIVITY"), CAPABILITIES.PAYMENTS_READ);
  assert.equal(getActionCapability("SECURITY"), CAPABILITIES.SYSTEM_STATUS);
  assert.equal(getActionCapability("PP:INV"), CAPABILITIES.PAYMENTS_READ);
  assert.equal(getActionCapability("PROVIDER_INV:stripe"), CAPABILITIES.PAYMENTS_READ);
  assert.equal(getActionCapability("PROVIDER_PO:stripe"), CAPABILITIES.PAYMENTS_READ);
  assert.equal(getActionCapability("PROVIDER_BAL:stripe"), CAPABILITIES.PAYMENTS_READ);
  assert.equal(getActionCapability("PROVIDER_WEBHOOKS:stripe"), CAPABILITIES.PAYMENTS_READ);
  assert.equal(getActionCapability("PROVIDER_ISSUES:stripe"), CAPABILITIES.PAYMENTS_READ);
  assert.equal(getActionCapability("BOT_OPS"), CAPABILITIES.SYSTEM_STATUS);
  assert.equal(getActionCapability("USER_D:123"), CAPABILITIES.USERS_MANAGE);
});

test("owner user-management keyboards include duration presets and confirmation controls", () => {
  const usersLabels = labels(buildUsersKeyboard(ctx()));
  assert.ok(usersLabels.includes("📋 List Users"));
  assert.ok(usersLabels.includes("⏳ Expiring"));
  assert.ok(usersLabels.includes("🔎 Search Users"));
  assert.ok(usersLabels.includes("🔔 Alerts"));
  assert.ok(usersLabels.includes("➕ Add User"));
  assert.ok(usersLabels.includes("⬆️ Promote User"));
  assert.ok(usersLabels.includes("⬇️ Demote User"));
  assert.ok(usersLabels.includes("⏸ Suspend"));
  assert.ok(usersLabels.includes("▶️ Reactivate"));
  assert.ok(usersLabels.includes("❌ Revoke"));
  assert.ok(usersLabels.includes("🧾 Audit Logs"));
  assert.ok(usersLabels.includes("📊 Analytics"));

  const userListLabels = labels(buildUsersListKeyboard(ctx(), [{ telegram_id: 123, username: "alice", role: ROLES.USER }]));
  assert.ok(userListLabels.includes("USER · @alice"));

  const detailLabels = labels(buildUserDetailKeyboard(ctx(), { telegram_id: 123, username: "alice", role: ROLES.USER, status: STATUS.ACTIVE }));
  assert.ok(detailLabels.includes("➕ Extend"));
  assert.ok(detailLabels.includes("⬆️ Promote"));
  assert.ok(detailLabels.includes("⏸ Suspend"));

  const durationLabels = labels(buildSubscriptionDurationKeyboard(ctx()));
  assert.deepEqual(durationLabels, ["7 days", "30 days", "90 days", "365 days", "✍️ Type Custom Days", "Cancel", "Back"]);

  const confirmLabels = labels(buildUserConfirmKeyboard(ctx(), { action: "promote" }));
  assert.ok(confirmLabels.includes("✅ Confirm"));
  assert.ok(confirmLabels.includes("🕒 Change Days"));

  const suspendLabels = labels(buildUserConfirmKeyboard(ctx(), { action: "suspend" }));
  assert.ok(suspendLabels.includes("✅ Confirm"));
  assert.equal(suspendLabels.includes("🕒 Change Days"), false);
});

test("all generated inline callback actions have router coverage", async () => {
  const service = searchServices("paypal")[0];
  const stripeService = searchServices("stripe")[0];
  const walletService = searchServices("faker-data")[0];
  const walletLane = getServiceLane(walletService, "sandbox-payload");
  const invoiceList = buildPayPalListKeyboard(
    ctx(),
    "invoice",
    [{ key: "inv_1", label: "Invoice 1" }],
    { page: 2, has_next_page: true },
    { page: 2, status: "ALL" },
  );
  const payoutList = buildPayPalListKeyboard(
    ctx(),
    "payout",
    [{ key: "po_1", label: "Payout 1" }],
    { page: 2, has_next_page: true },
    { page: 2, status: "ALL", providerState: "ALL" },
  );
  const user = { telegram_id: 123, username: "alice", role: ROLES.USER, status: STATUS.ACTIVE };
  const ownerAccess = { role: ROLES.OWNER, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: true, isOwner: true };
  const actionSet = new Set([
    ...callbackActions(buildStartKeyboard(ctx(), ownerAccess)),
    ...callbackActions(buildMainMenuKeyboard(ctx(), ownerAccess)),
    ...callbackActions(buildMainMenuKeyboard(ctx(), { role: ROLES.USER, status: STATUS.ACTIVE, isAuthorized: true })),
    ...callbackActions(buildSupportKeyboard(ctx(), ownerAccess)),
    ...callbackActions(buildCommandHubKeyboard(ctx(), ownerAccess)),
    ...callbackActions(buildCommandSectionKeyboard(ctx(), "MENU_COLLECT", ownerAccess)),
    ...callbackActions(buildCommandSectionKeyboard(ctx(), "MENU_SEND", ownerAccess)),
    ...callbackActions(buildCommandSectionKeyboard(ctx(), "MENU_ACCOUNT", ownerAccess)),
    ...callbackActions(buildCommandSectionKeyboard(ctx(), "MENU_ADMIN", ownerAccess)),
    ...callbackActions(buildCommandSectionKeyboard(ctx(), "MENU_SUPPORT", ownerAccess)),
    ...callbackActions(buildProvidersKeyboard(ctx(), ownerAccess)),
    ...callbackActions(buildInvoiceCenterKeyboard(ctx(), ownerAccess)),
    ...callbackActions(buildPayoutCenterKeyboard(ctx(), ownerAccess)),
    ...callbackActions(buildOpsCommandCenterKeyboard(ctx())),
    ...callbackActions(buildServiceGroupsKeyboard(ctx())),
    ...callbackActions(buildServiceSearchResultsKeyboard(ctx(), [service])),
    ...callbackActions(buildServiceDetailKeyboard(ctx(), walletService)),
    ...callbackActions(buildServiceLaneKeyboard(ctx(), walletService, walletLane)),
    ...callbackActions(buildPayPalWorkspaceKeyboard(ctx(), { role: ROLES.ADMIN, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: true })),
    ...callbackActions(buildProviderWorkspaceKeyboard(ctx(), stripeService, ownerAccess)),
    ...callbackActions(invoiceList),
    ...callbackActions(payoutList),
    ...callbackActions(buildInvoiceResultKeyboard(ctx(), "inv_1")),
    ...callbackActions(buildPayoutResultKeyboard(ctx(), "po_1")),
    ...callbackActions(buildUsersKeyboard(ctx())),
    ...callbackActions(buildUsersListKeyboard(ctx(), [user])),
    ...callbackActions(buildUserDetailKeyboard(ctx(), user)),
    ...callbackActions(buildUsersAuditKeyboard(ctx())),
    ...callbackActions(buildPaymentAuditKeyboard(ctx())),
    ...callbackActions(buildBotAnalyticsKeyboard(ctx())),
    ...callbackActions(buildSubscriptionAlertsKeyboard(ctx())),
    ...callbackActions(buildSubscriptionDurationKeyboard(ctx())),
    ...callbackActions(buildUserConfirmKeyboard(ctx(), { action: "promote" })),
  ]);
  actionSet.delete("BACK");

  const handlers = new Proxy({
    getService: () => service,
  }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return async (...args) => {
      };
    },
  });
  const deps = {
    requireAdmin: async () => true,
    handlers,
  };

  const uncovered = [];
  for (const action of actionSet) {
    const handled = isMiniAppDelegatedAction(action) || await handlePublicCallback(ctx(), action, deps);
    if (!handled) uncovered.push(action);
  }

  assert.deepEqual(uncovered, []);
});

test("back navigation uses the saved previous screen", () => {
  const fakeCtx = ctx();
  resetNavigation(fakeCtx, "MENU");
  rememberScreen(fakeCtx, "WHOAMI");
  assert.equal(popBackAction(fakeCtx), "MENU");

  const backLabels = labels(buildBackKeyboard(fakeCtx));
  assert.deepEqual(backLabels, ["⬅️ Back", "Start"]);
});

test("parent inline routes replace child screens in the navigation stack", () => {
  const serviceCtx = ctx();
  resetNavigation(serviceCtx, "MENU");
  rememberScreen(serviceCtx, "SERVICES");
  rememberScreen(serviceCtx, "GROUP:FLASH");
  rememberScreen(serviceCtx, "SERVICE:paypal");
  prepareNavigationAction(serviceCtx, "GROUP:FLASH");
  rememberScreen(serviceCtx, "GROUP:FLASH");
  assert.equal(popBackAction(serviceCtx), "SERVICES");

  const paypalCtx = ctx();
  resetNavigation(paypalCtx, "MENU");
  rememberScreen(paypalCtx, "SERVICE:paypal");
  rememberScreen(paypalCtx, "PP:HOME");
  rememberScreen(paypalCtx, "PP:INV");
  rememberScreen(paypalCtx, "PP:INV_D:inv_1");
  prepareNavigationAction(paypalCtx, "PP:INV");
  rememberScreen(paypalCtx, "PP:INV");
  assert.equal(popBackAction(paypalCtx), "PP:HOME");

  prepareNavigationAction(paypalCtx, "PP:HOME");
  rememberScreen(paypalCtx, "PP:HOME");
  assert.equal(popBackAction(paypalCtx), "SERVICE:paypal");
});

test("stale callback recovery returns to clean navigation", () => {
  const owner = { role: ROLES.OWNER, status: STATUS.ACTIVE, isAuthorized: true, isAdmin: true, isOwner: true };
  for (const action of ["USER_D:123", "PP:INV_D:inv_1", "INVOICES", "OPS", "PAYMENT_AUDIT", "SERVICE:paypal"]) {
    const recoveryLabels = labels(buildCallbackRecoveryKeyboard(ctx(), action, owner));
    assert.ok(recoveryLabels.includes("🚀 Open Transferly"));
    assert.ok(recoveryLabels.includes(CONTROL_LABELS.account));
    assert.ok(recoveryLabels.includes(CONTROL_LABELS.notifications));
    assert.ok(recoveryLabels.includes(CONTROL_LABELS.settings));
    assert.ok(recoveryLabels.includes(CONTROL_LABELS.help));
    assert.equal(recoveryLabels.includes("🪪 Access"), false);
    assert.equal(recoveryLabels.includes("🏥 Health"), false);
    assert.equal(recoveryLabels.includes("👥 Users"), false);
    assert.equal(recoveryLabels.includes("📄 Official Invoices"), false);
    assert.equal(recoveryLabels.includes("🧾 Payment Audit"), false);
    assert.equal(recoveryLabels.includes("Verified Wallets"), false);
  }
});

test("bot errors classify into safe user-facing recovery messages", () => {
  assert.deepEqual(classifyBotError({ response: { status: 403 } }), {
    code: "access_verification_failed",
    severity: "warn",
    status: 403,
    userMessage: "Transferly could not verify access for that request. Use /support if you need help.",
  });
  assert.deepEqual(classifyBotError({ response: { status: 409 } }), {
    code: "state_conflict",
    severity: "warn",
    status: 409,
    userMessage: "That action is no longer current. Open Transferly for the latest status.",
  });
  assert.deepEqual(classifyBotError({ code: "ETIMEDOUT" }), {
    code: "api_network_error",
    severity: "error",
    status: null,
    userMessage: "Transferly could not be reached. Try again shortly or use Help for support.",
  });
});

test("payment duplicate guards block unsafe repeated actions", () => {
  assert.equal(invoiceReleaseGuard({ status: "RELEASED" }), "This invoice already appears to have released funds.");
  assert.equal(invoiceReleaseGuard({ status: "SENT" }), "Invoice status SENT is not releaseable from Telegram.");
  assert.equal(invoiceReleaseGuard({ status: "PAID" }), null);

  assert.equal(payoutActionGuard({ status: "APPROVED" }, "approve"), "This payout is already approved or processing.");
  assert.equal(payoutActionGuard({ status: "REJECTED" }, "reject"), "This payout has already been rejected.");
  assert.equal(
    payoutActionGuard({ status: "PENDING_APPROVAL", official_paypal: { provider_item_status: "SUCCESS" } }, "cancel"),
    "Provider state SUCCESS is not eligible for unclaimed cancellation.",
  );
  assert.equal(payoutActionGuard({ status: "PENDING_APPROVAL", official_paypal: { provider_item_status: "UNCLAIMED" } }, "cancel"), null);
});
