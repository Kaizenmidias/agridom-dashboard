const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { GOOGLE_ENDPOINT, requestPageSpeed, validateRequestUrl } = require('../services/pagespeed-google-transport');
const { configuredKey, processNextPageSpeedJob } = require('../pagespeed-worker');
const { startPageSpeedWorker } = require('../pagespeed-worker');

test('PageSpeed worker stays disabled without a usable API key', async () => {
  for (const value of [undefined, '', '   ']) {
    let acquired = false;
    const result = await processNextPageSpeedJob({ apiKey: value, acquire: async () => { acquired = true; }, provider: async () => { throw new Error('must not run'); } });
    assert.deepEqual(result, { processed: false, reason: 'disabled' });
    assert.equal(acquired, false);
  }
  assert.equal(configuredKey('  key  '), 'key');
  assert.equal(configuredKey(''), null);
});

test('worker acquires one job, calls provider, and persists normalized output', async () => {
  const calls = [];
  const normalized = { strategy: 'mobile', score: 82, lab: null, field: { available: false }, opportunities: [], status: 'completed' };
  const result = await processNextPageSpeedJob({ apiKey: 'test-key', connection: {}, pool: {}, acquire: async () => ({ id: 4, prospect_id: 8, website_url: 'https://example.test', strategy: 'mobile', attempt_count: 1 }), provider: async (input) => { calls.push(input); return normalized; }, persist: async (input) => calls.push(['persist', input.normalized]), recordFailure: async () => { throw new Error('must not run'); } });
  assert.equal(result.status, 'completed');
  assert.equal(calls[0].url, 'https://example.test');
  assert.equal(calls[0].strategy, 'mobile');
  assert.equal(calls[0].apiKey, 'test-key');
  assert.deepEqual(calls[1], ['persist', normalized]);
});

test('worker records provider failures and does not implement a second attempt', async () => {
  let acquireCount = 0;
  let failure;
  const result = await processNextPageSpeedJob({ apiKey: 'test-key', connection: {}, pool: {}, acquire: async () => { acquireCount += 1; return { id: 5, prospect_id: 9, website_url: 'https://example.test', strategy: 'mobile', attempt_count: 1 }; }, provider: async () => { throw Object.assign(new Error('quota'), { classification: 'quota' }); }, recordFailure: async (input) => { failure = input; return { status: 'failed' }; } });
  assert.equal(result.status, 'failed');
  assert.equal(acquireCount, 1);
  assert.equal(failure.kind, 'quota');
});

test('worker survives a provider failure followed by failure-persistence failure', async () => {
  let providerCount = 0;
  let failureCount = 0;
  const result = await processNextPageSpeedJob({ apiKey: 'test-key', connection: {}, pool: {}, acquire: async () => ({ id: 6, prospect_id: 10, website_url: 'https://example.test', strategy: 'mobile', attempt_count: 1 }), provider: async () => { providerCount += 1; throw Object.assign(new Error('provider'), { classification: 'transient' }); }, recordFailure: async () => { failureCount += 1; throw new Error('database unavailable'); } });
  assert.equal(result.status, 'failure_persistence_failed');
  assert.equal(providerCount, 1);
  assert.equal(failureCount, 1);
});

test('worker continues after an unexpected cycle error and waits before the next cycle', async () => {
  let acquireCount = 0;
  let waits = 0;
  const listeners = new Map();
  const fakeProcess = { once: (signal, handler) => listeners.set(signal, handler), removeListener: () => {} };
  await startPageSpeedWorker({ apiKey: 'test-key', process: fakeProcess, pollMs: 7, connectionFactory: async () => ({ release() {} }), acquire: async () => { acquireCount += 1; if (acquireCount === 1) throw new Error('cycle'); return null; }, sleep: async () => { waits += 1; if (waits === 2) listeners.get('SIGTERM')(); }, closeConnection: async () => {} });
  assert.equal(acquireCount, 2);
  assert.equal(waits, 2);
});

