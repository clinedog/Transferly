const { authService } = require('../services/authService');
const { telegramMiniAppLoginSchema } = require('../schemas/authSchemas');

async function telegramMiniAppLoginController(request, response) {
  const body = telegramMiniAppLoginSchema.parse(request.body || {});
  const result = await authService.loginWithTelegramMiniApp(body);
  response.json(result);
}

async function refreshSessionController(request, response) {
  const result = await authService.refreshSession(request.auth);
  response.json(result);
}

async function logoutController(request, response) {
  const result = await authService.logoutSession(request.auth);
  response.json(result);
}

module.exports = {
  logoutController,
  refreshSessionController,
  telegramMiniAppLoginController
};
