const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { Duplex } = require('node:stream');
const { after, before, describe, test } = require('node:test');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transferly-asset-api-'));
process.env.NODE_ENV = 'test';
process.env.SQLITE_DATABASE_PATH = path.join(testDir, 'transferly.sqlite');
process.env.GENERATED_ASSET_STORAGE_PATH = path.join(testDir, 'private-assets');
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.INLINE_QUEUE_MODE = 'true';
process.env.APP_BASE_URL = 'https://api.transferly.test';
process.env.JWT_SECRET = 'replace-with-a-long-random-secret';
process.env.USER_API_TOKENS = 'asset-owner:owner-token,asset-other:other-token';
process.env.PAYPAL_CLIENT_ID = 'asset-api-client';
process.env.PAYPAL_CLIENT_SECRET = 'paypal-client-secret';
process.env.PAYPAL_WEBHOOK_ID = 'asset-api-webhook';
process.env.API_RATE_LIMIT_MAX = '500';
process.env.AUTH_RATE_LIMIT_MAX = '500';

const { createApp } = require('../app');
const { createLocalPrivateStorageAdapter } = require('../adapters/storageAdapter');
const { close, db } = require('../db');
const { migrate } = require('../db/migrate');
const { auditLogRepository } = require('../repositories/auditLogRepository');
const { generatedAssetRepository } = require('../repositories/generatedAssetRepository');
const { orderRepository } = require('../repositories/orderRepository');

let app;
let ownerAsset;
let expiringAsset;
const ownerContent = Buffer.from('private owner asset content', 'utf8');

function createMockSocket() {
  const socket = new Duplex({
    read() {},
    write(_chunk, _encoding, callback) {
      callback();
    },
    writev(_items, callback) {
      callback();
    }
  });
  const realDestroy = socket.destroy.bind(socket);

  socket.remoteAddress = '127.0.0.1';
  socket.writable = true;
  socket.readable = true;
  socket.destroy = (error) => (error ? realDestroy(error) : socket);
  socket.destroySoon = socket.destroy.bind(socket);
  socket.forceDestroy = realDestroy;

  return socket;
}

async function injectRequest(targetApp, { method = 'GET', url = '/', headers = {} } = {}) {
  const bodyChunks = [];
  const socket = createMockSocket();
  const request = new http.IncomingMessage(socket);
  request.method = method;
  request.url = url;
  request.headers = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );
  request.connection = socket;
  request.socket = socket;
  request.httpVersion = '1.1';
  request.httpVersionMajor = 1;
  request.httpVersionMinor = 1;
  request.push(null);

  const response = new http.ServerResponse(request);
  response.assignSocket(socket);

  const done = new Promise((resolve, reject) => {
    const originalWrite = response.write.bind(response);
    response.write = (chunk, encoding, callback) => {
      if (chunk) {
        bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      }
      return originalWrite(chunk, encoding, callback);
    };

    const originalEnd = response.end.bind(response);
    response.end = (chunk, encoding, callback) => {
      if (chunk) {
        bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      }
      const result = originalEnd(chunk, encoding, callback);
      setImmediate(() => {
        const payload = Buffer.concat(bodyChunks);
        socket.forceDestroy();
        resolve({
          status: response.statusCode,
          headers: response.getHeaders(),
          payload
        });
      });
      return result;
    };

    response.on('error', reject);
  });

  targetApp.handle(request, response, (error) => {
    if (error) {
      response.destroy(error);
    }
  });

  return done;
}

async function request(relativeUrl, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.token) {
    headers.authorization = `Bearer ${options.token}`;
  }

  const result = await injectRequest(app, {
    method: options.method || 'GET',
    url: relativeUrl,
    headers
  });
  const contentType = String(result.headers['content-type'] || '');

  return {
    body: contentType.includes('application/json')
      ? JSON.parse(result.payload.toString('utf8'))
      : result.payload,
    response: {
      status: result.status,
      headers: {
        get(name) {
          const value = result.headers[name.toLowerCase()];
          return Array.isArray(value) ? value.join(', ') : value == null ? null : String(value);
        }
      }
    }
  };
}

function localizeSignedUrl(value, assetId) {
  const signedUrl = new URL(value);
  assert.equal(signedUrl.origin, 'https://api.transferly.test');
  assert.equal(signedUrl.pathname, `/api/assets/${assetId}/download`);
  return `${signedUrl.pathname}${signedUrl.search}`;
}

function tamperToken(token) {
  const parts = token.split('.');
  const replacement = parts[2][0] === 'a' ? 'b' : 'a';
  parts[2] = `${replacement}${parts[2].slice(1)}`;
  return parts.join('.');
}

before(async () => {
  await migrate();
  const now = new Date().toISOString();
  const service = await db.get('SELECT id, slug FROM services ORDER BY display_order ASC LIMIT 1');

  await db.run(
    'INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)',
    ['asset-owner', 'asset-owner@example.com', now, now]
  );
  await db.run(
    'INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)',
    ['asset-other', 'asset-other@example.com', now, now]
  );
  await orderRepository.create({
    id: 'asset-order-owner',
    userId: 'asset-owner',
    idempotencyKey: 'asset-order-owner-key',
    serviceId: service.id,
    serviceSlug: service.slug,
    status: 'completed',
    pointCost: 0,
    queueStatus: 'completed',
    completedAt: now
  });

  const storage = createLocalPrivateStorageAdapter();
  const ownerStored = await storage.write({
    content: ownerContent,
    mimeType: 'text/plain'
  });
  ownerAsset = await generatedAssetRepository.create({
    orderId: 'asset-order-owner',
    userId: 'asset-owner',
    assetType: 'verified-record',
    ...ownerStored,
    classification: 'private',
    expiresAt: new Date(Date.now() + 60_000).toISOString()
  });

  const expiringStored = await storage.write({
    content: 'short lived content',
    mimeType: 'text/plain'
  });
  expiringAsset = await generatedAssetRepository.create({
    orderId: 'asset-order-owner',
    userId: 'asset-owner',
    assetType: 'support-page',
    ...expiringStored,
    classification: 'private',
    expiresAt: new Date(Date.now() + 60_000).toISOString()
  });

  app = createApp();
});