test('transport accepts only the fixed Google HTTPS endpoint', () => {
  assert.equal(validateRequestUrl(`${GOOGLE_ENDPOINT}?url=https%3A%2F%2Fexample.test`).hostname, 'www.googleapis.com');
  assert.equal(validateRequestUrl('https://www.googleapis.com:443/pagespeedonline/v5/runPagespeed').port, '');
  assert.equal(validateRequestUrl(`${GOOGLE_ENDPOINT}?key=secret`).port, '');
  assert.throws(() => validateRequestUrl('https://www.googleapis.com:444/pagespeedonline/v5/runPagespeed'), /not allowed/);
  assert.throws(() => validateRequestUrl('http://www.googleapis.com/pagespeedonline/v5/runPagespeed'), /not allowed/);
  assert.throws(() => validateRequestUrl('https://evil.example/pagespeedonline/v5/runPagespeed'), /not allowed/);
  assert.throws(() => validateRequestUrl('https://www.googleapis.com/other'), /not allowed/);
  assert.throws(() => validateRequestUrl('https://user@www.googleapis.com/pagespeedonline/v5/runPagespeed'), /not allowed/);
  assert.throws(() => validateRequestUrl('https://user:pass@www.googleapis.com/pagespeedonline/v5/runPagespeed'), /not allowed/);
});

function fakeResponse(statusCode, body) {
  const response = new EventEmitter();
  response.statusCode = statusCode;
  response.headers = { location: 'https://other.example' };
  process.nextTick(() => { response.emit('data', Buffer.from(body)); response.emit('end'); });
  return response;
}

test('transport uses GET, forwards limits, returns buffers, and never follows redirects', async () => {
  let requestOptions;
  const request = (options, callback) => {
    requestOptions = options;
    const req = new EventEmitter();
    req.setTimeout = () => {};
    req.destroy = () => {};
    req.end = () => {};
    process.nextTick(() => callback(fakeResponse(301, 'redirect')));
    return req;
  };
  const result = await requestPageSpeed({ url: `${GOOGLE_ENDPOINT}?key=secret`, timeoutMs: 1234, maxBytes: 100, request });
  assert.equal(requestOptions.method, 'GET');
  assert.equal(requestOptions.timeout, 1234);
  assert.equal(result.statusCode, 301);
  assert.ok(Buffer.isBuffer(result.body));
  assert.equal(result.headers.location, 'https://other.example');
});

test('transport aborts oversized responses without network access', async () => {
  const request = (options, callback) => {
    const req = new EventEmitter();
    req.setTimeout = () => {};
    req.destroy = () => {};
    req.end = () => {};
    process.nextTick(() => callback(fakeResponse(200, '123456')));
    return req;
  };
  await assert.rejects(() => requestPageSpeed({ url: GOOGLE_ENDPOINT, maxBytes: 5, request }), (error) => error.code === 'PAGESPEED_RESPONSE_TOO_LARGE');
});

test('transport returns every HTTP status without classifying or following it', async () => {
  for (const statusCode of [200, 301, 302, 307, 308, 400, 429, 500, 503]) {
    const request = (options, callback) => {
      const req = new EventEmitter();
      req.setTimeout = () => {};
      req.destroy = () => {};
      req.end = () => process.nextTick(() => callback(fakeResponse(statusCode, `body-${statusCode}`)));
      return req;
    };
    const response = await requestPageSpeed({ url: GOOGLE_ENDPOINT, request });
    assert.equal(response.statusCode, statusCode);
    assert.equal(response.body.toString(), `body-${statusCode}`);
  }
});

test('transport ignores late error after timeout or oversized destroy', async () => {
  let destroyed = 0;
  const timeoutRequest = (options, callback) => {
    const req = new EventEmitter();
    req.setTimeout = (ms, handler) => process.nextTick(handler);
    req.destroy = () => { destroyed += 1; process.nextTick(() => req.emit('error', new Error('late socket error'))); };
    req.end = () => {};
    return req;
  };
  await assert.rejects(() => requestPageSpeed({ url: GOOGLE_ENDPOINT, request: timeoutRequest }), (error) => error.code === 'PAGESPEED_TIMEOUT');
  assert.equal(destroyed, 1);
});

test('prospecting schedules PageSpeed only for created prospects with websites after commit', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'services', 'prospecting-service.js'), 'utf8');
  const commit = source.indexOf('await connection.commit();');
  const schedule = source.indexOf('schedulePageSpeedAnalysis', commit);
  assert.ok(commit >= 0 && schedule > commit);
  assert.match(source.slice(schedule - 180, schedule + 300), /candidateResult\.created && candidateResult\.website/);
  assert.match(source.slice(schedule, schedule + 500), /connection:\s*getPool\(\)/);
});

test('PageSpeed remains isolated from the main worker and does not run there', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'worker.js'), 'utf8');
  assert.doesNotMatch(source, /pagespeed-performance|runGooglePageSpeed|processNextPageSpeedJob/);
});
