import { CalendarDays, ChartNoAxesCombined, MessagesSquare, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { conversationsAPI, type CommunicationMessage, type Conversation } from "@/api/conversations";
import { AppBreadcrumbs } from "@/components/layout/AppBreadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ModulePlaceholderPage } from "@/components/layout/ModulePlaceholderPage";

export function ChatsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [text, setText] = useState("");
  useEffect(() => { void conversationsAPI.list().then((result) => { setConversations(result.conversations); setSelected(result.conversations[0] || null); }); }, []);
  useEffect(() => { if (selected) void conversationsAPI.messages(selected.id).then((result) => setMessages(result.messages)); }, [selected]);
  const send = async () => { if (!selected || !text.trim()) return; await conversationsAPI.send(selected.id, text.trim()); setText(""); const result = await conversationsAPI.messages(selected.id); setMessages(result.messages); };
  return <div className="space-y-6 p-4 md:p-6"><AppBreadcrumbs /><div><h1 className="text-3xl font-bold">Chats</h1><p className="text-muted-foreground">Conversas WhatsApp recebidas e enviadas pelo CRM.</p></div><div className="grid min-h-[560px] gap-4 lg:grid-cols-[320px_1fr]"><Card className="rounded-lg border shadow-none"><CardHeader><CardTitle className="text-base">Conversas</CardTitle></CardHeader><CardContent className="space-y-2">{conversations.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma conversa encontrada.</p> : conversations.map((item) => <button className={`w-full rounded-md border p-3 text-left ${selected?.id === item.id ? "border-primary bg-muted" : ""}`} key={item.id} onClick={() => setSelected(item)}><p className="font-medium">{item.lead_name || item.lead_phone || "Contato sem nome"}</p><p className="text-xs text-muted-foreground">{item.account_name || "WhatsApp"}</p></button>)}</CardContent></Card><Card className="flex min-h-[560px] flex-col rounded-lg border shadow-none"><CardHeader><CardTitle className="text-base">{selected?.lead_name || selected?.lead_phone || "Selecione uma conversa"}</CardTitle></CardHeader><CardContent className="flex flex-1 flex-col gap-3"><div className="flex-1 space-y-2 overflow-auto">{messages.map((message) => <div className={`max-w-[80%] rounded-md px-3 py-2 text-sm ${message.direction === "outbound" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`} key={message.id}>{message.body_text || "Mensagem não textual"}</div>)}</div>{selected ? <div className="flex gap-2"><Input value={text} onChange={(event) => setText(event.target.value)} placeholder="Escreva uma mensagem" onKeyDown={(event) => { if (event.key === "Enter") void send(); }} /><Button onClick={() => void send()} disabled={!text.trim()}>Enviar</Button></div> : null}</CardContent></Card></div></div>;
}

export function LegacyChatsPage() {
  return <ModulePlaceholderPage title="Chats" area="Comercial" icon={MessagesSquare} description="Centralize conversas comerciais." moduleSummary="A área Chats será utilizada para acompanhar conversas com Leads e clientes." />;
}

export function MetricsPage() {
  return <ModulePlaceholderPage title="Métricas" area="Comercial" icon={ChartNoAxesCombined} description="Monitore indicadores da máquina comercial." moduleSummary="Acompanhe volume de Leads, conversões e produtividade." />;
}

export function BroadcastPage() {
  return <ModulePlaceholderPage title="Disparar" area="Comercial" icon={Send} description="Prepare disparos comerciais segmentados." moduleSummary="Organize campanhas de contato comercial." />;
}

export function AgendaPage() {
  return <ModulePlaceholderPage title="Agenda" area="Comercial" icon={CalendarDays} description="Organize compromissos e próximas atividades." moduleSummary="Registre reuniões, retornos e follow-ups." />;
}
