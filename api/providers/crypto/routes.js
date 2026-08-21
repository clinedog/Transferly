'use strict';

const express = require('express');
const router = express.Router();
const CryptoCommerceService = require('./service');
const CryptoCommerceProvider = require('./provider');

const service = new CryptoCommerceService({
  config: { apiKey: process.env.CRYPTO_COMMERCE_API_KEY }
});

router.get('/health', async (_req, res) => {
  try {
    const provider = new CryptoCommerceProvider();
    const health = await provider.getHealth();
    const statusCode = health.configured ? 200 : 503;
    res.status(statusCode).json({ ok: health.configured, data: health });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/charges', async (req, res) => {
  try {
    const data = await service.listCharges(req.query);
    res.json({ ok: true, data });
  } catch (_err) {
    res.status(500).json({ ok: false, error: 'Failed to fetch charges' });
  }
});

router.get('/charges/:chargeId', async (req, res) => {
  try {
    const data = await service.getCharge(req.params.chargeId);
    res.json({ ok: true, data });
  } catch (_err) {
    res.status(500).json({ ok: false, error: 'Failed to fetch charge' });
  }
});

module.exports = router;
