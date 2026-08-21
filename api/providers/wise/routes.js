'use strict';

const express = require('express');
const router = express.Router();
const WiseService = require('./service');
const WiseProvider = require('./provider');

const service = new WiseService({
  config: {
    apiToken: process.env.WISE_API_TOKEN,
    profileId: process.env.WISE_PROFILE_ID
  }
});

router.get('/health', async (_req, res) => {
  try {
    const provider = new WiseProvider();
    const health = await provider.getHealth();
    const statusCode = health.configured ? 200 : 503;
    res.status(statusCode).json({ ok: health.configured, data: health });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/balances', async (_req, res) => {
  try {
    const data = await service.getBalances();
    res.json({ ok: true, data });
  } catch (_err) {
    res.status(500).json({ ok: false, error: 'Failed to fetch balances' });
  }
});

router.get('/transfers', async (req, res) => {
  try {
    const data = await service.listTransfers(req.query);
    res.json({ ok: true, data });
  } catch (_err) {
    res.status(500).json({ ok: false, error: 'Failed to fetch transfers' });
  }
});

module.exports = router;
