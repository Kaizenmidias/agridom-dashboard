const assert = require('node:assert/strict');
const test = require('node:test');
const { parsePage } = require('../services/website-enrichment-parser');
const { createPinnedLookup, validateUrl, fetchHtml } = require('../services/website-enrichment-ssrf');
const { claimNextEnrichment, crawlWebsite, mergeResults, normalizePageUrl, persistEnrichment, websiteUrl } = require('../services/website-enrichment-service');
const enrichmentServiceSource = require('node:fs').readFileSync(require('node:path').join(__dirname, '../services/website-enrichment-service.js'), 'utf8');

const html = `<!doctype html><html><head><title>Empresa</title><meta name="description" content="Descricao"><meta name="viewport" content="width=device-width"><link rel="canonical" href="https://empresa.test/"><script type="application/ld+json">{"@type":"Organization","name":"Empresa Teste","email":"contato@empresa.test","telephone":"+55 11 99999-0000","address":{"streetAddress":"Rua A, 10","addressLocality":"Sao Paulo","addressRegion":"SP"}}</script><script src="https://www.googletagmanager.com/gtag/js"></script></head><body><h1>Empresa</h1><a href="mailto:financeiro@empresa.test">Email</a><a href="tel:+5511999990000">Telefone</a><a href="https://instagram.com/empresa">Instagram</a><a href="https://linkedin.com/company/empresa">LinkedIn</a><img src="a.jpg"><img src="b.jpg" alt="Produto"></body></html>`;

test('extrai dados públicos e sinais objetivos da página', () => {
  const result = parsePage(html, 'https://empresa.test/');
  assert.equal(result.fields.email, 'financeiro@empresa.test');
  assert.equal(result.fields.instagram, 'https://www.instagram.com/empresa/');
  assert.equal(result.fields.linkedin, 'https://www.linkedin.com/company/empresa/');
  assert.equal(result.fields.phone, '+5511999990000');
  assert.equal(result.fields.address, 'Rua A, 10, Sao Paulo, SP');
  assert.equal(result.diagnostic.seo.titlePresent, true);
  assert.equal(result.diagnostic.seo.h1Count, 1);
  assert.equal(result.diagnostic.seo.imagesWithoutAlt, 1);
  assert.equal(result.diagnostic.mobile.viewport, true);
  assert.equal(result.diagnostic.marketing.googleAnalytics, true);
});

test('extrai email encontrado em texto público', () => {
  const result = parsePage('<p>Fale com financeiro@empresa.test para saber mais.</p>', 'https://empresa.test');
  assert.equal(result.fields.email, 'financeiro@empresa.test');
});

test('registra headers de segurança e tempo quando fornecidos', () => {
  const result = parsePage('<title>x</title>', 'https://empresa.test', { responseTimeMs: 1234, headers: new Map([['content-security-policy', "default-src 'self'"]]) });
  assert.equal(result.diagnostic.performance.responseTimeMs, 1234);
  assert.equal(result.diagnostic.security.headers.contentSecurityPolicy, "default-src 'self'");
});

test('filtra links sociais de compartilhamento', () => {
  const result = parsePage('<a href="https://linkedin.com/shareArticle?x=1">x</a><a href="https://instagram.com/p/1">x</a>', 'https://empresa.test');
  assert.equal(result.fields.linkedin, null);
  assert.equal(result.fields.instagram, null);
});

test('merge preserva campos existentes e combina diagnóstico', () => {
  const result = mergeResults([{ fields: { email: 'novo@empresa.test', linkedin: 'https://www.linkedin.com/company/empresa/' }, links: [], diagnostic: { technology: { wordpress: true }, seo: { titlePresent: true }, marketing: {}, mobile: { viewport: true }, security: { headers: {} }, performance: { htmlSizeBytes: 10, scriptCount: 1, stylesheetCount: 0, imageCount: 0 }, opportunities: ['Meta Pixel nao detectado'] } }]);
  assert.equal(result.fields.email, 'novo@empresa.test');
  assert.equal(result.diagnostic.technology.wordpress, true);
  assert.deepEqual(result.diagnostic.opportunities, ['Meta Pixel nao detectado']);
});

