const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'services', 'leads', 'pagespeed-performance-presentation.ts'), 'utf8');
const detailSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'pages', 'commercial', 'LeadDetailPage.tsx'), 'utf8');
const diagnosticsSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'pages', 'commercial', 'WebsiteDiagnosticsPage.tsx'), 'utf8');

test('PageSpeed presentation handles statuses, score and metric nullability', () => {
  assert.match(source, /unknown:\s*"Indisponível"/);
  assert.match(source, /pending:\s*"Análise aguardando processamento\."/);
  assert.match(source, /score >= 0 && score <= 100/);
  assert.match(source, /Score indisponível/);
  assert.match(source, /value >= 0 \? `\$\{value\} ms`/);
  assert.match(source, /value >= 0 \? String\(value\) : "—"/);
  assert.match(source, /formatPageSpeedDate/);
  assert.match(source, /Number\.isNaN\(date\.getTime\(\)\)/);
});

test('PageSpeed presentation distinguishes CrUX sources and unavailable data', () => {
  assert.match(source, /source === "url" \? "Página analisada"/);
  assert.match(source, /source === "origin" \? "Origem\/domínio"/);
  assert.match(source, /Dados de usuários reais não disponíveis para esta página/);
  assert.match(source, /formatPageSpeedMs\(lab\.fcpMs\)/);
  assert.match(source, /formatPageSpeedCls\(lab\.cls\)/);
});

test('PageSpeed metric help has one source of truth for explanations and thresholds', () => {
  for (const key of ['fcp', 'lcp', 'cls', 'speedIndex', 'tbt', 'ttfb']) {
    assert.match(source, new RegExp(`${key}: \\{`));
    assert.match(source, new RegExp(`${key}[\\s\\S]*healthyReference`));
  }
  assert.match(source, /pageSpeedMetricTone/);
  assert.match(source, /threshold: 0\.1/);
  assert.match(source, /unit: "cls"/);
});

test('PageSpeed date formatter rejects empty and invalid dates without exposing Invalid Date', () => {
  assert.match(source, /if \(!value \|\| typeof value !== "string"\) return null/);
  assert.match(source, /return Number\.isNaN\(date\.getTime\(\)\) \? null/);
  assert.doesNotMatch(source, /new Date\(value\)\.toLocaleString/);
});

test('Lead detail keeps PageSpeed independent and clears stale performance state', () => {
  assert.match(detailSource, /setWebsitePerformance\(null\);\s*setPerformanceLoading\(true\)/);
  assert.match(detailSource, /\}<PageSpeedSection website=\{website\}/);
  assert.match(detailSource, /if \(active\) setWebsitePerformance\(payload\)/);
});

test('diagnostics keeps Performance exclusive and preserves mixed-content semantics', () => {
  assert.match(diagnosticsSource, /PerformanceSection/);
  assert.match(diagnosticsSource, /sm:grid-cols-2 lg:grid-cols-4/);
  assert.doesNotMatch(diagnosticsSource, /label="Performance".*Analisar performance/);
  assert.match(diagnosticsSource, /label="Conteúdo misto" value=\{security\.mixedContent\} negative/);
});
