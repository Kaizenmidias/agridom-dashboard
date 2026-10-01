const decode = (value) => String(value || '').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const attr = (tag, name) => { const match = String(tag).match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i')); return match ? match[1].trim() : null; };
const first = (html, expression) => { const match = String(html).match(expression); return match ? decode(match[1]) : null; };
const ASSET_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'ico', 'css', 'js', 'json', 'xml', 'woff', 'woff2', 'ttf', 'eot', 'map', 'pdf', 'zip', 'doc', 'docx', 'xls', 'xlsx']);
const validEmail = (value) => {
  const email = String(value || '').toLowerCase().trim();
  const match = email.match(/^[^\s@]+@([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)$/i);
  if (!match || /example|placeholder|test@|w3\.org|schema\.org/.test(email)) return null;
  return ASSET_EXTENSIONS.has(match[1].split('.').pop()) ? null : email;
};
const cleanInstagram = (value) => { try { const url = new URL(value, 'https://example.invalid'); return /(^|\.)instagram\.com$/i.test(url.hostname) && !/\/(share|intent|p|reel|stories)(\/|$)/i.test(url.pathname) ? `https://www.instagram.com/${url.pathname.split('/').filter(Boolean)[0]}/` : null; } catch { return null; } };
const cleanLinkedin = (value) => { try { const url = new URL(value, 'https://example.invalid'); return /(^|\.)linkedin\.com$/i.test(url.hostname) && /^\/company\/[^/]+/i.test(url.pathname) ? `https://www.linkedin.com${url.pathname.replace(/\/$/, '')}/` : null; } catch { return null; } };
const phone = (value) => { const raw = String(value || '').replace(/\D/g, ''); return raw.length >= 10 && raw.length <= 15 ? String(value).trim() : null; };

function parseJsonLd(html) { return [...String(html).matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].flatMap((match) => { try { const value = JSON.parse(match[1]); return Array.isArray(value) ? value : [value]; } catch { return []; } }); }
function links(html) { return [...String(html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]).filter(Boolean); }

function parsePage(html, pageUrl, options = {}) {
  const source = String(html || '');
  const jsonLd = parseJsonLd(source);
  const organization = jsonLd.find((item) => item && typeof item === 'object' && ['Organization', 'LocalBusiness', 'Corporation'].some((type) => String(item['@type'] || '').includes(type))) || {};
  const text = decode(source.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' '));
  const hrefs = links(source).map((href) => { try { return new URL(href, pageUrl).toString(); } catch { return null; } }).filter(Boolean);
  const mailtoEmails = [...source.matchAll(/mailto:([^"'?#\s]+)/gi)].map((match) => validEmail(decode(match[1]))).filter(Boolean);
  const structuredEmails = jsonLd.flatMap((item) => item && typeof item === 'object' ? [validEmail(item.email)] : []).filter(Boolean);
  const textEmails = [...source.matchAll(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi)].map((match) => validEmail(match[1])).filter(Boolean);
  const emails = [...new Set([...mailtoEmails, ...structuredEmails, ...textEmails])];
  const instagram = hrefs.map(cleanInstagram).find(Boolean) || null;
  const linkedin = hrefs.map(cleanLinkedin).find(Boolean) || null;
  const address = organization.address && typeof organization.address === 'object' ? [organization.address.streetAddress, organization.address.addressLocality, organization.address.addressRegion, organization.address.postalCode].filter(Boolean).join(', ') : null;
  const images = [...source.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
  const scripts = [...source.matchAll(/<script\b/gi)].length;
  const stylesheets = [...source.matchAll(/<link\b[^>]*rel=["'][^"']*stylesheet[^"']*["']/gi)].length;
  const h1Count = [...source.matchAll(/<h1\b/gi)].length;
  const title = first(source, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = first(source, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || first(source, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  const canonical = first(source, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  const viewport = /<meta[^>]+name=["']viewport["']/i.test(source);
  const mixedContent = pageUrl.startsWith('https:') && /(?:src|href)=["']http:/i.test(source);
  const has = (pattern) => pattern.test(source) || pattern.test(text);
  const header = (name) => options.headers?.get ? options.headers.get(name) : options.headers?.[name] || options.headers?.[name.toLowerCase()] || null;
  const technology = { wordpress: /wp-content|wp-includes/i.test(source), elementor: /elementor/i.test(source), woocommerce: /woocommerce/i.test(source), shopify: /cdn\.shopify\.com|shopify/i.test(source), wix: /wixstatic\.com|wix\.com/i.test(source), webflow: /webflow\.com|class=["'][^"']*w-nav/i.test(source), react: /__next|data-reactroot|react(?:\.production)?\.min/i.test(source), nextjs: /__next|_next\//i.test(source) };
  const whatsappLink = hrefs.find((href) => /wa\.me|api\.whatsapp\.com/i.test(href)) || null;
  const marketing = { googleAnalytics: has(/googletagmanager\.com\/gtag|google-analytics\.com|gtag\(/i), googleTagManager: has(/googletagmanager\.com\/gtm|GTM-[A-Z0-9]+/i), metaPixel: has(/connect\.facebook\.net|fbq\(/i), whatsapp: Boolean(whatsappLink), contactForm: /<form\b/i.test(source), clickablePhone: /href=["']tel:/i.test(source), clickableEmail: /href=["']mailto:/i.test(source), instagram: Boolean(instagram), linkedin: Boolean(linkedin) };
  const seo = { titlePresent: Boolean(title), metaDescriptionPresent: Boolean(description), canonical: Boolean(canonical), h1Count, robotsMeta: /<meta[^>]+name=["']robots["']/i.test(source), structuredData: jsonLd.length > 0, openGraph: /property=["']og:/i.test(source), imageCount: images.length, imagesWithoutAlt: images.filter((tag) => !attr(tag, 'alt')).length };
  const opportunities = []; if (!seo.metaDescriptionPresent) opportunities.push('Meta description nao detectada'); if (!seo.structuredData) opportunities.push('Dados estruturados nao detectados'); if (!marketing.metaPixel) opportunities.push('Meta Pixel nao detectado'); if (!viewport) opportunities.push('Meta viewport nao detectada'); if (!marketing.whatsapp) opportunities.push('Link de WhatsApp nao detectado'); if (seo.imagesWithoutAlt) opportunities.push(`${seo.imagesWithoutAlt} imagens sem atributo alt`);
  const telValue = first(source, /href=["']tel:([^"']+)["']/i);
  const whatsappPhone = whatsappLink ? (() => { try { return new URL(whatsappLink).pathname.replace(/\D/g, ''); } catch { return null; } })() : null;
  return { fields: { email: emails[0] || null, instagram, linkedin, address: address || null, phone: phone(telValue) || phone(organization.telephone) || phone(whatsappPhone), businessName: organization.name || first(source, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) }, links: hrefs, diagnostic: { technology, seo, marketing, mobile: { viewport }, security: { https: pageUrl.startsWith('https:'), mixedContent, headers: { contentSecurityPolicy: header('content-security-policy'), xContentTypeOptions: header('x-content-type-options'), referrerPolicy: header('referrer-policy'), strictTransportSecurity: header('strict-transport-security') } }, performance: { responseTimeMs: options.responseTimeMs ?? null, htmlSizeBytes: Buffer.byteLength(source), scriptCount: scripts, stylesheetCount: stylesheets, imageCount: images.length }, opportunities } };
}

module.exports = { cleanInstagram, cleanLinkedin, parsePage, validEmail };