test('SSRF bloqueia loopback e redes privadas', async () => {
  await assert.rejects(() => validateUrl('http://127.0.0.1/'), { code: 'ENRICHMENT_SSRF_BLOCKED' });
  await assert.rejects(() => validateUrl('http://empresa.test/', { resolve: async () => [{ address: '10.0.0.5' }] }), { code: 'ENRICHMENT_SSRF_BLOCKED' });
  await assert.rejects(() => validateUrl('file:///etc/passwd'), { code: 'ENRICHMENT_URL_BLOCKED' });
  await assert.rejects(() => validateUrl('http://[::ffff:127.0.0.1]/'), { code: 'ENRICHMENT_SSRF_BLOCKED' });
  await assert.rejects(() => validateUrl('http://empresa.test/', { resolve: async () => [{ address: '8.8.8.8' }, { address: '192.168.1.1' }] }), { code: 'ENRICHMENT_SSRF_BLOCKED' });
});

test('redirect é validado antes do próximo acesso', async () => {
  let calls = 0;
  const fetchMock = async () => ({ statusCode: 302, headers: { location: 'http://127.0.0.1/private' } });
  await assert.rejects(() => fetchHtml('https://empresa.test', { resolve: async () => [{ address: '93.184.216.34' }], request: async () => { calls += 1; return fetchMock(); } }), { code: 'ENRICHMENT_SSRF_BLOCKED' });
  assert.equal(calls, 1);
});

test('normaliza website sem inventar protocolo duplicado', () => {
  assert.equal(websiteUrl('empresa.test'), 'https://empresa.test');
  assert.equal(websiteUrl('https://empresa.test'), 'https://empresa.test');
  assert.equal(websiteUrl(''), null);
});

test('fixa o IP validado no transporte e preserva Host/SNI/TLS', () => {
  assert.match(require('node:fs').readFileSync(require('node:path').join(__dirname, '../services/website-enrichment-ssrf.js'), 'utf8'), /createPinnedLookup\(validated\)/);
  assert.match(require('node:fs').readFileSync(require('node:path').join(__dirname, '../services/website-enrichment-ssrf.js'), 'utf8'), /servername: url\.hostname/);
  assert.match(require('node:fs').readFileSync(require('node:path').join(__dirname, '../services/website-enrichment-ssrf.js'), 'utf8'), /rejectUnauthorized: true/);
});

test('transporte HTTPS fixa IP, Host e SNI sem nova resolução DNS', async () => {
  let resolveCalls = 0;
  let captured;
  const response = {
    statusCode: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    async *[Symbol.asyncIterator]() { yield Buffer.from('<html><body>ok</body></html>'); },
  };
  const requestClient = { request: (url, requestOptions, onResponse) => {
    captured = { url, requestOptions };
    const lookupResults = [];
    requestOptions.lookup('www.jlramos.com.br', { all: true }, (_error, addresses) => lookupResults.push(addresses));
    requestOptions.lookup('www.jlramos.com.br', { all: false }, (_error, address, family) => lookupResults.push({ address, family }));
    assert.deepEqual(lookupResults, [[{ address: '50.116.87.174', family: 4 }], { address: '50.116.87.174', family: 4 }]);
    onResponse(response);
    return { setTimeout() {}, on() {}, end() {} };
  } };
  const result = await fetchHtml('https://www.jlramos.com.br/', { resolve: async () => { resolveCalls += 1; return [{ address: '50.116.87.174', family: 4 }]; }, requestClient });
  assert.equal(resolveCalls, 1);
  assert.equal(captured.url.hostname, 'www.jlramos.com.br');
  assert.equal(captured.requestOptions.headers.host, 'www.jlramos.com.br');
  assert.equal(captured.requestOptions.servername, 'www.jlramos.com.br');
  assert.equal(captured.requestOptions.rejectUnauthorized, true);
  assert.equal(result.html, '<html><body>ok</body></html>');
});

test('claim trata processing stale com limite de cinco minutos e sem resetar tentativas', () => {
  assert.match(enrichmentServiceSource, /status = 'processing'.*INTERVAL 5 MINUTE/);
  assert.match(enrichmentServiceSource, /attempt_count >= \?/);
  assert.match(enrichmentServiceSource, /attempt_count < \?/);
});

