'use strict';

const express = require('express');
const router = express.Router();
const StripeService = require('./service');
const StripeProvider = require('./provider');

const service = new StripeService({
  config: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    apiVersion: process.env.STRIPE_API_VERSION,
    baseUrl: process.env.STRIPE_API_BASE_URL
  }
});

router.get('/health', async (_req, res) => {
  try {
    const provider = new StripeProvider();
    const health = await provider.getHealth();
    const statusCode = health.configured ? 200 : 503;
    res.status(statusCode).json({ ok: health.configured, data: health });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/balance', async (_req, res) => {
  try {
    const data = await service.getBalance();
    res.json({ ok: true, data });
  } catch (_err) {
    res.status(500).json({ ok: false, error: 'Failed to fetch balance' });
  }
});

router.get('/payments', async (req, res) => {
  try {
    const data = await service.listPayments(req.query);
    res.json({ ok: true, data });
  } catch (_err) {
    res.status(500).json({ ok: false, error: 'Failed to fetch payments' });
  }
});

router.get('/invoices', async (req, res) => {
  try {
    const data = await service.listInvoices(req.query);
    res.json({ ok: true, data });
  } catch (_err) {
    res.status(500).json({ ok: false, error: 'Failed to fetch invoices' });
  }
});

module.exports = router;
