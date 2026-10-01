const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));

function scoreSignals(signals) {
  const valid = signals.filter((item) => typeof item.value === 'boolean');
  return valid.length ? clamp(valid.reduce((sum, item) => sum + (item.value ? item.weight : 0), 0) / valid.reduce((sum, item) => sum + item.weight, 0) * 100) : null;
}

function buildDiagnosticResult(merged, context = {}) {
  const d = merged.diagnostic || {};
  const seo = d.seo || {};
  const marketing = d.marketing || {};
  const security = d.security || {};
  const mobile = d.mobile || {};
  const technology = d.technology || {};
  const securityHeaders = security.headers || {};
  const checks = {
    seo: [{ id: 'title', label: 'Title presente', value: seo.titlePresent, weight: 2 }, { id: 'description', label: 'Meta description presente', value: seo.metaDescriptionPresent, weight: 2 }, { id: 'canonical', label: 'Canonical presente', value: seo.canonical, weight: 1 }, { id: 'headings', label: 'H1 identificado', value: seo.h1Count > 0, weight: 1 }, { id: 'structured-data', label: 'Dados estruturados', value: seo.structuredData, weight: 1 }],
    security: [{ id: 'https', label: 'HTTPS', value: security.https, weight: 3 }, { id: 'mixed-content', label: 'Sem conteúdo misto', value: security.mixedContent === false, weight: 2 }, { id: 'csp', label: 'CSP', value: Boolean(securityHeaders.contentSecurityPolicy), weight: 1 }, { id: 'hsts', label: 'HSTS', value: Boolean(securityHeaders.strictTransportSecurity), weight: 1 }],
    mobile: [{ id: 'viewport', label: 'Viewport', value: mobile.viewport, weight: 1 }],
    html: [{ id: 'images-alt', label: 'Imagens com alt', value: seo.imagesWithoutAlt === 0, weight: 1 }, { id: 'title-structure', label: 'Estrutura de título', value: seo.titlePresent, weight: 1 }],
  };
  const scores = {
    seo: scoreSignals([
      { value: seo.titlePresent, weight: 2 }, { value: seo.metaDescriptionPresent, weight: 2 },
      { value: seo.canonical, weight: 1 }, { value: seo.robotsMeta, weight: 1 },
      { value: seo.structuredData, weight: 2 }, { value: seo.openGraph, weight: 1 },
      { value: seo.h1Count > 0, weight: 1 }, { value: seo.imagesWithoutAlt === 0, weight: 1 },
    ]),
    mobile: scoreSignals([{ value: mobile.viewport, weight: 1 }, { value: marketing.contactForm, weight: 1 }, { value: marketing.clickablePhone || marketing.clickableEmail, weight: 1 }]),
    security: scoreSignals([
      { value: security.https, weight: 3 }, { value: security.mixedContent === false, weight: 2 },
      { value: Boolean(securityHeaders.contentSecurityPolicy), weight: 1 }, { value: Boolean(securityHeaders.xContentTypeOptions), weight: 1 },
      { value: Boolean(securityHeaders.referrerPolicy), weight: 1 }, { value: Boolean(securityHeaders.strictTransportSecurity), weight: 1 },
    ]),
    html: scoreSignals(checks.html),
  };
  const scoreBreakdown = Object.fromEntries(Object.entries({ seo: checks.seo, security: checks.security, mobile: checks.mobile, html: checks.html }).map(([category, categoryChecks]) => [category, { score: scoreSignals(categoryChecks), weight: { seo: 0.35, security: 0.35, mobile: 0.15, html: 0.15 }[category], available: categoryChecks.some((check) => typeof check.value === 'boolean'), checks: categoryChecks.map((check) => ({ id: check.id, label: check.label, status: check.value == null ? 'unknown' : check.value ? 'pass' : 'fail', weight: check.weight, evidence: check.value == null ? 'Não disponível nas páginas analisadas.' : String(check.value) })) }]));
  const gaps = [];
  const addGap = (id, category, title, description, severity, evidence, recommendation) => gaps.push({ id, category, title, description, severity, evidence, recommendation });
  if (seo.metaDescriptionPresent === false) addGap('seo-meta-description', 'seo', 'Meta description não identificada', 'Não foi encontrada uma meta description nas páginas analisadas.', 'medium', 'metaDescriptionPresent=false', 'Avaliar uma descrição específica para as principais páginas.');
  if (seo.imagesWithoutAlt > 0) addGap('seo-image-alt', 'seo', 'Imagens sem texto alternativo', `${seo.imagesWithoutAlt} imagens sem atributo alt foram identificadas.`, 'low', `imagesWithoutAlt=${seo.imagesWithoutAlt}`, 'Revisar os textos alternativos das imagens relevantes.');
  if (marketing.metaPixel === false) addGap('tracking-meta-pixel', 'tracking', 'Meta Pixel não identificado', 'O Meta Pixel não foi identificado nas páginas analisadas.', 'medium', 'metaPixel=false', 'Avaliar a configuração de mensuração caso ela faça parte da estratégia.');
  if (marketing.googleAnalytics === false && marketing.googleTagManager === false) addGap('tracking-analytics', 'tracking', 'Analytics não identificado', 'Google Analytics ou Google Tag Manager não foram identificados nas páginas analisadas.', 'info', 'googleAnalytics=false;googleTagManager=false', 'Avaliar a configuração de mensuração caso faça parte da estratégia.');
  if (security.https === false) addGap('security-https', 'security', 'HTTPS não identificado', 'As páginas analisadas não foram acessadas por HTTPS.', 'high', 'https=false', 'Avaliar a configuração de HTTPS do domínio.');
  const summary = { pagesAnalyzed: Number(d.pagesAnalyzed || merged.pagesAnalyzed || 0), businessName: merged.fields?.businessName || null, domain: null };
  const weights = { seo: 0.35, security: 0.35, mobile: 0.15, html: 0.15 };
  const validScores = Object.entries(scores).filter(([, value]) => value != null);
  const overallScore = validScores.length ? clamp(validScores.reduce((sum, [key, value]) => sum + value * weights[key], 0) / validScores.reduce((sum, [key]) => sum + weights[key], 0)) : null;
  const commercialOpportunities = gaps.filter((gap) => gap.category === 'tracking').map((gap) => ({ ...gap, severity: 'info' }));
  return { technicalScore: overallScore, overallScore, scoreBreakdown, weights, summary: { ...summary, domain: context.domain || null }, gaps, technicalGaps: gaps.filter((gap) => gap.category !== 'tracking'), commercialOpportunities, recommendations: gaps.map(({ id, category, title, recommendation }) => ({ id, category, title, recommendation })), performance: { status: 'unavailable', score: null, message: 'Análise de performance ainda não disponível.' }, seo: { homepage: d.homepage?.seo || seo, aggregate: d.seoAggregate || {}, ...seo }, mobile, security: { ...security, headers: Object.fromEntries(Object.entries(securityHeaders).map(([key, value]) => [key, { present: Boolean(value), valuePreview: value ? String(value).slice(0, 120) : null }])) }, technology: { legacy: technology, evidence: d.homepage?.technologyEvidence || {} }, tracking: marketing, conversion: d.homepage?.conversion || { contactForm: marketing.contactForm, clickablePhone: marketing.clickablePhone, clickableEmail: marketing.clickableEmail, whatsapp: marketing.whatsapp }, social: d.homepage?.social || {}, infrastructure: d.infrastructure || { robots: { status: 'unavailable' }, sitemap: { status: 'unavailable' } }, limitations: d.limitations || {}, pagesAnalyzed: Number(d.pagesAnalyzed || merged.pagesAnalyzed || 0) };
}

module.exports = { buildDiagnosticResult, scoreSignals };