test('claim usa a interface nativa de uma conexão mysql transacional', async () => {
  const calls = [];
  const connection = {
    beginTransaction: async () => calls.push('begin'),
    commit: async () => calls.push('commit'),
    rollback: async () => calls.push('rollback'),
    execute: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT')) return [[{ id: 42, prospect_id: 8, attempt_count: 0, website_url: 'https://empresa.test' }], {}];
      return [{ affectedRows: 1 }, {}];
    },
  };
  const job = await claimNextEnrichment({ connection, workerId: 'test-worker' });
  assert.equal(job.id, 42);
  assert.equal(job.attempt_count, 1);
  assert.deepEqual(calls.filter((call) => typeof call === 'string'), ['begin', 'commit']);
  assert.match(calls.find((call) => typeof call !== 'string' && call.sql.startsWith('SELECT')).sql, /FOR UPDATE/);
  const processingUpdate = calls.find((call) => typeof call !== 'string' && call.sql.includes("SET status = 'processing'"));
  assert.match(processingUpdate.sql, /attempt_count = attempt_count \+ 1/);
  assert.match(processingUpdate.sql, /started_at = CURRENT_TIMESTAMP/);
});

test('analysis_report inválido não é persistido por merge inseguro', () => {
  assert.match(enrichmentServiceSource, /reportIsSafe = false/);
  assert.match(enrichmentServiceSource, /canPersistLinkedin = reportIsSafe/);
});

test('whitespace pode ser preenchido, mas valor existente é preservado', () => {
  assert.match(enrichmentServiceSource, /isBlank\(job\.email\)/);
  assert.match(enrichmentServiceSource, /isBlank\(job\.phone\)/);
  assert.match(enrichmentServiceSource, /isBlank\(job\.address\)/);
  assert.match(enrichmentServiceSource, /isBlank\(job\.instagram\)/);
});

test('telefone só vem de tel, schema ou WhatsApp, nunca de número arbitrário', () => {
  assert.equal(parsePage('<p>Pedido 551933334444 protocolo 1234567890</p>', 'https://empresa.test').fields.phone, null);
  assert.equal(parsePage('<a href="tel:+551933334444">Ligue</a>', 'https://empresa.test').fields.phone, '+551933334444');
  assert.equal(parsePage('<script type="application/ld+json">{"@type":"Organization","telephone":"+55 19 3333-4444"}</script>', 'https://empresa.test').fields.phone, '+55 19 3333-4444');
});

test('normaliza fragmentos e tracking antes da deduplicação', () => {
  assert.equal(normalizePageUrl('/contato#formulario', 'https://empresa.test'), 'https://empresa.test/contato');
  assert.equal(normalizePageUrl('/contato?utm_source=google&fbclid=123', 'https://empresa.test'), 'https://empresa.test/contato');
});

test('crawler visita páginas institucionais antes de links genéricos', async () => {
  const visited = [];
  const home = '<a href="/blog">blog</a><a href="/produtos">produtos</a><a href="/noticias">noticias</a><a href="/portfolio">portfolio</a><a href="/servicos">servicos</a><a href="/contato">contato</a><a href="/sobre">sobre</a><a href="/quem-somos">quem</a>';
  const pages = await crawlWebsite('https://empresa.test', { maxPages: 5, fetchHtml: async (url) => { visited.push(url); return { url, html: url === 'https://empresa.test/' ? home : '<title>ok</title>', responseTimeMs: 1, headers: new Map() }; } });
  assert.equal(pages.length, 5);
  assert.deepEqual(visited.slice(1), ['https://empresa.test/contato', 'https://empresa.test/sobre', 'https://empresa.test/quem-somos', 'https://empresa.test/blog']);
});

