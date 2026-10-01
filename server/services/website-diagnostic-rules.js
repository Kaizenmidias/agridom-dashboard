const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));

function scoreSignals(signals) {
  const valid = signals.filter((item) => typeof item.value === 'boolean');
  return valid.length ? clamp(valid.reduce((sum, item) => sum + (item.value ? item.weight : 0), 0) / valid.reduce((sum, item) => sum + item.weight, 0) * 100) : null;
}

function buildDiagnosticResult(merged) {
  const d = merged.diagnostic || {};
  const seo = d.seo || {};
  const marketing = d.marketing || {};
  const security = d.security || {};
  const mobile = d.mobile || {};
  const technology = d.technology || {};
  const securityHeaders = security.headers || {};
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
    digitalPresence: scoreSignals([{ value: marketing.googleAnalytics || marketing.googleTagManager, weight: 2 }, { value: marketing.metaPixel, weight: 1 }, { value: marketing.whatsapp, weight: 2 }, { value: marketing.instagram || marketing.linkedin, weight: 1 }, { value: marketing.contactForm, weight: 1 }]),
  };
  const gaps = [];
  const addGap = (id, category, title, description, severity, evidence, recommendation) => gaps.push({ id, category, title, description, severity, evidence, recommendation });
  if (seo.metaDescriptionPresent === false) addGap('seo-meta-description', 'seo', 'Meta description não identificada', 'Não foi encontrada uma meta description nas páginas analisadas.', 'medium', 'metaDescriptionPresent=false', 'Avaliar uma descrição específica para as principais páginas.');
  if (seo.imagesWithoutAlt > 0) addGap('seo-image-alt', 'seo', 'Imagens sem texto alternativo', `${seo.imagesWithoutAlt} imagens sem atributo alt foram identificadas.`, 'low', `imagesWithoutAlt=${seo.imagesWithoutAlt}`, 'Revisar os textos alternativos das imagens relevantes.');
  if (marketing.metaPixel === false) addGap('tracking-meta-pixel', 'tracking', 'Meta Pixel não identificado', 'O Meta Pixel não foi identificado nas páginas analisadas.', 'medium', 'metaPixel=false', 'Avaliar a configuração de mensuração caso ela faça parte da estratégia.');
  if (security.https === false) addGap('security-https', 'security', 'HTTPS não identificado', 'As páginas analisadas não foram acessadas por HTTPS.', 'high', 'https=false', 'Avaliar a configuração de HTTPS do domínio.');
  const summary = { pagesAnalyzed: Number(d.pagesAnalyzed || merged.pagesAnalyzed || 0), businessName: merged.fields?.businessName || null, domain: null };
  const weights = { seo: 0.35, mobile: 0.2, security: 0.25, digitalPresence: 0.2 };
  const validScores = Object.entries(scores).filter(([, value]) => value != null);
  const overallScore = validScores.length ? clamp(validScores.reduce((sum, [key, value]) => sum + value * weights[key], 0) / validScores.reduce((sum, [key]) => sum + weights[key], 0)) : null;
  return { scores, overallScore, weights, summary, gaps, recommendations: gaps.map(({ id, category, title, recommendation }) => ({ id, category, title, recommendation })), performance: { status: 'unavailable', score: null, message: 'Análise de performance ainda não disponível.' }, seo, mobile, security, technology, tracking: marketing, conversion: { contactForm: marketing.contactForm, clickablePhone: marketing.clickablePhone, clickableEmail: marketing.clickableEmail, whatsapp: marketing.whatsapp }, social: { instagram: marketing.instagram, linkedin: marketing.linkedin }, pagesAnalyzed: Number(d.pagesAnalyzed || merged.pagesAnalyzed || 0) };
}

module.exports = { buildDiagnosticResult, scoreSignals };
