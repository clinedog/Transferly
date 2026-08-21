function encodeQueueJobIdPart(value) {
  if (value === null || value === undefined) {
    throw new TypeError('Queue job ID parts must be defined.');
  }

  const normalized = String(value).trim();
  if (!normalized) {
    throw new TypeError('Queue job ID parts must not be empty.');
  }

  return encodeURIComponent(normalized).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function buildQueueJobId(...parts) {
  if (parts.length === 0) {
    throw new TypeError('At least one queue job ID part is required.');
  }

  const encodedParts = parts.map(encodeQueueJobIdPart);
  return `q-${encodedParts.map((part) => `${part.length}-${part}`).join('-')}`;
}

module.exports = {
  buildQueueJobId,
  encodeQueueJobIdPart
};