after(async () => {
  await close();
  fs.rmSync(testDir, { force: true, recursive: true });
});

describe('generated asset API', () => {
  test('requires authentication and hides asset existence across user boundaries', async () => {
    const unauthenticated = await request(`/api/assets/${ownerAsset.id}`);
    assert.equal(unauthenticated.response.status, 401);
    assert.equal(unauthenticated.body.code, 'USER_AUTH_REQUIRED');

    const detail = await request(`/api/assets/${ownerAsset.id}`, { token: 'owner-token' });
    assert.equal(detail.response.status, 200);
    assert.equal(detail.body.asset.id, ownerAsset.id);
    assert.equal(detail.body.asset.checksum, ownerAsset.checksum);
    assert.equal(Object.hasOwn(detail.body.asset, 'storage_key'), false);
    assert.equal(Object.hasOwn(detail.body.asset, 'user_id'), false);

    const list = await request('/api/orders/asset-order-owner/assets', { token: 'owner-token' });
    assert.equal(list.response.status, 200);
    assert.deepEqual(
      list.body.assets.map((asset) => asset.id).sort(),
      [ownerAsset.id, expiringAsset.id].sort()
    );
    assert.equal(list.body.assets.every((asset) => !Object.hasOwn(asset, 'storage_key')), true);

    const crossUserDetail = await request(`/api/assets/${ownerAsset.id}`, { token: 'other-token' });
    assert.equal(crossUserDetail.response.status, 404);
    assert.equal(crossUserDetail.body.code, 'ASSET_NOT_FOUND');

    const crossUserList = await request('/api/orders/asset-order-owner/assets', { token: 'other-token' });
    assert.equal(crossUserList.response.status, 404);
    assert.equal(crossUserList.body.code, 'ORDER_NOT_FOUND');

    const crossUserDownload = await request(`/api/assets/${ownerAsset.id}/download-url`, {
      method: 'POST',
      token: 'other-token'
    });
    assert.equal(crossUserDownload.response.status, 404);
    assert.equal(crossUserDownload.body.code, 'ASSET_NOT_FOUND');
  });

  test('issues audited signed URLs and rejects tampering, mismatch, and expired assets', async () => {
    const issued = await request(`/api/assets/${ownerAsset.id}/download-url`, {
      method: 'POST',
      token: 'owner-token'
    });
    assert.equal(issued.response.status, 200);
    assert.equal(issued.body.asset.id, ownerAsset.id);
    assert.equal(Object.hasOwn(issued.body, 'storage_key'), false);

    const localSignedPath = localizeSignedUrl(issued.body.download_url, ownerAsset.id);
    assert.equal(issued.body.download_url.includes(ownerAsset.storageKey), false);

    const auditEntries = await auditLogRepository.findManyForEntity('generated_asset', ownerAsset.id);
    assert.equal(auditEntries[0].action, 'generated_asset.download_url_issued');
    assert.equal(auditEntries[0].actorId, 'asset-owner');
    assert.equal(Object.hasOwn(auditEntries[0].metadata, 'token'), false);

    const downloaded = await request(localSignedPath);
    assert.equal(downloaded.response.status, 200);
    assert.deepEqual(downloaded.body, ownerContent);
    assert.match(downloaded.response.headers.get('content-type'), /^text\/plain/);
    assert.equal(downloaded.response.headers.get('cache-control'), 'private, no-store');
    assert.equal(downloaded.response.headers.get('x-content-sha256'), ownerAsset.checksum);
    assert.match(downloaded.response.headers.get('content-disposition'), /^attachment; filename="transferly-/);

    const signedUrl = new URL(issued.body.download_url);
    const tamperedUrl = new URL(signedUrl);
    tamperedUrl.searchParams.set('token', tamperToken(signedUrl.searchParams.get('token')));
    const tampered = await request(`${tamperedUrl.pathname}${tamperedUrl.search}`);
    assert.equal(tampered.response.status, 401);
    assert.equal(tampered.body.code, 'ASSET_DOWNLOAD_TOKEN_INVALID');

    const mismatched = await request(
      `/api/assets/${expiringAsset.id}/download?token=${encodeURIComponent(signedUrl.searchParams.get('token'))}`
    );
    assert.equal(mismatched.response.status, 401);
    assert.equal(mismatched.body.code, 'ASSET_DOWNLOAD_TOKEN_INVALID');

    const shortLived = await request(`/api/assets/${expiringAsset.id}/download-url`, {
      method: 'POST',
      token: 'owner-token'
    });
    assert.equal(shortLived.response.status, 200);
    await db.run(
      'UPDATE generated_assets SET expires_at = ? WHERE id = ?',
      [new Date(Date.now() - 1000).toISOString(), expiringAsset.id]
    );

    const expired = await request(localizeSignedUrl(shortLived.body.download_url, expiringAsset.id));
    assert.equal(expired.response.status, 410);
    assert.equal(expired.body.code, 'ASSET_EXPIRED');
  });
});
