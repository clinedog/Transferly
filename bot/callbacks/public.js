async function handlePublicCallback(ctx, action, { handlers }) {
  switch (action) {
    case "CANCEL":
      await handlers.handleCancel(ctx);
      return true;
    case "MENU":
      await handlers.handleMenu(ctx);
      return true;
    case "APP":
      await handlers.handleApp(ctx);
      return true;
    case "ACCOUNT":
      await handlers.handleAccount(ctx);
      return true;
    case "NOTIFICATIONS":
      await handlers.handleNotifications(ctx);
      return true;
    case "SETTINGS":
      await handlers.handleSettings(ctx);
      return true;
    case "HELP":
      await handlers.handleHelp(ctx);
      return true;
    case "SUPPORT":
      await handlers.handleSupport(ctx);
      return true;
    case "SUPPORT_ACCOUNT":
    case "SUPPORT_PAYMENT":
    case "SUPPORT_TECHNICAL":
    case "SUPPORT_CONTACT":
      await handlers.handleSupport(ctx, action);
      return true;
    case "TERMS":
      await handlers.handleTerms(ctx);
      return true;
    case "PRIVACY":
      await handlers.handlePrivacy(ctx);
      return true;
    case "MENU_SUPPORT":
      await handlers.handleSupport(ctx);
      return true;
    case "WHOAMI":
      await handlers.handleWhoami(ctx);
      return true;
    case "HEALTH":
      await handlers.handleStatus(ctx);
      return true;
    case "STATUS":
      await handlers.handleStatus(ctx);
      return true;
    default:
      return false;
  }
}

module.exports = {
  handlePublicCallback,
};
