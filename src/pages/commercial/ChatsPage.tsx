import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, CircleUserRound, Clock3, Copy, Inbox, Instagram, Linkedin, MessageCircle, MoreHorizontal, Pause, RefreshCw, Search, UserRound, UserRoundCheck, X } from "lucide-react";
import { conversationsAPI, type CommunicationMessage, type Conversation, type ConversationActivity, type ConversationDetail } from "@/api/conversations";
import { commercialEntitiesAPI, type UserOption } from "@/services/commercial-entities";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ChatMessage } from "@/components/commercial/ChatMessage";
import { MessageComposer } from "@/components/commercial/MessageComposer";

type Channel = "whatsapp" | "instagram" | "linkedin";
type Filter = "all" | "unread" | "mine" | "ai" | "human";

const channels: Record<Channel, { label: string; icon: typeof MessageCircle; className: string; connected: boolean }> = {
  whatsapp: { label: "WhatsApp", icon: MessageCircle, className: "text-emerald-500", connected: true },
  instagram: { label: "Instagram", icon: Instagram, className: "text-pink-500", connected: false },
  linkedin: { label: "LinkedIn", icon: Linkedin, className: "text-sky-500", connected: false },
};

function ChannelBadge({ channel = "whatsapp" as Channel }: { channel?: string }) {
  const config = channels[channel as Channel] || channels.whatsapp;
  const Icon = config.icon;
  return <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", config.className)}><Icon className="h-3.5 w-3.5" />{config.label}</span>;
}

function initials(name?: string | null) {
  return (name || "Contato").split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "C";
}

