const ALLOWED_TAGS = new Set([
  "P", "BR", "STRONG", "B", "EM", "I", "U", "S", "DEL", "SPAN", "FONT",
  "H1", "H2", "H3", "UL", "OL", "LI", "A", "DIV", "HR", "IMG",
  "TABLE", "TBODY", "TR", "TD",
]);

const ALLOWED_STYLES = new Set([
  "color", "background-color", "font-family", "font-size", "font-weight",
  "font-style", "text-decoration", "text-align", "line-height", "width",
  "max-width", "height", "padding", "padding-top", "padding-right",
  "padding-bottom", "padding-left", "margin", "border", "border-radius",
  "display", "mso-padding-alt",
]);

function safeStyle(value: string) {
  return value
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const separator = declaration.indexOf(":");
      if (separator < 1) return "";
      const property = declaration.slice(0, separator).trim().toLowerCase();
      const styleValue = declaration.slice(separator + 1).trim();
      if (!ALLOWED_STYLES.has(property) || !styleValue || styleValue.length > 160)
        return "";
      if (/url\s*\(|expression\s*\(|javascript:|@import|behavior\s*:|[<>]/i.test(styleValue))
        return "";
      return `${property}:${styleValue}`;
    })
    .filter(Boolean)
    .join(";");
}

export function sanitizeEmailHtml(value: string) {
  const documentNode = new DOMParser().parseFromString(String(value || ""), "text/html");
  [...documentNode.body.querySelectorAll("*")].forEach((element) => {
    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    const tag = element.tagName;
    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      const keep =
        (name === "style" && Boolean(safeStyle(value))) ||
        (tag === "A" && name === "href" && /^(https?:\/\/|mailto:)/i.test(value)) ||
        (tag === "IMG" && name === "src" && /^https:\/\//i.test(value)) ||
        (tag === "IMG" && name === "alt") ||
        (["IMG", "TABLE", "TD"].includes(tag) && name === "width" && /^\d{1,4}$/.test(value)) ||
        (tag === "IMG" && name === "height" && /^\d{1,4}$/.test(value)) ||
        (["IMG", "TABLE", "TD"].includes(tag) && name === "align" && /^(left|center|right)$/i.test(value)) ||
        (["TABLE", "TD"].includes(tag) && name === "bgcolor" && /^(#[0-9a-f]{3,8}|[a-z]{3,20})$/i.test(value)) ||
        (tag === "TABLE" && ["cellpadding", "cellspacing", "border"].includes(name) && /^\d{1,3}$/.test(value)) ||
        (tag === "TABLE" && name === "role" && value === "presentation") ||
        (tag === "FONT" && name === "face" && /^[a-z0-9 ,\-]{1,80}$/i.test(value)) ||
        (tag === "FONT" && name === "size" && /^[1-7]$/.test(value)) ||
        (tag === "FONT" && name === "color" && /^(#[0-9a-f]{3,8}|[a-z]{3,20})$/i.test(value));
      if (!keep) element.removeAttribute(attribute.name);
    });

    if (element.hasAttribute("style")) {
      const style = safeStyle(element.getAttribute("style") || "");
      if (style) element.setAttribute("style", style);
      else element.removeAttribute("style");
    }
    if (tag === "A") {
      if (!element.hasAttribute("href")) {
        element.replaceWith(...Array.from(element.childNodes));
        return;
      }
      element.setAttribute("target", "_blank");
      element.setAttribute("rel", "noopener noreferrer");
    }
    if (tag === "IMG" && !element.hasAttribute("src")) element.remove();
  });
  return documentNode.body.innerHTML.trim();
}

export function emailHtmlToText(value: string) {
  const safeHtml = sanitizeEmailHtml(value)
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<hr\s*\/?\s*>/gi, "\n---\n")
    .replace(/<li(?:\s[^>]*)?>/gi, "- ")
    .replace(/<\/(?:p|div|h[1-3]|li|tr)>/gi, "\n");
  const documentNode = new DOMParser().parseFromString(safeHtml, "text/html");
  return String(documentNode.body.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function renderPreviewVariables(value: string) {
  const variables: Record<string, string> = {
    nome: "Ana Martins",
    primeiro_nome: "Ana",
    empresa: "Empresa Exemplo",
    email: "ana@exemplo.com",
  };
  return String(value || "").replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key) => variables[key] ?? "");
}
