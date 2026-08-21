const { walletLinkService } = require('../services/walletLinkService');

async function createChallengeController(req, res) {
  const userId = req.auth.userId;
  const challenge = await walletLinkService.createChallenge(userId);
  res.json({ success: true, data: challenge });
}

async function verifyChallengeController(req, res) {
  const userId = req.auth.userId;
  const body = req.body || {};
  const result = await walletLinkService.verifyProof(userId, body);
  res.json({ success: true, data: result });
}

async function listWalletLinksController(req, res) {
  const list = await walletLinkService.listForUser(req.auth.userId);
  res.json({ success: true, data: list });
}

async function deleteWalletLinkController(req, res) {
  const id = req.params.id;
  await walletLinkService.unlink(req.auth.userId, id);
  res.json({ success: true, data: { id } });
}

module.exports = {
  createChallengeController,
  verifyChallengeController,
  listWalletLinksController,
  deleteWalletLinkController
};