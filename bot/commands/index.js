const { registerPublicCommands } = require("./public");

function registerCommands(bot, deps) {
  registerPublicCommands(bot, deps);
}

module.exports = {
  registerCommands,
};
