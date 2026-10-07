const ALLOWED_TAGS = new Set(["p", "br", "strong", "b", "em", "i", "u", "h1", "h2", "h3", "ul", "ol", "li", "a", "div"]);

function sanitizeEmailHtml(value) {
  let html = String(value || "");
  html = html.replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  html = html.replace(/<\/?([a-z0-9-]+)([^>]*)>/gi, (full, rawTag, rawAttrs) => {
    const tag = String(rawTag).toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (full.startsWith("</")) return `</${tag}>`;
    if (tag === "br") return "<br>";
    const attrs = tag === "a" ? String(rawAttrs || "").match(/\s(?:href)\s*=\s*["']([^"']+)["']/i) : null;
    if (!attrs || tag !== "a") return `<${tag}>`;
    const href = attrs[1].trim();
    if (!/^https?:\/\//i.test(href)) return `<${tag}>`;
    return `<a href="${href.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" rel="noopener noreferrer">`;
  });
  return html.replace(/\s+/g, " ").trim();
}

function htmlToText(value) {
  return sanitizeEmailHtml(value)
    .replace(/<br\s*\/?>(?=.)/gi, "\n")
    .replace(/<\/p>|<\/h[1-3]>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

module.exports = { ALLOWED_TAGS, sanitizeEmailHtml, htmlToText };
