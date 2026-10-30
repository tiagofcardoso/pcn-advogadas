"use client";

function formatBirthdayDisplay(bday?: string): string {
  if (!bday) return "—";
  const clean = bday.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [, m, d] = clean.split("-");
    return `${d}/${m}`;
  }
  if (/^\d{2}-\d{2}$/.test(clean)) {
    const [m, d] = clean.split("-");
    return `${d}/${m}`;
  }
  return clean;
}
import React, { useState, useEffect } from "react";
import { CalendarEvent, Client, UserProfile } from "@/lib/types";
import {
  formatIsoDatePt,
  DEFAULT_GCAL_ID,
  buildGoogleCalendarEmbedUrl,
  normalizeEventType,
} from "@/lib/v6Helpers";
import {
  ExternalLink,
  Plus,
  Settings,
  Trash2,
  X,
} from "lucide-react";

interface CalendarV6TabProps {
  events: CalendarEvent[];
  clients: Client[];
  usersList: UserProfile[];
  globalQuery: string;
  onSaveEvent: (evt: CalendarEvent, isEdit: boolean) => void;
  onDeleteEvent: (id: string) => void;
  onEditClientBirthday: (client: Client) => void;
  onOpenNewEventModal?: (defaultType?: CalendarEvent["type"]) => void;
  onEditEvent?: (evt: CalendarEvent) => void;
}

