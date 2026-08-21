// PayPal webhook receiver scaffold

const express = require('express');
const router = express.Router();

router.post('/paypal', (req, res) => {
  // Providers should verify signature using PAYPAL_WEBHOOK_ID and secret
  // Non-destructive stub: log and ack
  console.info('Received paypal webhook', { headers: req.headers });
  res.status(200).send({ ok: true });
});

module.exports = router;