test('status completed, partial e failed refletem processamento', async () => {
  const calls = [];
  const connection = { execute: async (sql, params) => { calls.push({ sql, params }); return [[], {}]; } };
  const base = { id: 1, prospect_id: 1, email: null, phone: null, address: null, instagram: null, business_name: 'Empresa', analysis_report: null };
  await persistEnrichment({ connection, job: base, result: { fields: {}, diagnostic: { pagesAnalyzed: 1, opportunities: ['Meta Pixel nao detectado'], partialError: null } } });
  await persistEnrichment({ connection, job: { ...base, id: 2 }, result: { fields: {}, diagnostic: { pagesAnalyzed: 1, opportunities: [], partialError: { code: 'ENRICHMENT_TIMEOUT' } } } });
  await persistEnrichment({ connection, job: { ...base, id: 3 }, result: { fields: {}, diagnostic: { pagesAnalyzed: 0, opportunities: [], partialError: null } } });
  const statusCalls = calls.filter((call) => call.sql.includes('UPDATE lead_website_enrichments'));
  assert.deepEqual(statusCalls.map((call) => call.params[0]), ['completed', 'partial', 'failed']);
});

test('timeout individual aborta mock pendente e streaming excedente é rejeitado', async () => {
  await assert.rejects(() => fetchHtml('https://empresa.test', { timeoutMs: 5, resolve: async () => [{ address: '8.8.8.8' }], request: () => new Promise(() => {}) }), { code: 'ENRICHMENT_TIMEOUT' });
  const oversized = { statusCode: 200, headers: { 'content-type': 'text/html' }, destroy() {}, async *[Symbol.asyncIterator]() { yield Buffer.alloc(8); yield Buffer.alloc(8); } };
  await assert.rejects(() => fetchHtml('https://empresa.test', { maxBytes: 10, resolve: async () => [{ address: '8.8.8.8' }], request: async () => oversized }), { code: 'ENRICHMENT_SIZE_LIMIT' });
});

test('não depende de Apify nem de serviços externos', () => {
  assert.equal(typeof parsePage, 'function');
});

test('persistencia preserva campos do Prospect que ja possuem valor', async () => {
  const calls = [];
  const connection = { execute: async (sql, params) => { calls.push({ sql, params }); return [[], {}]; } };
  await persistEnrichment({ connection, job: { id: 7, prospect_id: 19, email: 'existente@empresa.com', phone: '5511999999999', address: 'Endereco existente', instagram: null, business_name: 'Empresa', analysis_report: null }, result: { fields: { email: 'novo@empresa.com', phone: '5511888888888', address: 'Novo endereco', instagram: 'https://www.instagram.com/empresa/' }, diagnostic: { pagesAnalyzed: 1, opportunities: [], partialError: null } } });
  const prospectUpdate = calls.find((call) => call.sql.startsWith('UPDATE prospects'));
  assert.match(prospectUpdate.sql, /instagram = \?/);
  assert.doesNotMatch(prospectUpdate.sql, /email = \?|phone = \?|address = \?/);
});

test('rejeita assets como email e aceita dominios comerciais reais', () => {
  assert.equal(parsePage('<p>service-img-02@2x.jpg banner@2x.png logo@3x.webp</p>', 'https://empresa.test').fields.email, null);
  assert.equal(parsePage('<p>contato@empresa.com.br financeiro@empresa.com suporte@empresa.digital</p>', 'https://empresa.test').fields.email, 'contato@empresa.com.br');
});

test('mantem email mailto e JSON-LD validos', () => {
  assert.equal(parsePage('<a href="mailto:financeiro@empresa.com">Email</a>', 'https://empresa.test').fields.email, 'financeiro@empresa.com');
  assert.equal(parsePage('<script type="application/ld+json">{"@type":"Organization","email":"contato@empresa.com.br"}</script>', 'https://empresa.test').fields.email, 'contato@empresa.com.br');
});

test('consolida oportunidades e preserva a semantica SEO da primeira pagina', () => {
  const page = (imagesWithoutAlt, opportunities) => ({ fields: {}, diagnostic: { technology: {}, seo: { imagesWithoutAlt }, marketing: {}, mobile: {}, security: { headers: {} }, performance: {}, opportunities } });
  const result = mergeResults([page(10, ['Meta Pixel nao detectado', '10 imagens sem atributo alt']), page(2, ['Meta Pixel nao detectado', '2 imagens sem atributo alt']), page(5, ['Meta Pixel nao detectado', '5 imagens sem atributo alt'])]);
  assert.equal(result.diagnostic.seo.imagesWithoutAlt, 10);
  assert.deepEqual(result.diagnostic.opportunities, ['Meta Pixel nao detectado', '10 imagens sem atributo alt']);
});