export default function CalendarV6Tab({
  events,
  clients,
  usersList,
  globalQuery,
  onSaveEvent,
  onDeleteEvent,
  onEditClientBirthday,
  onOpenNewEventModal,
  onEditEvent,
}: CalendarV6TabProps) {
  const [gcalId, setGcalId] = useState<string>(DEFAULT_GCAL_ID);
  const [gcalMode, setGcalMode] = useState<"MONTH" | "WEEK" | "AGENDA">("MONTH");
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [configInput, setConfigInput] = useState<string>("");

  const [eventFilter, setEventFilter] = useState<string>("Todos");
  const [isBirthdayModalOpen, setIsBirthdayModalOpen] = useState<boolean>(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [eventForm, setEventForm] = useState<{
    title: string;
    subtitle: string;
    date: string;
    time: string;
    type: CalendarEvent["type"];
    owner: string;
  }>({
    title: "",
    subtitle: "",
    date: new Date().toISOString().slice(0, 10),
    time: "09:00",
    type: "Compromisso",
    owner: usersList[0]?.id || "usr_luana",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("pcn_google_calendar_id");
      if (
        saved &&
        saved.trim() &&
        saved.trim() !== "pt.portuguese#holiday@group.v.calendar.google.com"
      ) {
        setGcalId(saved.trim());
        setConfigInput(saved.trim());
      } else {
        setGcalId(DEFAULT_GCAL_ID);
        setConfigInput(DEFAULT_GCAL_ID);
      }
    } catch {}
  }, []);

  const handleSaveGcalConfig = (e: React.FormEvent) => {
    e.preventDefault();
    let cleaned = configInput.trim();
    // If user pasted a full iframe or URL, extract src or calendar id
    const srcMatch = cleaned.match(/src=["']([^"']+)["']/i);
    if (srcMatch) {
      cleaned = srcMatch[1];
    }
    if (!cleaned) {
      cleaned = DEFAULT_GCAL_ID;
    }
    setGcalId(cleaned);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("pcn_google_calendar_id", cleaned);
        window.dispatchEvent(
          new CustomEvent("pcn-gcal-updated", { detail: cleaned })
        );
      } catch {}
    }
    setIsConfigOpen(false);
  };

  // Build Google Calendar Embed URL (supports https://calendar.google.com/calendar/u/0/r)
  const embedSrc = React.useMemo(
    () => buildGoogleCalendarEmbedUrl(gcalId, gcalMode),
    [gcalId, gcalMode]
  );

  // Birthdays check (moved from Minha Área de Trabalho to Agendas e Prazos)
  const todayMmDd = new Date().toISOString().slice(5, 10);
  const matchesTodayMmDd = (bday?: string) => {
    if (!bday) return false;
    const clean = bday.trim();
    if (clean.length >= 10 && clean.includes("-")) {
      return clean.slice(5, 10) === todayMmDd;
    }
    return clean === todayMmDd;
  };
  const birthdayClientsToday = clients.filter((c) => matchesTodayMmDd(c.birthday));
  const clientsWithBirthday = clients.filter(
    (c) => c.birthday && c.birthday.trim() !== ""
  );

  const openNewEventModal = (defaultType?: CalendarEvent["type"]) => {
    if (onOpenNewEventModal) {
      onOpenNewEventModal(defaultType || "Compromisso");
      return;
    }
    setEditingEvent(null);
    setEventForm({
      title: "",
      subtitle: "",
      date: new Date().toISOString().slice(0, 10),
      time: "10:00",
      type: defaultType || "Compromisso",
      owner: usersList[0]?.id || "usr_luana",
    });
    setIsEventModalOpen(true);
  };

  const openEditEventModal = (evt: CalendarEvent) => {
    if (onEditEvent) {
      onEditEvent(evt);
      return;
    }
    setEditingEvent(evt);
    setEventForm({
      title: evt.title,
      subtitle: evt.subtitle || "",
      date: evt.date,
      time: evt.time,
      type: evt.type,
      owner: evt.owner,
    });
    setIsEventModalOpen(true);
  };

  const handleEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm.title.trim()) return;
    const payload: CalendarEvent = {
      id: editingEvent ? editingEvent.id : `evt_${Date.now()}`,
      title: eventForm.title.trim(),
      subtitle: eventForm.subtitle.trim() || undefined,
      date: eventForm.date,
      time: eventForm.time,
      type: eventForm.type,
      owner: eventForm.owner,
    };
    onSaveEvent(payload, !!editingEvent);
    setIsEventModalOpen(false);
    setEditingEvent(null);
  };

  const resolveUserName = (uid: string) => {
    const found = usersList.find(
      (u) => u.id === uid || u.name.toLowerCase() === (uid || "").toLowerCase()
    );
    return found ? found.name : uid;
  };

  const filteredEvents = events
    .filter(
      (e) =>
        eventFilter === "Todos" || normalizeEventType(e.type) === eventFilter
    )
    .filter(
      (e) =>
        !globalQuery ||
        e.title.toLowerCase().includes(globalQuery.toLowerCase()) ||
        (e.subtitle || "").toLowerCase().includes(globalQuery.toLowerCase()) ||
        e.type.toLowerCase().includes(globalQuery.toLowerCase())
    )
    .sort((a, b) =>
      `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
    );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-serif-v6 text-[31px] text-[#28202a] leading-tight">
            Agendas e Prazos
          </h1>
          <p className="text-[#6e6569] text-sm mt-0.5">
            Calendário Google partilhado PCN · Compromissos · Prazos ·
            Aniversários PCN
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => openNewEventModal("Compromisso")}
            className="v6-btn primary"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Novo registo</span>
          </button>

          <button
            type="button"
            onClick={() => setIsBirthdayModalOpen(true)}
            className="v6-btn gold"
          >
            <span>🎂 Aniversários ({clientsWithBirthday.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            className="v6-btn"
            title="Configurar conta ou calendário Google partilhado"
          >
            <Settings className="w-3.5 h-3.5 text-[#59083e]" />
            <span>Configurar Google Calendar</span>
          </button>
        </div>
      </div>

      {/* Birthday Banner Alert (Moved from Minha Área de Trabalho to Calendar) */}
      {(birthdayClientsToday.length > 0 || clientsWithBirthday.length > 0) && (
        <div className="bg-gradient-to-r from-[#f8f0f5] via-[#faf4eb] to-[#f4ead9] border border-[#e5d2b8] rounded-[13px] px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#59083e] text-[#e9c885] flex items-center justify-center text-lg shrink-0">
              🎂
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#7b175f] block">
                ANIVERSÁRIO PCN · CALENDÁRIO DE CLIENTES
              </span>
              {birthdayClientsToday.length > 0 ? (
                <p className="text-sm font-bold text-[#28202a]">
                  Hoje é aniversário de:{" "}
                  {birthdayClientsToday
                    .map(
                      (c) => `${c.name}${c.number ? ` (PCN ${c.number})` : ""}`
                    )
                    .join(", ")}
                </p>
              ) : (
                <p className="text-xs text-[#50454b]">
                  Próximos aniversários registados:{" "}
                  {clientsWithBirthday
                    .map(
                      (c) =>
                        `${c.name} (${formatBirthdayDisplay(c.birthday)}${
                          c.number ? ` · PCN ${c.number}` : ""
                        })`
                    )
                    .join(" · ")}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsBirthdayModalOpen(true)}
            className="v6-btn bg-white/90 text-xs shrink-0"
          >
            Ver todos os aniversários
          </button>
        </div>
      )}

      {/* Optional Google Calendar ID Configuration Panel */}
      {isConfigOpen && (
        <form
          onSubmit={handleSaveGcalConfig}
          className="v6-card bg-[#faf7f4] border-[#decba9] space-y-3 text-xs"
        >
          <div className="flex items-center justify-between">
            <strong className="text-[#59083e] text-sm font-serif-v6">
              Configuração do Google Calendar Incorporado (Opção 1 — Iframe)
            </strong>
            <button
              type="button"
              onClick={() => setIsConfigOpen(false)}
              className="text-[#776f73] hover:text-[#28202a]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[#6e6569]">
            Introduza o <strong>ID do Calendário Google</strong> partilhado do
            escritório (ex.: <code>agenda@pcnadvogadas.pt</code> ou{" "}
            <code>...group.calendar.google.com</code>) ou cole diretamente o URL
            de incorporação do Google Calendar.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={configInput}
              onChange={(e) => setConfigInput(e.target.value)}
              placeholder="Ex.: agenda@pcnadvogadas.pt ou URL https://calendar.google.com/calendar/embed?src=..."
              className="flex-1 border border-[#dfd6d6] rounded-[7px] px-3 py-2 bg-white text-[#28202a]"
            />
            <button type="submit" className="v6-btn primary">
              Guardar Calendário
            </button>
          </div>
        </form>
      )}

      {/* Embedded Google Calendar Card (Option 1) */}
      <div className="v6-card space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-serif-v6 text-xl text-[#28202a] m-0">
              Calendário Geral PCN (Google Calendar)
            </h2>
            <p className="text-xs text-[#776f73] mt-0.5">
              Sincronizado com{" "}
              <a
                href="https://calendar.google.com/calendar/u/0/r"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#92006f] font-semibold hover:underline"
              >
                https://calendar.google.com/calendar/u/0/r
              </a>{" "}
              (fuso horário Europe/Lisbon)
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex rounded-lg border border-[#dfd6d6] overflow-hidden text-xs">
              {(
                [
                  { id: "MONTH", label: "Mês" },
                  { id: "WEEK", label: "Semana" },
                  { id: "AGENDA", label: "Agenda" },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setGcalMode(m.id)}
                  className={`px-3 py-1.5 font-medium cursor-pointer transition-colors ${
                    gcalMode === m.id
                      ? "bg-[#59083e] text-white"
                      : "bg-white text-[#50454b] hover:bg-[#faf5f1]"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <a
              href="https://calendar.google.com/calendar/u/0/r"
              target="_blank"
              rel="noopener noreferrer"
              className="v6-btn text-xs"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#92006f]" />
              <span>Abrir Google Calendar (u/0/r)</span>
            </a>
          </div>
        </div>

        <div className="w-full rounded-xl overflow-hidden border border-[#e9e0dd] bg-[#faf8f6]">
          <iframe
            src={embedSrc}
            title="Calendário Google PCN Advogadas"
            style={{ border: 0 }}
            width="100%"
            height="560"
            frameBorder="0"
            scrolling="no"
          />
        </div>
      </div>

      {/* V6 Registos da Agenda Table */}
      <div className="v6-card space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-serif-v6 text-xl text-[#28202a] m-0">
            Registos da Agenda Interna PCN
          </h2>

          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              "Todos",
              "Compromisso",
              "Diligência",
              "Prazo",
              "Prazo de tarefa",
              "Férias / Ausência",
            ].map((pill) => (
              <button
                key={pill}
                type="button"
                onClick={() => setEventFilter(pill)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                  eventFilter === pill
                    ? "bg-[#59083e] text-white"
                    : "bg-white text-[#50454b] border border-[#e1d5d9] hover:border-[#c5a467]"
                }`}
              >
                {pill}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f7f3ef] text-[#50454b] border-b border-[#f0eae6]">
                <th className="py-3 px-3">Data</th>
                <th className="py-3 px-3">Hora</th>
                <th className="py-3 px-3">Tipo</th>
                <th className="py-3 px-3">Descrição</th>
                <th className="py-3 px-3">Responsável</th>
                <th className="py-3 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0eae6]">
              {filteredEvents.map((evt) => (
                <tr key={evt.id} className="hover:bg-[#fdfbf9]">
                  <td className="py-3 px-3 whitespace-nowrap">
                    {formatIsoDatePt(evt.date)}
                  </td>
                  <td className="py-3 px-3 font-semibold text-[#59083e]">
                    {evt.time}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`v6-badge ${
                        evt.type.includes("Prazo")
                          ? "wait"
                          : evt.type.includes("Férias")
                          ? "start"
                          : ""
                      }`}
                    >
                      {evt.type}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-medium text-[#28202a]">{evt.title}</div>
                    {evt.subtitle && (
                      <div className="text-xs text-[#776f73]">{evt.subtitle}</div>
                    )}
                  </td>
                  <td className="py-3 px-3">{resolveUserName(evt.owner)}</td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditEventModal(evt)}
                        className="v6-btn py-1 px-2.5 text-xs"
                      >
                        Editar
                      </button>
                      {!evt.id.startsWith("task_deadline_") && (
                        <button
                          type="button"
                          onClick={() => onDeleteEvent(evt.id)}
                          className="v6-btn danger py-1 px-2 text-xs"
                          title="Eliminar registo da agenda"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const iso = evt.date.replace(/-/g, "");
                          const gUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
                            evt.title
                          )}&dates=${iso}/${iso}&details=${encodeURIComponent(
                            evt.subtitle || evt.type
                          )}`;
                          window.open(gUrl, "_blank");
                        }}
                        className="v6-btn gold py-1 px-2.5 text-xs"
                        title="Enviar para o Google Calendar"
                      >
                        + Google
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredEvents.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-xs text-[#776f73] italic"
                  >
                    Sem registos para o filtro selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Aniversários PCN (Exact V6 dialog) */}
      {isBirthdayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#160617]/55 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#e5d7d9] rounded-[14px] shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#f0eae6] pb-3">
              <h2 className="font-serif-v6 text-xl text-[#28202a] m-0">
                🎂 Aniversários PCN
              </h2>
              <button
                type="button"
                onClick={() => setIsBirthdayModalOpen(false)}
                className="text-[#776f73] hover:text-[#28202a]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#776f73]">
              Apenas registo de data (MM-DD) e alerta no dia do aniversário no
              calendário. Sem envio de mensagens automáticas.
            </p>

            <div className="divide-y divide-[#f0eae6] max-h-80 overflow-y-auto text-xs">
              {clients.map((c) => (
                <div
                  key={c.id}
                  className="py-2.5 flex items-center justify-between gap-2"
                >
                  <div>
                    <strong className="text-[#28202a]">{c.name}</strong>
                    {c.number && (
                      <span className="text-[#776f73] ml-1.5">
                        · PCN {c.number}
                      </span>
                    )}
                    <span className="ml-2 v6-badge">
                      {c.birthday ? `🎂 ${formatBirthdayDisplay(c.birthday)}` : "Não registado"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsBirthdayModalOpen(false);
                      onEditClientBirthday(c);
                    }}
                    className="v6-btn py-1 px-2.5 text-xs"
                  >
                    Editar
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#f0eae6]">
              <button
                type="button"
                onClick={() => setIsBirthdayModalOpen(false)}
                className="v6-btn"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create/Edit Agenda Event */}
      {isEventModalOpen && (
        <div
          className="v6-modal-backdrop"
          onClick={() => setIsEventModalOpen(false)}
        >
          <div className="v6-modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 pb-3.5 mb-4 border-b border-[#efe6e0]">
              <h3 className="m-0! p-0! border-0! text-[20px]">
                {editingEvent
                  ? `Editar Registo na Agenda (${eventForm.type})`
                  : `Novo Registo na Agenda (${eventForm.type})`}
              </h3>
              <button
                type="button"
                onClick={() => setIsEventModalOpen(false)}
                className="p-1.5 rounded-lg border border-[#e5d8d0] text-[#59083e] hover:bg-[#faf5f1] cursor-pointer transition-colors shrink-0"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEventSubmit}>
              <div className="v6-form-grid">
                <div className="v6-field full">
                  <label>Título *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex.: Audiência prévia / Termo de prazo de contestação..."
                    value={eventForm.title}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, title: e.target.value })
                    }
                  />
                </div>

                <div className="v6-field">
                  <label>Data *</label>
                  <input
                    type="date"
                    required
                    value={eventForm.date}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, date: e.target.value })
                    }
                  />
                </div>

                <div className="v6-field">
                  <label>Hora</label>
                  <input
                    type="time"
                    value={eventForm.time}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, time: e.target.value })
                    }
                  />
                </div>

                <div className="v6-field">
                  <label>Tipo</label>
                  <select
                    value={normalizeEventType(eventForm.type)}
                    onChange={(e) =>
                      setEventForm({
                        ...eventForm,
                        type: e.target.value as CalendarEvent["type"],
                      })
                    }
                  >
                    <option value="Compromisso">Compromisso</option>
                    <option value="Diligência">Diligência</option>
                    <option value="Prazo">Prazo</option>
                    <option value="Prazo de tarefa">Prazo de tarefa</option>
                    <option value="Férias / Ausência">Férias / Ausência</option>
                  </select>
                </div>

                <div className="v6-field">
                  <label>Responsável</label>
                  <select
                    value={eventForm.owner}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, owner: e.target.value })
                    }
                  >
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="v6-field full">
                  <label>Cliente (opcional)</label>
                  <select
                    value={
                      clients.find(
                        (c) =>
                          c.name === eventForm.subtitle ||
                          (eventForm.subtitle &&
                            eventForm.subtitle.includes(c.name))
                      )?.id || ""
                    }
                    onChange={(e) => {
                      const sel = clients.find((c) => c.id === e.target.value);
                      setEventForm({
                        ...eventForm,
                        subtitle: sel ? sel.name : "",
                      });
                    }}
                  >
                    <option value="">Sem cliente associado</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="v6-field full">
                  <label>Observações / Subtítulo</label>
                  <textarea
                    value={eventForm.subtitle}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, subtitle: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="v6-modal-actions justify-between!">
                <div>
                  {editingEvent ? (
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteEvent(editingEvent.id);
                        setIsEventModalOpen(false);
                      }}
                      className="v6-btn danger"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar</span>
                    </button>
                  ) : (
                    <div />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEventModalOpen(false)}
                    className="v6-btn"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="v6-btn primary">
                    Guardar na Agenda
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}