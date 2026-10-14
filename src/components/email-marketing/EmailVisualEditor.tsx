import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Highlighter,
  Image,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Monitor,
  MousePointerClick,
  Palette,
  Redo2,
  Smartphone,
  Strikethrough,
  Underline,
  Undo2,
  Variable,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  emailHtmlToText,
  renderPreviewVariables,
  sanitizeEmailHtml,
} from "@/lib/email-html";

type EditorState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeThrough: boolean;
  insertUnorderedList: boolean;
  insertOrderedList: boolean;
  fontName: string;
  fontSize: string;
  formatBlock: string;
  foreColor: string;
  backColor: string;
};

type ImageDraft = {
  src: string;
  alt: string;
  width: string;
  align: "left" | "center" | "right";
};

type ButtonDraft = {
  text: string;
  url: string;
  background: string;
  color: string;
  align: "left" | "center" | "right";
  padding: string;
};

const DEFAULT_STATE: EditorState = {
  bold: false,
  italic: false,
  underline: false,
  strikeThrough: false,
  insertUnorderedList: false,
  insertOrderedList: false,
  fontName: "Arial",
  fontSize: "3",
  formatBlock: "p",
  foreColor: "#ffffff",
  backColor: "#1b1d1e",
};

const SAFE_FONTS = ["Arial", "Verdana", "Tahoma", "Georgia", "Times New Roman", "Trebuchet MS"];
const VARIABLES = [
  ["Nome", "{{nome}}"],
  ["Primeiro nome", "{{primeiro_nome}}"],
  ["Empresa", "{{empresa}}"],
  ["E-mail", "{{email}}"],
] as const;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function ToolButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={`h-8 w-8 shrink-0 ${active ? "bg-[#BEFA33]/15 text-[#BEFA33]" : ""}`}
      aria-label={label}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function EmailVisualEditor({
  html,
  subject,
  from,
  onChange,
}: {
  html: string;
  subject: string;
  from: string;
  onChange: (html: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const selectedImageRef = useRef<HTMLImageElement | null>(null);
  const [state, setState] = useState(DEFAULT_STATE);
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const [preview, setPreview] = useState<"desktop" | "mobile" | null>(null);
  const [imageDraft, setImageDraft] = useState<ImageDraft | null>(null);
  const [buttonDraft, setButtonDraft] = useState<ButtonDraft | null>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== html)
      editorRef.current.innerHTML = html;
  }, [html]);

  const updateToolbarState = useCallback(() => {
    if (!editorRef.current || !document.activeElement) return;
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editorRef.current.contains(selection.anchorNode)) return;
    const query = (command: string) => {
      try {
        return document.queryCommandState(command);
      } catch {
        return false;
      }
    };
    const value = (command: string, fallback: string) => {
      try {
        return String(document.queryCommandValue(command) || fallback)
          .replace(/["']/g, "")
          .toLowerCase();
      } catch {
        return fallback;
      }
    };
    setState((current) => ({
      ...current,
      bold: query("bold"),
      italic: query("italic"),
      underline: query("underline"),
      strikeThrough: query("strikeThrough"),
      insertUnorderedList: query("insertUnorderedList"),
      insertOrderedList: query("insertOrderedList"),
      fontName: value("fontName", current.fontName),
      fontSize: value("fontSize", current.fontSize),
      formatBlock: value("formatBlock", current.formatBlock).replace(/[<>]/g, ""),
      foreColor: value("foreColor", current.foreColor),
      backColor: value("backColor", current.backColor),
    }));
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", updateToolbarState);
    return () => document.removeEventListener("selectionchange", updateToolbarState);
  }, [updateToolbarState]);

  const sync = () => {
    if (!editorRef.current) return;
    onChange(sanitizeEmailHtml(editorRef.current.innerHTML));
    updateToolbarState();
  };

  const focusEditor = () => {
    editorRef.current?.focus();
    if (savedRangeRef.current) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(savedRangeRef.current);
    }
  };

  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode))
      savedRangeRef.current = selection.getRangeAt(0).cloneRange();
  };

  const command = (name: string, value?: string) => {
    focusEditor();
    document.execCommand(name, false, value);
    sync();
  };

  const insertHtml = (value: string) => {
    focusEditor();
    document.execCommand("insertHTML", false, sanitizeEmailHtml(value));
    sync();
  };

  const insertLink = () => {
    saveSelection();
    const url = window.prompt("Informe uma URL HTTPS:", "https://");
    if (!url || !/^https:\/\//i.test(url)) return;
    command("createLink", url);
  };

  const openImageDialog = () => {
    saveSelection();
    selectedImageRef.current = null;
    setImageDraft({ src: "https://", alt: "", width: "600", align: "center" });
  };

  const saveImage = () => {
    if (!imageDraft || !/^https:\/\//i.test(imageDraft.src)) return;
    const width = Math.min(1200, Math.max(40, Number(imageDraft.width) || 600));
    const selected = selectedImageRef.current;
    if (selected) {
      selected.src = imageDraft.src;
      selected.alt = imageDraft.alt;
      selected.width = width;
      selected.setAttribute("align", imageDraft.align);
      selected.style.display = "block";
      selected.style.maxWidth = "100%";
      selected.style.height = "auto";
      selected.style.margin =
        imageDraft.align === "center"
          ? "12px auto"
          : imageDraft.align === "right"
            ? "12px 0 12px auto"
            : "12px auto 12px 0";
      sync();
    } else {
      const margin =
        imageDraft.align === "center"
          ? "12px auto"
          : imageDraft.align === "right"
            ? "12px 0 12px auto"
            : "12px auto 12px 0";
      insertHtml(
        `<img src="${escapeHtml(imageDraft.src)}" alt="${escapeHtml(imageDraft.alt)}" width="${width}" align="${imageDraft.align}" style="display:block;max-width:100%;height:auto;margin:${margin}">`,
      );
    }
    selectedImageRef.current = null;
    setImageDraft(null);
  };

  const removeSelectedImage = () => {
    selectedImageRef.current?.remove();
    selectedImageRef.current = null;
    setImageDraft(null);
    sync();
  };

  const openButtonDialog = () => {
    saveSelection();
    setButtonDraft({
      text: "Saiba mais",
      url: "https://",
      background: "#BEFA33",
      color: "#111111",
      align: "center",
      padding: "14",
    });
  };

  const saveButton = () => {
    if (!buttonDraft || !buttonDraft.text.trim() || !/^https:\/\//i.test(buttonDraft.url)) return;
    const padding = Math.min(28, Math.max(8, Number(buttonDraft.padding) || 14));
    insertHtml(
      `<table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" style="width:100%;margin:16px 0"><tbody><tr><td align="${buttonDraft.align}" style="text-align:${buttonDraft.align}"><a href="${escapeHtml(buttonDraft.url)}" style="display:inline-block;background-color:${buttonDraft.background};color:${buttonDraft.color};padding:${padding}px ${padding * 2}px;border-radius:4px;text-decoration:none;font-family:Arial;font-size:16px;font-weight:bold;mso-padding-alt:${padding}px ${padding * 2}px">${escapeHtml(buttonDraft.text.trim())}</a></td></tr></tbody></table>`,
    );
    setButtonDraft(null);
  };

  const onPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const source = event.clipboardData.getData("text/html") || escapeHtml(event.clipboardData.getData("text/plain"));
    document.execCommand("insertHTML", false, sanitizeEmailHtml(source));
    sync();
  };

  const previewHtml = sanitizeEmailHtml(renderPreviewVariables(html));
  const previewDocument = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:24px;background:#fff;color:#202124;font-family:Arial,sans-serif;line-height:1.5}img{max-width:100%;height:auto}table{max-width:100%}</style></head><body>${previewHtml || "<p>Seu conteúdo aparecerá aqui.</p>"}</body></html>`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-white/10 px-2 py-1.5">
        <ToolButton label="Desfazer" onClick={() => command("undo")}><Undo2 className="h-4 w-4" /></ToolButton>
        <ToolButton label="Refazer" onClick={() => command("redo")}><Redo2 className="h-4 w-4" /></ToolButton>
        <span className="mx-1 h-5 w-px shrink-0 bg-white/10" />
        <select
          aria-label="Família da fonte"
          className="h-8 w-28 shrink-0 bg-transparent px-1 text-xs outline-none"
          value={SAFE_FONTS.find((font) => state.fontName.includes(font.toLowerCase())) || "Arial"}
          onChange={(event) => command("fontName", event.target.value)}
        >
          {SAFE_FONTS.map((font) => <option key={font} value={font} className="bg-zinc-900">{font}</option>)}
        </select>
        <select
          aria-label="Tamanho da fonte"
          className="h-8 w-16 shrink-0 bg-transparent px-1 text-xs outline-none"
          value={state.fontSize || "3"}
          onChange={(event) => command("fontSize", event.target.value)}
        >
          {[1, 2, 3, 4, 5, 6, 7].map((size) => <option key={size} value={size} className="bg-zinc-900">{size}</option>)}
        </select>
        <select
          aria-label="Estilo do parágrafo"
          className="h-8 w-24 shrink-0 bg-transparent px-1 text-xs outline-none"
          value={["p", "h1", "h2", "h3"].includes(state.formatBlock) ? state.formatBlock : "p"}
          onChange={(event) => command("formatBlock", event.target.value)}
        >
          <option value="p" className="bg-zinc-900">Parágrafo</option>
          <option value="h1" className="bg-zinc-900">Título 1</option>
          <option value="h2" className="bg-zinc-900">Título 2</option>
          <option value="h3" className="bg-zinc-900">Título 3</option>
        </select>
        <ToolButton label="Negrito" active={state.bold} onClick={() => command("bold")}><Bold className="h-4 w-4" /></ToolButton>
        <ToolButton label="Itálico" active={state.italic} onClick={() => command("italic")}><Italic className="h-4 w-4" /></ToolButton>
        <ToolButton label="Sublinhado" active={state.underline} onClick={() => command("underline")}><Underline className="h-4 w-4" /></ToolButton>
        <ToolButton label="Tachado" active={state.strikeThrough} onClick={() => command("strikeThrough")}><Strikethrough className="h-4 w-4" /></ToolButton>
        <label className="relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-white/5" title="Cor do texto">
          <Palette className="h-4 w-4" />
          <input className="absolute inset-0 cursor-pointer opacity-0" type="color" value={/^#[0-9a-f]{6}$/i.test(state.foreColor) ? state.foreColor : "#ffffff"} onChange={(event) => command("foreColor", event.target.value)} />
        </label>
        <label className="relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-white/5" title="Cor de destaque">
          <Highlighter className="h-4 w-4" />
          <input className="absolute inset-0 cursor-pointer opacity-0" type="color" value={/^#[0-9a-f]{6}$/i.test(state.backColor) ? state.backColor : "#1b1d1e"} onChange={(event) => command("hiliteColor", event.target.value)} />
        </label>
        <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 px-2 text-xs" onClick={() => setSecondaryOpen((value) => !value)}>
          Mais
        </Button>
      </div>

      {secondaryOpen ? (
        <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-white/10 px-2 py-1.5">
          <ToolButton label="Alinhar à esquerda" onClick={() => command("justifyLeft")}><AlignLeft className="h-4 w-4" /></ToolButton>
          <ToolButton label="Centralizar" onClick={() => command("justifyCenter")}><AlignCenter className="h-4 w-4" /></ToolButton>
          <ToolButton label="Alinhar à direita" onClick={() => command("justifyRight")}><AlignRight className="h-4 w-4" /></ToolButton>
          <ToolButton label="Lista com marcadores" active={state.insertUnorderedList} onClick={() => command("insertUnorderedList")}><List className="h-4 w-4" /></ToolButton>
          <ToolButton label="Lista numerada" active={state.insertOrderedList} onClick={() => command("insertOrderedList")}><ListOrdered className="h-4 w-4" /></ToolButton>
          <ToolButton label="Inserir link" onClick={insertLink}><Link2 className="h-4 w-4" /></ToolButton>
          <ToolButton label="Inserir divisor" onClick={() => command("insertHorizontalRule")}><Minus className="h-4 w-4" /></ToolButton>
          <ToolButton label="Limpar formatação" onClick={() => { command("removeFormat"); command("unlink"); }}><Eraser className="h-4 w-4" /></ToolButton>
          <ToolButton label="Inserir imagem por URL" onClick={openImageDialog}><Image className="h-4 w-4" /></ToolButton>
          <ToolButton label="Inserir botão" onClick={openButtonDialog}><MousePointerClick className="h-4 w-4" /></ToolButton>
          <div className="relative group">
            <ToolButton label="Inserir variável" onClick={() => undefined}><Variable className="h-4 w-4" /></ToolButton>
            <div className="invisible absolute left-0 top-8 z-30 w-44 rounded-md border border-white/10 bg-[#252829] py-1 opacity-0 shadow-xl transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              {VARIABLES.map(([label, variable]) => (
                <button key={variable} className="block w-full px-3 py-2 text-left text-xs hover:bg-white/5" onMouseDown={(event) => event.preventDefault()} onClick={() => insertHtml(variable)}>{label}</button>
              ))}
            </div>
          </div>
          <span className="ml-auto text-[10px] text-zinc-600">Imagens: somente URL HTTPS pública</span>
        </div>
      ) : null}

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="min-h-52 flex-1 overflow-y-auto px-5 py-4 text-sm leading-6 outline-none empty:before:text-zinc-600 empty:before:content-[attr(data-placeholder)]"
        data-placeholder="Escreva o conteúdo da campanha..."
        onInput={sync}
        onKeyUp={updateToolbarState}
        onMouseUp={updateToolbarState}
        onPaste={onPaste}
        onClick={(event) => {
          const target = event.target;
          if (!(target instanceof HTMLImageElement)) return;
          selectedImageRef.current = target;
          saveSelection();
          setImageDraft({
            src: target.src,
            alt: target.alt,
            width: String(target.width || 600),
            align: (["left", "center", "right"].includes(target.getAttribute("align") || "")
              ? target.getAttribute("align")
              : "center") as ImageDraft["align"],
          });
        }}
      />

      <div className="flex shrink-0 items-center gap-2 border-t border-white/10 px-3 py-2">
        <span className="text-[10px] text-zinc-600">{emailHtmlToText(html).length} caracteres</span>
        <div className="ml-auto flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setPreview("desktop")}><Monitor className="mr-2 h-4 w-4" /> Desktop</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setPreview("mobile")}><Smartphone className="mr-2 h-4 w-4" /> Mobile</Button>
        </div>
      </div>

      {preview ? (
        <div className="absolute inset-0 z-40 flex flex-col bg-[#101212]">
          <div className="flex h-12 items-center border-b border-white/10 px-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{renderPreviewVariables(subject) || "Sem assunto"}</p>
              <p className="truncate text-[11px] text-zinc-500">De: {from || "Remetente não definido"} · dados fictícios de prévia</p>
            </div>
            <Button className="ml-auto" variant="ghost" size="icon" aria-label="Fechar pré-visualização" onClick={() => setPreview(null)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-zinc-800 p-4">
            <iframe title={`Pré-visualização ${preview}`} sandbox="" className={`mx-auto h-full bg-white shadow-xl ${preview === "mobile" ? "w-[375px] max-w-full" : "w-full max-w-4xl"}`} srcDoc={previewDocument} />
          </div>
        </div>
      ) : null}

      {imageDraft ? (
        <EditorDialog title={selectedImageRef.current ? "Editar imagem" : "Inserir imagem"} onClose={() => { selectedImageRef.current = null; setImageDraft(null); }}>
          <Label>URL HTTPS pública</Label><Input value={imageDraft.src} onChange={(event) => setImageDraft({ ...imageDraft, src: event.target.value })} />
          <Label>Texto alternativo</Label><Input value={imageDraft.alt} onChange={(event) => setImageDraft({ ...imageDraft, alt: event.target.value })} />
          <div className="grid grid-cols-2 gap-3"><div><Label>Largura em pixels</Label><Input type="number" min="40" max="1200" value={imageDraft.width} onChange={(event) => setImageDraft({ ...imageDraft, width: event.target.value })} /></div><div><Label>Alinhamento</Label><select className="mt-2 h-10 w-full rounded-md border bg-background px-3" value={imageDraft.align} onChange={(event) => setImageDraft({ ...imageDraft, align: event.target.value as ImageDraft["align"] })}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></div></div>
          <div className="flex justify-end gap-2">{selectedImageRef.current ? <Button variant="destructive" onClick={removeSelectedImage}>Remover</Button> : null}<Button disabled={!/^https:\/\//i.test(imageDraft.src)} onClick={saveImage}>Aplicar</Button></div>
        </EditorDialog>
      ) : null}

      {buttonDraft ? (
        <EditorDialog title="Inserir botão" onClose={() => setButtonDraft(null)}>
          <Label>Texto</Label><Input value={buttonDraft.text} onChange={(event) => setButtonDraft({ ...buttonDraft, text: event.target.value })} />
          <Label>URL HTTPS</Label><Input value={buttonDraft.url} onChange={(event) => setButtonDraft({ ...buttonDraft, url: event.target.value })} />
          <div className="grid grid-cols-2 gap-3"><div><Label>Fundo</Label><Input type="color" value={buttonDraft.background} onChange={(event) => setButtonDraft({ ...buttonDraft, background: event.target.value })} /></div><div><Label>Texto</Label><Input type="color" value={buttonDraft.color} onChange={(event) => setButtonDraft({ ...buttonDraft, color: event.target.value })} /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><Label>Alinhamento</Label><select className="mt-2 h-10 w-full rounded-md border bg-background px-3" value={buttonDraft.align} onChange={(event) => setButtonDraft({ ...buttonDraft, align: event.target.value as ButtonDraft["align"] })}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></div><div><Label>Espaçamento</Label><Input type="number" min="8" max="28" value={buttonDraft.padding} onChange={(event) => setButtonDraft({ ...buttonDraft, padding: event.target.value })} /></div></div>
          <div className="flex justify-end"><Button disabled={!buttonDraft.text.trim() || !/^https:\/\//i.test(buttonDraft.url)} onClick={saveButton}>Inserir botão</Button></div>
        </EditorDialog>
      ) : null}
    </div>
  );
}

function EditorDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md space-y-3 rounded-md border border-white/10 bg-[#252829] p-4 shadow-2xl">
        <div className="flex items-center"><h3 className="font-medium">{title}</h3><Button className="ml-auto" variant="ghost" size="icon" aria-label="Fechar" onClick={onClose}><X className="h-4 w-4" /></Button></div>
        {children}
      </div>
    </div>
  );
}
