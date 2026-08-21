function registerPublicCommands(bot, { wrap, handlers }) {
  bot.command("start", wrap(handlers.handleStart, "start"));
  bot.command("app", wrap(handlers.handleApp, "app"));
  bot.command("account", wrap(handlers.handleAccount, "account"));
  bot.command("notifications", wrap(handlers.handleNotifications, "notifications"));
  bot.command("settings", wrap(handlers.handleSettings, "settings"));
  bot.command("help", wrap(handlers.handleHelp, "help"));
  bot.command("support", wrap(handlers.handleSupport, "support"));
  bot.command("status", wrap(handlers.handleStatus, "status"));
  bot.command("terms", wrap(handlers.handleTerms, "terms"));
  bot.command("privacy", wrap(handlers.handlePrivacy, "privacy"));
}

module.exports = {
  registerPublicCommands,
};
