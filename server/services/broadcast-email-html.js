const ALLOWED_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s", "del", "span", "font",
  "h1", "h2", "h3", "ul", "ol", "li", "a", "div", "hr", "img",
  "table", "tbody", "tr", "td",
]);

const ALLOWED_STYLE_PROPERTIES = new Set([
  "color", "background-color", "font-family", "font-size", "font-weight",
  "font-style", "text-decoration", "text-align", "line-height", "width",
  "max-width", "height", "padding", "padding-top", "padding-right",
  "padding-bottom", "padding-left", "margin", "border", "border-radius",
  "display", "mso-padding-alt",
]);

function escapeAttribute(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sanitizeInlineStyle(value) {
  return String(value || "")
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const separator = declaration.indexOf(":");
      if (separator < 1) return "";
      const property = declaration.slice(0, separator).trim().toLowerCase();
      const styleValue = declaration.slice(separator + 1).trim();
      if (!ALLOWED_STYLE_PROPERTIES.has(property) || !styleValue || styleValue.length > 160)
        return "";
      if (/url\s*\(|expression\s*\(|javascript:|@import|behavior\s*:|[<>]/i.test(styleValue))
        return "";
      return `${property}:${styleValue}`;
    })
    .filter(Boolean)
    .join(";");
}

function parseAttributes(rawAttrs) {
  const attributes = new Map();
  String(rawAttrs || "").replace(
    /([a-zA-Z][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g,
    (_, name, doubleQuoted, singleQuoted, bare) => {
      attributes.set(String(name).toLowerCase(), doubleQuoted ?? singleQuoted ?? bare ?? "");
      return "";
    },
  );
  return attributes;
}

function positiveInteger(value, maximum = 1200) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= maximum ? String(parsed) : null;
}

function safeColor(value) {
  const color = String(value || "").trim();
  return /^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|[a-z]{3,20})$/i.test(color)
    ? color
    : null;
}

function sanitizeAttributes(tag, rawAttrs) {
  const source = parseAttributes(rawAttrs);
  const output = [];
  const style = sanitizeInlineStyle(source.get("style"));
  if (style) output.push(`style="${escapeAttribute(style)}"`);

  if (tag === "a") {
    const href = String(source.get("href") || "").trim();
    if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href))
      output.push(`href="${escapeAttribute(href)}"`, 'rel="noopener noreferrer"');
  }

  if (tag === "img") {
    const src = String(source.get("src") || "").trim();
    if (!/^https:\/\//i.test(src)) return null;
    output.push(`src="${escapeAttribute(src)}"`);
    const alt = String(source.get("alt") || "").slice(0, 300);
    output.push(`alt="${escapeAttribute(alt)}"`);
    const width = positiveInteger(source.get("width"));
    const height = positiveInteger(source.get("height"));
    if (width) output.push(`width="${width}"`);
    if (height) output.push(`height="${height}"`);
    const align = String(source.get("align") || "").toLowerCase();
    if (["left", "center", "right"].includes(align)) output.push(`align="${align}"`);
  }

  if (tag === "font") {
    const face = String(source.get("face") || "").replace(/[^a-z0-9 ,\-]/gi, "").slice(0, 80);
    const size = positiveInteger(source.get("size"), 7);
    const color = safeColor(source.get("color"));
    if (face) output.push(`face="${escapeAttribute(face)}"`);
    if (size) output.push(`size="${size}"`);
    if (color) output.push(`color="${escapeAttribute(color)}"`);
  }

  if (["table", "td"].includes(tag)) {
    for (const attribute of ["width", "cellpadding", "cellspacing", "border"]) {
      const parsed = positiveInteger(source.get(attribute), attribute === "width" ? 1200 : 100);
      if (parsed) output.push(`${attribute}="${parsed}"`);
      else if (attribute === "border" && source.get(attribute) === "0") output.push('border="0"');
    }
    const align = String(source.get("align") || "").toLowerCase();
    if (["left", "center", "right"].includes(align)) output.push(`align="${align}"`);
    const bgcolor = safeColor(source.get("bgcolor"));
    if (bgcolor) output.push(`bgcolor="${escapeAttribute(bgcolor)}"`);
    if (tag === "table" && source.get("role") === "presentation") output.push('role="presentation"');
  }

  return output.length ? ` ${output.join(" ")}` : "";
}

function sanitizeEmailHtml(value) {
  let html = String(value || "");
  html = html.replace(/<\s*(script|style|iframe|object|embed|svg|math|form|input|button)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  html = html.replace(/<\s*(script|style|iframe|object|embed|svg|math|form|input|button)[^>]*\/?>/gi, "");
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  html = html.replace(/<\/?([a-z0-9-]+)([^>]*)>/gi, (full, rawTag, rawAttrs) => {
    const tag = String(rawTag).toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (full.startsWith("</")) return ["br", "hr", "img"].includes(tag) ? "" : `</${tag}>`;
    if (tag === "br" || tag === "hr") return `<${tag}>`;
    const attributes = sanitizeAttributes(tag, rawAttrs);
    if (attributes === null) return "";
    return `<${tag}${attributes}>`;
  });
  return html.replace(/[\t\r\n]+/g, " ").replace(/ {2,}/g, " ").trim();
}

function htmlToText(value) {
  return sanitizeEmailHtml(value)
    .replace(/<br\s*\/?>(?=.)/gi, "\n")
    .replace(/<hr\s*\/?>/gi, "\n---\n")
    .replace(/<\/p>|<\/h[1-3]>|<\/li>|<\/tr>/gi, "\n")
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

module.exports = {
  ALLOWED_TAGS,
  ALLOWED_STYLE_PROPERTIES,
  sanitizeInlineStyle,
  sanitizeEmailHtml,
  htmlToText,
};
