'use strict';

const express = require('express');
const router = express.Router();
const PaystackService = require('./service');
const PaystackProvider = require('./provider');

const service = new PaystackService({
  config: { secretKey: process.env.PAYSTACK_SECRET_KEY }
});

router.get('/health', async (_req, res) => {
  try {
    const provider = new PaystackProvider();
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

router.get('/transactions', async (req, res) => {
  try {
    const data = await service.listTransactions(req.query);
    res.json({ ok: true, data });
  } catch (_err) {
    res.status(500).json({ ok: false, error: 'Failed to fetch transactions' });
  }
});

module.exports = router;
