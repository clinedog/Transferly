import { paypalSandboxRecipients } from './paypalSandboxFixtures';

export function formatPayPalCurrency(value, currency = 'USD') {
  const numericValue = Number(value || 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
}

export function findPayPalSandboxRecipient(email) {
  const normalizedEmail = email.trim().toLowerCase();
  return paypalSandboxRecipients.find((recipient) => recipient.email.toLowerCase() === normalizedEmail) || null;
}

export function createPayPalSandboxReference(prefix) {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${stamp}-${suffix}`;
}

function escapePdfText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function buildPaymentConfirmationPdf(payment) {
  const lines = [
    'Payment Confirmation',
    'Sandbox / Test Payment Confirmation',
    'Business Account',
    `Account type: ${payment.sender.accountType || 'Business Account'}`,
    `Status: ${payment.status}`,
    `Transaction ID: ${payment.transactionId}`,
    `Date/time: ${payment.createdAt}`,
    `Sender: ${payment.sender.name} (${payment.sender.email})`,
    `Receiver: ${payment.receiver.name} (${payment.receiver.email})`,
    `Amount: ${formatPayPalCurrency(payment.amount, payment.currency)} ${payment.currency}`,
    `Reference: ${payment.reference}`,
    `Payout batch ID: ${payment.payoutBatchId}`,
    `Payout item ID: ${payment.payoutItemId}`,
    'Environment: PayPal Sandbox / test money only'
  ];
  const content = lines
    .map((line, index) => {
      const size = index === 0 ? 22 : index === 1 ? 14 : 11;
      const y = 760 - index * 28;
      return `BT /F1 ${size} Tf 54 ${y} Td (${escapePdfText(line)}) Tj ET`;
    })
    .join('\n');
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object) => {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export function downloadPaymentConfirmationPdf(payment) {
  downloadBlob(buildPaymentConfirmationPdf(payment), `${payment.transactionId}-sandbox-payment-confirmation.pdf`);
}

export function downloadPaymentConfirmationImage(payment) {
  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  canvas.height = 900;
  const context = canvas.getContext('2d');

  if (!context) {
    return;
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#f7f9fa';
  context.fillRect(48, 48, canvas.width - 96, canvas.height - 96);
  context.strokeStyle = '#d6d9dc';
  context.lineWidth = 3;
  context.strokeRect(48, 48, canvas.width - 96, canvas.height - 96);
  context.fillStyle = '#003087';
  context.font = '700 46px Arial';
  context.fillText('Payment Confirmation', 92, 135);
  context.fillStyle = '#8f2b0f';
  context.font = '700 28px Arial';
  context.fillText('Sandbox / Test Payment Confirmation', 92, 190);
  context.fillStyle = '#003087';
  context.font = '700 24px Arial';
  context.fillText('Business Account', 92, 235);
  context.fillStyle = '#0c0c0d';
  context.font = '700 30px Arial';
  context.fillText(`${formatPayPalCurrency(payment.amount, payment.currency)} ${payment.currency}`, 92, 300);
  context.font = '600 24px Arial';

  [
    ['Confirmation type', 'Payment Confirmation'],
    ['Account type', payment.sender.accountType || 'Business Account'],
    ['Status', payment.status],
    ['Transaction ID', payment.transactionId],
    ['Date/time', payment.createdAt],
    ['Sender', `${payment.sender.name} (${payment.sender.email})`],
    ['Receiver', `${payment.receiver.name} (${payment.receiver.email})`],
    ['Reference', payment.reference],
    ['Payout batch ID', payment.payoutBatchId],
    ['Payout item ID', payment.payoutItemId],
    ['Environment', 'PayPal Sandbox / test money only']
  ].forEach(([label, value], index) => {
    const y = 370 + index * 46;
    context.fillStyle = '#687173';
    context.fillText(label, 92, y);
    context.fillStyle = '#0c0c0d';
    context.fillText(value, 420, y);
  });

  canvas.toBlob((blob) => {
    if (blob) {
      downloadBlob(blob, `${payment.transactionId}-sandbox-payment-confirmation.png`);
    }
  }, 'image/png');
}