function formatTime(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return `Hoje, ${formatTime(value)}`;
  if (date.toDateString() === yesterday.toDateString()) return `Ontem, ${formatTime(value)}`;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function modeLabel(mode?: string) {
  if (mode === "ai") return "IA atendendo";
  if (mode === "paused") return "Atendimento pausado";
  return "Atendimento humano";
}

function statusLabel(status?: string) {
  return ({ open: "Aberta", waiting: "Aguardando", resolved: "Encerrada", closed: "Encerrada" } as Record<string, string>)[status || ""] || "Aberta";
}

export function ChatsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [activities, setActivities] = useState<ConversationActivity[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "activities">("profile");
  const [reply, setReply] = useState<CommunicationMessage | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const searchTimer = useRef<number | undefined>(undefined);

  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await conversationsAPI.list({ search: search.trim() || undefined, filter, assignedUserId: filter === "mine" ? Number(user?.id) : undefined });
      setConversations(result.conversations);
      setSelectedId((current) => current && result.conversations.some((item) => item.id === current) ? current : result.conversations[0]?.id || null);
      setError(null);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar as conversas."); }
    finally { if (!silent) setLoading(false); }
  }, [filter, search, user?.id]);

  const loadSelected = useCallback(async (id: number, silent = false) => {
    if (!silent) setLoadingMessages(true);
    try {
      const [nextDetail, nextMessages, nextActivities] = await Promise.all([conversationsAPI.detail(id), conversationsAPI.messages(id), conversationsAPI.activities(id)]);
      setDetail(nextDetail); setMessages(nextMessages.messages); setHasMoreMessages(Boolean(nextMessages.hasMore)); setActivities(nextActivities.activities);
      if (nextDetail.unread_count > 0) { await conversationsAPI.markRead(id); setConversations((current) => current.map((item) => item.id === id ? { ...item, unread_count: 0 } : item)); }
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar a conversa."); }
    finally { if (!silent) setLoadingMessages(false); }
  }, []);

  useEffect(() => { void loadConversations(); }, [loadConversations]);
  useEffect(() => { void commercialEntitiesAPI.getUsers().then((result) => setUsers(result.users)).catch(() => setUsers([])); }, []);
  useEffect(() => { if (selectedId) void loadSelected(selectedId); else { setDetail(null); setMessages([]); setActivities([]); } }, [loadSelected, selectedId]);
  useEffect(() => {
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => void loadConversations(), 250);
    return () => window.clearTimeout(searchTimer.current);
  }, [loadConversations]);
  useEffect(() => { const timer = window.setInterval(() => { void loadConversations(true); if (selectedId) void loadSelected(selectedId, true); }, 12000); return () => window.clearInterval(timer); }, [loadConversations, loadSelected, selectedId]);

  const selected = useMemo(() => conversations.find((item) => item.id === selectedId) || null, [conversations, selectedId]);
  const changeHandling = async () => {
    if (!detail) return;
    const next = detail.handling_mode === "ai" ? "human" : detail.handling_mode === "human" ? (detail.ai_agent_id ? "ai" : "paused") : "human";
    try { await conversationsAPI.setHandling(detail.id, next); await loadSelected(detail.id, true); await loadConversations(true); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Não foi possível alterar o atendimento."); }
  };
  const assign = async (value: string) => { if (!detail) return; try { await conversationsAPI.assign(detail.id, value === "unassigned" ? null : Number(value)); await loadSelected(detail.id, true); await loadConversations(true); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Não foi possível atribuir a conversa."); } };
  const send = async (message: string, quotedMessageId?: number | null) => { if (!detail) return; setSending(true); try { await conversationsAPI.send(detail.id, message, quotedMessageId); await loadSelected(detail.id, true); await loadConversations(true); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Não foi possível enviar a mensagem."); } finally { setSending(false); } };
  const sendMedia = async (file: File | Blob, type: "image" | "audio" | "video" | "document", caption?: string, filename?: string, quotedMessageId?: number | null) => { if (!detail) return; setSending(true); try { await conversationsAPI.sendMedia(detail.id, file, type, caption, filename, quotedMessageId); await loadSelected(detail.id, true); await loadConversations(true); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Não foi possível enviar a mídia."); } finally { setSending(false); } };
  const copyMessage = async (message: CommunicationMessage) => { if (message.body_text) await navigator.clipboard?.writeText(message.body_text); };
  const loadOlderMessages = async () => { if (!detail || loadingOlder || !hasMoreMessages || !messages.length || !messagesRef.current) return; const container = messagesRef.current; const previousHeight = container.scrollHeight; setLoadingOlder(true); try { const result = await conversationsAPI.messages(detail.id, messages[0].id); setMessages((current) => [...result.messages, ...current]); setHasMoreMessages(Boolean(result.hasMore)); requestAnimationFrame(() => { if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight - previousHeight; }); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar o histórico."); } finally { setLoadingOlder(false); } };
  const copyPhone = async () => { if (detail?.lead_phone) await navigator.clipboard?.writeText(detail.lead_phone); };

  return <TooltipProvider>
    <main className="flex h-[calc(100vh-5.5rem)] min-h-[620px] flex-col overflow-hidden p-3 md:p-5">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Comercial</p><h1 className="text-2xl font-semibold tracking-tight">Chats</h1></div><div className="flex items-center gap-2"><Badge variant="outline" className="hidden gap-1.5 sm:inline-flex"><MessageCircle className="h-3.5 w-3.5 text-emerald-500" />WhatsApp conectado</Badge><Button variant="outline" size="icon" onClick={() => void loadConversations()} aria-label="Atualizar conversas" title="Atualizar conversas"><RefreshCw className="h-4 w-4" /></Button></div></div>
      {error ? <div className="mb-3 flex items-center justify-between rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"><span>{error}</span><Button variant="ghost" size="sm" onClick={() => { setError(null); void loadConversations(); }}>Tentar novamente</Button></div> : null}
      <div className="grid min-h-0 flex-1 overflow-hidden rounded-lg border bg-card shadow-sm lg:grid-cols-[300px_minmax(0,1fr)_320px]">
        <aside className="flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r"><div className="border-b p-3"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="h-9 pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar conversa, lead ou telefone..." /></div><div className="mt-3 flex flex-wrap gap-1"><FilterButton active={filter === "all"} onClick={() => setFilter("all")}>Todos</FilterButton><FilterButton active={filter === "unread"} onClick={() => setFilter("unread")}>Não lidos</FilterButton><FilterButton active={filter === "mine"} onClick={() => setFilter("mine")}>Minhas</FilterButton><FilterButton active={filter === "ai"} onClick={() => setFilter("ai")}>IA</FilterButton><FilterButton active={filter === "human"} onClick={() => setFilter("human")}>Humano</FilterButton></div></div><div className="min-h-0 flex-1 overflow-y-auto">{loading ? <div className="space-y-2 p-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div> : conversations.length === 0 ? <EmptyState icon={Inbox} title={search ? "Nenhuma conversa encontrada" : "Suas conversas aparecerão aqui"} /> : conversations.map((conversation) => <ConversationItem key={conversation.id} conversation={conversation} selected={conversation.id === selectedId} onClick={() => setSelectedId(conversation.id)} />)}</div></aside>
        <section className="flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r">{detail ? <><header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3"><div className="flex min-w-0 items-center gap-3"><Avatar className="h-10 w-10"><AvatarFallback>{initials(detail.lead_name || detail.lead_phone)}</AvatarFallback></Avatar><div className="min-w-0"><h2 className="truncate font-semibold">{detail.lead_name || detail.lead_phone || "Contato sem nome"}</h2><div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><ChannelBadge /><span>•</span><span>{detail.lead_phone || "Sem telefone"}</span></div></div></div><div className="flex items-center gap-1"><Badge variant="outline" className={cn(detail.handling_mode === "ai" ? "border-sky-500/40 text-sky-600" : detail.handling_mode === "paused" ? "border-amber-500/40 text-amber-600" : "border-primary/40 text-primary")}><span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />{modeLabel(detail.handling_mode)}</Badge><Button variant="ghost" size="icon" onClick={changeHandling} title={detail.handling_mode === "ai" ? "Assumir atendimento" : detail.handling_mode === "human" ? "Pausar atendimento" : "Assumir atendimento"} aria-label="Alterar modo de atendimento">{detail.handling_mode === "ai" ? <UserRoundCheck className="h-4 w-4" /> : detail.handling_mode === "paused" ? <UserRound className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</Button><Button variant="ghost" size="icon" title="Mais ações" aria-label="Mais ações"><MoreHorizontal className="h-4 w-4" /></Button></div></header><div ref={messagesRef} onScroll={(event) => { if (event.currentTarget.scrollTop < 80) void loadOlderMessages(); }} className="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-4 py-5">{loadingOlder ? <div className="pb-3 text-center text-xs text-muted-foreground">Carregando histórico...</div> : null}{loadingMessages ? <div className="space-y-3"><Skeleton className="h-12 w-2/3" /><Skeleton className="ml-auto h-16 w-1/2" /><Skeleton className="h-10 w-1/3" /></div> : messages.length === 0 ? <EmptyState icon={MessageCircle} title="Nenhuma mensagem nesta conversa" /> : <div className="mx-auto flex max-w-3xl flex-col gap-2">{messages.map((message) => <ChatMessage key={message.id} message={message} conversationId={detail.id} quoted={message.quoted_message_id ? messages.find((item) => item.id === message.quoted_message_id) : null} onReply={setReply} onCopy={copyMessage} onOpenMedia={setLightbox} />)}</div>}</div><MessageComposer onSendText={send} onSendMedia={sendMedia} sending={sending} reply={reply} onClearReply={() => setReply(null)} onError={setError} /></> : <EmptyState icon={MessageCircle} title="Selecione uma conversa para começar" />}</section>
        <aside className="flex min-h-0 flex-col overflow-y-auto bg-background"><div className="flex shrink-0 border-b">{(["profile", "activities"] as const).map((tab) => <button key={tab} className={cn("flex-1 border-b-2 px-3 py-3 text-sm font-medium", activeTab === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground")} onClick={() => setActiveTab(tab)}>{tab === "profile" ? "Perfil" : "Atividades"}</button>)}</div>{detail ? activeTab === "profile" ? <ProfilePanel detail={detail} users={users} onAssign={assign} onCopyPhone={copyPhone} onOpenLead={() => navigate(`/comercial/leads/${(detail.lead_name || "lead").toLowerCase().replace(/\s+/g, "-")}-${detail.lead_id || ""}`)} /> : <ActivityPanel activities={activities} /> : <EmptyState icon={CircleUserRound} title="O contexto do lead aparecerá aqui" />}</aside>
      </div>
      {lightbox ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" onClick={() => setLightbox(null)} onKeyDown={(event) => { if (event.key === "Escape") setLightbox(null); }} tabIndex={-1}><Button variant="ghost" size="icon" className="absolute right-4 top-4 text-white" onClick={() => setLightbox(null)} aria-label="Fechar imagem"><X className="h-5 w-5" /></Button><img src={lightbox} alt="Visualização ampliada" className="max-h-[90vh] max-w-[95vw] object-contain" onClick={(event) => event.stopPropagation()} /></div> : null}
    </main>
  </TooltipProvider>;
}

function FilterButton({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) { return <button className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors", active ? "border-primary bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground")} onClick={onClick}>{children}</button>; }
function EmptyState({ icon: Icon, title }: { icon: typeof Inbox; title: string }) { return <div className="flex h-full min-h-32 flex-col items-center justify-center gap-2 px-6 py-10 text-center text-muted-foreground"><Icon className="h-7 w-7 opacity-50" /><p className="text-sm">{title}</p></div>; }
function ConversationItem({ conversation, selected, onClick }: { conversation: Conversation; selected: boolean; onClick: () => void }) { const mediaPreview: Record<string, string> = { image: "Foto", audio: "Áudio", video: "Vídeo", document: "Documento", sticker: "Sticker" }; const preview = conversation.last_message_text || mediaPreview[conversation.last_message_type || ""] || "Mensagem não textual"; return <button className={cn("w-full border-b px-3 py-3 text-left transition-colors hover:bg-muted/60", selected && "bg-primary/5 shadow-[inset_3px_0_0_hsl(var(--primary))]")} onClick={onClick}><div className="flex items-start gap-3"><Avatar className="h-10 w-10 shrink-0"><AvatarFallback>{initials(conversation.lead_name || conversation.lead_phone)}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-medium">{conversation.lead_name || conversation.lead_phone || "Contato sem nome"}</p><span className="shrink-0 text-[11px] text-muted-foreground">{formatTime(conversation.last_message_at)}</span></div><div className="mt-1 flex items-center gap-2"><ChannelBadge /><span className="truncate text-xs text-muted-foreground">{preview}</span></div><div className="mt-2 flex items-center justify-between gap-2"><span className="truncate text-[11px] text-muted-foreground">{conversation.assigned_user_name || "Sem responsável"} · {conversation.handling_mode === "ai" ? "IA" : "Humano"}</span>{conversation.unread_count > 0 ? <Badge className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px]">{conversation.unread_count}</Badge> : null}</div></div></div></button>; }
function MessageBubble({ message, previous }: { message: CommunicationMessage; previous?: CommunicationMessage }) { const outbound = message.direction === "outbound"; const statusIcon = message.delivery_status === "failed" ? <span className="text-destructive">!</span> : message.delivery_status === "read" ? <CheckCheck className="h-3 w-3 text-sky-500" /> : outbound ? <Check className="h-3 w-3" /> : null; return <div className={cn("flex", outbound ? "justify-end" : "justify-start")}><div className={cn("max-w-[78%] rounded-lg px-3 py-2 text-sm shadow-sm", outbound ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border bg-card")}><p className="whitespace-pre-wrap break-words">{message.body_text || "Mensagem não textual"}</p><div className={cn("mt-1 flex items-center justify-end gap-1 text-[10px]", outbound ? "text-primary-foreground/70" : "text-muted-foreground")}><span>{formatTime(message.created_at)}</span>{statusIcon}</div></div></div>; }
function ProfilePanel({ detail, users, onAssign, onCopyPhone, onOpenLead }: { detail: ConversationDetail; users: UserOption[]; onAssign: (value: string) => void; onCopyPhone: () => void; onOpenLead: () => void }) { const fields = [["Empresa", detail.lead_name], ["E-mail", detail.lead_email], ["Origem", detail.lead_origin], ["Status", detail.lead_status], ["Cidade", [detail.lead_city, detail.lead_state].filter(Boolean).join(" / ")], ["Último contato", formatDate(detail.last_message_at)]]; return <div className="space-y-5 p-4"><div className="flex flex-col items-center text-center"><Avatar className="mb-3 h-16 w-16"><AvatarFallback className="text-lg">{initials(detail.lead_name || detail.lead_phone)}</AvatarFallback></Avatar><h3 className="font-semibold">{detail.lead_name || detail.lead_phone || "Contato sem nome"}</h3><div className="mt-1"><ChannelBadge /></div><div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">{detail.lead_phone || "Sem telefone"}{detail.lead_phone ? <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCopyPhone} title="Copiar telefone" aria-label="Copiar telefone"><Copy className="h-3.5 w-3.5" /></Button> : null}</div><Button className="mt-3 w-full" variant="outline" onClick={onOpenLead}>Ver lead completo</Button></div><div className="space-y-3 border-t pt-4"><div className="flex items-center justify-between"><p className="text-sm font-semibold">Atendimento</p><Badge variant="outline">{statusLabel(detail.status)}</Badge></div><div className="rounded-md border bg-muted/20 p-3 text-sm"><div className="mb-2 flex items-center gap-2">{detail.handling_mode === "ai" ? <Bot className="h-4 w-4 text-sky-500" /> : detail.handling_mode === "paused" ? <Pause className="h-4 w-4 text-amber-500" /> : <UserRound className="h-4 w-4 text-primary" />}<span>{modeLabel(detail.handling_mode)}</span></div><p className="text-xs text-muted-foreground">O modo de atendimento está visível no cabeçalho da conversa.</p></div><div><p className="mb-1.5 text-xs font-medium text-muted-foreground">Responsável</p><Select value={detail.assigned_user_id ? String(detail.assigned_user_id) : "unassigned"} onValueChange={onAssign}><SelectTrigger><SelectValue placeholder="Sem responsável" /></SelectTrigger><SelectContent><SelectItem value="unassigned">Sem responsável</SelectItem>{users.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></div></div><div className="space-y-2 border-t pt-4"><p className="text-sm font-semibold">Dados do lead</p>{fields.filter(([, value]) => value).map(([label, value]) => <div key={label} className="flex items-start justify-between gap-3 text-sm"><span className="text-muted-foreground">{label}</span><span className="max-w-[170px] text-right font-medium">{value}</span></div>)}</div></div>; }
function ActivityPanel({ activities }: { activities: ConversationActivity[] }) { return <div className="space-y-4 p-4">{activities.length === 0 ? <EmptyState icon={Clock3} title="Nenhuma atividade registrada" /> : activities.map((activity) => <div key={activity.id} className="relative border-l-2 border-primary/20 pl-4"><span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-primary" /><p className="text-sm font-medium">{activity.title}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(activity.created_at)} · {activity.actor_name || "Sistema"}</p>{activity.description ? <p className="mt-1 text-xs text-muted-foreground">{activity.description}</p> : null}</div>)}</div>; }
