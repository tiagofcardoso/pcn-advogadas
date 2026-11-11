"use client";

import React, { useState, useEffect } from "react";
import {
  AuditLogEntry,
  CalendarEvent,
  Client,
  Task,
  TaskPriority,
  TaskV6Status,
  UserProfile,
} from "@/lib/types";
import {
  DEFAULT_GCAL_ID,
  buildGoogleCalendarEmbedUrl,
  formatIsoDatePt,
  getPriorityBadgeStyle,
  getTaskDeadlineSemaphore,
  getTaskV6Status,
  getV6BadgeClass,
  normalizeEventType,
  sortTasksByUrgency,
  V6_STATUS_LIST,
} from "@/lib/v6Helpers";
import {
  Play,
  Pause,
  Check,
  Edit3,
  Plus,
  Clock,
  Trash2,
  MoreHorizontal,
  Archive,
  ExternalLink,
} from "lucide-react";

interface WorkspaceV6Props {
  mode: "dashboard" | "work" | "tasks";
  currentUser: UserProfile;
  isAdmin: boolean;
  tasks: Task[];
  clients: Client[];
  usersList: UserProfile[];
  events: CalendarEvent[];
  auditLogs: AuditLogEntry[];
  globalQuery: string;
  formatSeconds: (sec: number) => string;
  canWorkOn: (task: Task) => boolean;
  onStartTimer: (task: Task) => void;
  onPauseTimer: (task?: Task) => void;
  onCompleteTask: (task: Task) => void;
  onOpenTaskDetails: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onOpenNewTaskModal: () => void;
  onOpenNewClientModal: () => void;
  onOpenNewEventModal: (type?: CalendarEvent["type"]) => void;
  onEditEvent?: (evt: CalendarEvent) => void;
  onDeleteEvent?: (id: string) => void;
  onSwitchTab: (tab: any) => void;
  archivedCount: number;
}

export default function WorkspaceV6Tab({
  mode,
  currentUser,
  isAdmin,
  tasks,
  clients,
  usersList,
  events,
  auditLogs,
  globalQuery,
  formatSeconds,
  canWorkOn,
  onStartTimer,
  onPauseTimer,
  onCompleteTask,
  onOpenTaskDetails,
  onDeleteTask,
  onOpenNewTaskModal,
  onOpenNewClientModal,
  onOpenNewEventModal,
  onEditEvent,
  onDeleteEvent,
  onSwitchTab,
  archivedCount,
}: WorkspaceV6Props) {
  const [gcalId, setGcalId] = useState<string>(DEFAULT_GCAL_ID);
  const [gcalMode, setGcalMode] = useState<"MONTH" | "WEEK" | "AGENDA">("MONTH");
  const [selectedWorkTaskId, setSelectedWorkTaskId] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncGcalId = () => {
      try {
        const saved = localStorage.getItem("pcn_google_calendar_id");
        if (
          saved &&
          saved.trim() &&
          saved.trim() !== "pt.portuguese#holiday@group.v.calendar.google.com"
        ) {
          setGcalId(saved.trim());
        } else {
          setGcalId(DEFAULT_GCAL_ID);
        }
      } catch {}
    };
    syncGcalId();
    const handleCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === "string" && detail.trim()) {
        setGcalId(detail.trim());
      } else {
        syncGcalId();
      }
    };
    window.addEventListener("pcn-gcal-updated", handleCustom);
    window.addEventListener("storage", syncGcalId);
    return () => {
      window.removeEventListener("pcn-gcal-updated", handleCustom);
      window.removeEventListener("storage", syncGcalId);
    };
  }, []);

  const embedSrc = React.useMemo(
    () => buildGoogleCalendarEmbedUrl(gcalId, gcalMode),
    [gcalId, gcalMode]
  );

  // Filters for Gestão de Tarefas (V6 Row Table)
  const [v6StatusFilter, setV6StatusFilter] = useState<string>("Todas");
  const [lawyerFilter, setLawyerFilter] = useState<string>("Todas");
  const [priorityFilter, setPriorityFilter] = useState<string>("Todas");

  const activeTasks = tasks.filter((t) => t.status !== "archived");

  const matchesGlobal = (t: Task) => {
    if (!globalQuery.trim()) return true;
    const q = globalQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      (t.description || "").toLowerCase().includes(q) ||
      t.client_name.toLowerCase().includes(q) ||
      (t.lawyer_name || "").toLowerCase().includes(q) ||
      getTaskV6Status(t).toLowerCase().includes(q)
    );
  };

  const resolveClientLabel = (t: Task) => {
    const c = clients.find((x) => x.id === t.client_id);
    if (c?.number) return `Cliente PCN ${c.number} · ${c.name}`;
    if (t.client_number) return `Cliente PCN ${t.client_number} · ${t.client_name}`;
    return t.client_name || "—";
  };

  const resolveLawyerLabel = (t: Task) => {
    if (t.assigned_to) {
      const u = usersList.find((x) => x.id === t.assigned_to);
      if (u) return u.name.replace("Dr.ª ", "");
    }
    if (t.lawyer_name && t.lawyer_name !== "—") {
      return t.lawyer_name.replace("Dr.ª ", "");
    }
    return "Pool / Livre";
  };

  // Helper to render the embedded Google Calendar inside "A Minha Área de Trabalho"
  const renderEmbeddedGoogleCalendar = () => {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-[#776f73] m-0">
            Sincronizado com{" "}
            <a
              href="https://calendar.google.com/calendar/u/0/r"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#92006f] font-semibold hover:underline"
            >
              Google Calendar
            </a>{" "}
            (Europe/Lisbon)
          </p>

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
                  className={`px-2.5 py-1 font-medium cursor-pointer transition-colors ${
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
              className="v6-btn py-1 px-2.5 text-xs"
              title="Abrir Google Calendar numa nova aba"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#92006f]" />
              <span>Google Calendar</span>
            </a>
          </div>
        </div>

        <div className="w-full rounded-xl overflow-hidden border border-[#e9e0dd] bg-[#faf8f6]">
          <iframe
            src={embedSrc}
            title="Calendário Geral – Agendas e Prazos (Google Calendar)"
            style={{ border: 0 }}
            width="100%"
            height="380"
            frameBorder="0"
            scrolling="no"
          />
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. PAINEL DE DIREÇÃO (V6.0)
  // ─────────────────────────────────────────────────────────────────────────────
  if (mode === "dashboard") {
    const filteredTasks = activeTasks.filter(matchesGlobal);
    const countPorIniciar = filteredTasks.filter(
      (t) => getTaskV6Status(t) === "Por iniciar"
    ).length;
    const countEmCurso = filteredTasks.filter(
      (t) => getTaskV6Status(t) === "Em curso"
    ).length;
    const countAguardar = filteredTasks.filter((t) =>
      getTaskV6Status(t).includes("aguardar")
    ).length;
    const countConcluidas = filteredTasks.filter(
      (t) => getTaskV6Status(t) === "Concluída"
    ).length;

    const topPriorityTasks = sortTasksByUrgency(
      filteredTasks.filter((t) => getTaskV6Status(t) !== "Concluída")
    ).slice(0, 5);

    const fullDateStr = new Date().toLocaleDateString("pt-PT", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    return (
      <div className="space-y-5">
        <div>
          <h1 className="font-serif-v6 text-[31px] text-[#28202a] leading-tight">
            Painel de Direção
          </h1>
          <p className="text-[#6e6569] text-sm mt-0.5">
            Visão global da equipa · {fullDateStr}
          </p>
        </div>

        {/* 4 V6 KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="v6-card v6-metric">
            <div className="v6-circle">☷</div>
            <div>
              <b>{countPorIniciar}</b>
              <span>Por iniciar</span>
            </div>
          </div>
          <div className="v6-card v6-metric">
            <div className="v6-circle">▶</div>
            <div>
              <b>{countEmCurso}</b>
              <span>Em curso</span>
            </div>
          </div>
          <div className="v6-card v6-metric">
            <div className="v6-circle">◷</div>
            <div>
              <b>{countAguardar}</b>
              <span>A aguardar</span>
            </div>
          </div>
          <div className="v6-card v6-metric">
            <div className="v6-circle">✓</div>
            <div>
              <b>{countConcluidas}</b>
              <span>Concluídas</span>
            </div>
          </div>
        </div>

        {/* Middle Row: Distribuição de trabalho + Prioridades (Top 5 mais urgentes / por vencer) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <section className="lg:col-span-7 v6-card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-serif-v6 text-[21px] text-[#28202a] m-0">
                Distribuição de trabalho
              </h2>
              <button
                type="button"
                onClick={() => onSwitchTab("tasks")}
                className="text-xs font-semibold text-[#92006f] hover:underline cursor-pointer"
              >
                Ver todas
              </button>
            </div>

            <div className="divide-y divide-[#f0eae6]">
              {usersList
                .filter((u) => u.is_active !== false)
                .map((u) => {
                  const uActiveCount = activeTasks.filter(
                    (t) =>
                      getTaskV6Status(t) !== "Concluída" &&
                      (t.assigned_to === u.id ||
                        (t.lawyer_name &&
                          t.lawyer_name
                            .toLowerCase()
                            .includes(u.name.toLowerCase())))
                  ).length;

                  return (
                    <div
                      key={u.id}
                      className="py-3 flex items-center justify-between gap-3 text-sm"
                    >
                      <strong className="text-[#28202a]">{u.name}</strong>
                      <span className="text-xs text-[#776f73]">
                        {uActiveCount} tarefas ativas
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setLawyerFilter(u.id);
                          onSwitchTab("tasks");
                        }}
                        className="v6-btn py-1.5 px-3 text-xs"
                      >
                        Gerir
                      </button>
                    </div>
                  );
                })}
            </div>
          </section>

          <section className="lg:col-span-5 v6-card space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif-v6 text-[21px] text-[#28202a] m-0">
                  Tarefa Prioritária
                </h2>
                <p className="text-[11px] text-[#776f73] mt-0.5">
                  Assuntos que exigem atenção ·{" "}
                  <span className="text-[#9b2226] font-semibold">
                    ● Vermelho: hoje/vencido
                  </span>{" "}
                  ·{" "}
                  <span className="text-[#856404] font-semibold">
                    ● Amarelo: próx. 5 dias
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSwitchTab("tasks")}
                className="text-xs font-semibold text-[#92006f] hover:underline cursor-pointer"
              >
                Ver todas
              </button>
            </div>

            {topPriorityTasks.length === 0 ? (
              <p className="text-xs text-[#776f73] py-4">
                Sem tarefas prioritárias ou assuntos urgentes de momento.
              </p>
            ) : (
              <div className="space-y-2 text-xs">
                {topPriorityTasks.map((t) => {
                  const sem = getTaskDeadlineSemaphore(t);
                  const prio = getPriorityBadgeStyle(t.priority);
                  const v6St = getTaskV6Status(t);
                  return (
                    <div
                      key={t.id}
                      onClick={() => onOpenTaskDetails(t)}
                      className="p-2.5 rounded-lg border cursor-pointer transition-all hover:shadow-xs flex items-center justify-between gap-2.5"
                      style={{
                        backgroundColor:
                          sem.level === "red"
                            ? "#fff5f5"
                            : sem.level === "yellow"
                            ? "#fffbeb"
                            : "#fdfbfa",
                        borderColor:
                          sem.level === "red"
                            ? "#f5c2c7"
                            : sem.level === "yellow"
                            ? "#ffe69c"
                            : "#eee5e1",
                        borderLeftWidth: "4px",
                        borderLeftColor: sem.dotColor,
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: sem.dotColor }}
                          />
                          <strong className="text-[#28202a] truncate">
                            {t.title}
                          </strong>
                        </div>
                        <div className="text-[11px] text-[#6d5d66] mt-0.5 truncate">
                          {t.client_name} · {resolveLawyerLabel(t)} ·{" "}
                          <span className="font-semibold text-[#59083e]">{v6St}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10.5px] font-bold border whitespace-nowrap"
                          style={{
                            backgroundColor: sem.bg,
                            color: sem.text,
                            borderColor: sem.border,
                          }}
                        >
                          {sem.label} ({sem.formattedDate})
                        </span>
                        <span
                          className="px-2 py-0.2 rounded-full text-[10px] font-semibold border"
                          style={{
                            backgroundColor: prio.bg,
                            color: prio.text,
                            borderColor: prio.border,
                          }}
                        >
                          Prioridade: {prio.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Row: Prazos e compromissos (Left, botão Calendário por baixo) + Acesso Rápido (Right, 3 botões) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <section className="lg:col-span-8 v6-card flex flex-col justify-between space-y-3">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-serif-v6 text-[21px] text-[#28202a] m-0">
                  Prazos &amp; Compromissos
                </h2>
                <button
                  type="button"
                  onClick={() => onOpenNewEventModal("Compromisso")}
                  className="text-xs font-semibold text-[#92006f] hover:underline cursor-pointer"
                >
                  + Novo registo
                </button>
              </div>
              <div className="divide-y divide-[#f0eae6] text-xs">
                {events.slice(0, 6).map((e) => {
                  const normType = normalizeEventType(e.type);
                  return (
                    <div
                      key={e.id}
                      className="py-2.5 flex items-center justify-between gap-4 hover:bg-[#fdfbf9] px-2 rounded"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-16 shrink-0 text-left">
                          <strong className="font-serif-v6 text-sm text-[#28202a] block leading-tight">
                            {e.time}
                          </strong>
                          <span className="text-[10px] text-[#776f73] font-medium">
                            {formatIsoDatePt(e.date)}
                          </span>
                        </div>
                        <span className="w-7 h-7 rounded-lg bg-[#f4eee8] text-[#7b175f] flex items-center justify-center shrink-0">
                          {normType.includes("Prazo") ? "⚖" : "📅"}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <strong className="text-[#28202a] font-semibold truncate block">
                              {e.title}
                            </strong>
                            <span
                              className={`v6-badge text-[10px]! py-0! px-1.5! shrink-0 ${
                                normType.includes("Prazo")
                                  ? "wait"
                                  : normType.includes("Férias")
                                  ? "start"
                                  : ""
                              }`}
                            >
                              {normType}
                            </span>
                          </div>
                          {e.subtitle && (
                            <span className="text-[11px] text-[#776f73] truncate block mt-0.5">
                              {e.subtitle}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            onEditEvent ? onEditEvent(e) : onSwitchTab("calendar")
                          }
                          className="v6-btn py-1 px-2.5 text-[11px]"
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  );
                })}
                {events.length === 0 && (
                  <p className="py-4 text-center text-[#776f73] italic">
                    Sem prazos ou compromissos registados.
                  </p>
                )}
              </div>
            </div>

            {/* Botão de atalho para o Calendário por baixo (como na Versão 6) */}
            <div className="pt-3 border-t border-[#f0eae6] flex items-center justify-between">
              <button
                type="button"
                onClick={() => onSwitchTab("calendar")}
                className="v6-btn gold text-xs font-semibold"
              >
                <span>📅 Abrir Calendário Geral</span>
              </button>
              <span className="text-[11px] text-[#776f73]">
                Sincronizado com Agendas e Prazos
              </span>
            </div>
          </section>

          {/* Do lado direito: Acesso Rápido com os 3 botões (+ Nova Tarefa; + Novo Compromisso; + Novo Prazo) */}
          <section className="lg:col-span-4 v6-card flex flex-col justify-between space-y-3">
            <div className="space-y-3">
              <div>
                <h2 className="font-serif-v6 text-[21px] text-[#28202a] m-0">
                  Acesso Rápido
                </h2>
                <p className="text-xs text-[#776f73] mt-0.5">
                  Atalhos diretos para registo imediato
                </p>
              </div>

              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={onOpenNewTaskModal}
                  className="w-full v6-btn primary py-3 px-4 justify-start text-sm font-semibold shadow-xs"
                >
                  <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">
                    📋
                  </span>
                  <span>+ Nova Tarefa</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenNewEventModal("Compromisso")}
                  className="w-full v6-btn gold py-3 px-4 justify-start text-sm font-semibold"
                >
                  <span className="w-6 h-6 rounded-full bg-[#966c2d]/15 flex items-center justify-center text-xs">
                    📅
                  </span>
                  <span>+ Novo Compromisso</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenNewEventModal("Prazo")}
                  className="w-full v6-btn py-3 px-4 justify-start text-sm font-semibold border-[#e2d3c1] bg-[#fdfaf6] hover:bg-[#f6efe4]"
                >
                  <span className="w-6 h-6 rounded-full bg-[#59083e]/10 text-[#59083e] flex items-center justify-center text-xs">
                    ⚖️
                  </span>
                  <span>+ Novo Prazo</span>
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-[#f0eae6] text-[11px] text-[#776f73]">
              Os novos registos ficam automaticamente visíveis na equipa e no calendário.
            </div>
          </section>
        </div>

        {/* Final do Painel de Direção: Controlo de Tarefas (compilado por Advogada, equivalente ao Atividade por Advogada da V5.2) */}
        <section className="v6-card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-serif-v6 text-[21px] text-[#28202a] m-0">
                Controlo de Tarefas
              </h2>
              <p className="text-xs text-[#776f73] mt-0.5">
                Informação compilada por Advogada · Estados, carga ativa e tempo registado
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSwitchTab("tasks")}
              className="v6-btn text-xs"
            >
              Ver Gestão de Tarefas ›
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#f7f3ef] text-[#50454b] border-b border-[#e8dfd9]">
                  <th className="py-2.5 px-3">Advogada</th>
                  <th className="py-2.5 px-3 text-center">Por iniciar</th>
                  <th className="py-2.5 px-3 text-center">Em curso</th>
                  <th className="py-2.5 px-3 text-center">A aguardar</th>
                  <th className="py-2.5 px-3 text-center">Redistribuídas</th>
                  <th className="py-2.5 px-3 text-center">Concluídas</th>
                  <th className="py-2.5 px-3 text-center">Total Ativas</th>
                  <th className="py-2.5 px-3 text-right">Tempo Registado</th>
                  <th className="py-2.5 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0eae6]">
                {usersList
                  .filter((u) => u.is_active !== false)
                  .map((u) => {
                    const uTasks = activeTasks.filter(
                      (t) =>
                        t.assigned_to === u.id ||
                        (t.lawyer_name &&
                          t.lawyer_name
                            .toLowerCase()
                            .includes(u.name.replace("Dr.ª ", "").toLowerCase()))
                    );
                    const cStart = uTasks.filter(
                      (t) => getTaskV6Status(t) === "Por iniciar"
                    ).length;
                    const cRun = uTasks.filter(
                      (t) => getTaskV6Status(t) === "Em curso"
                    ).length;
                    const cWait = uTasks.filter((t) =>
                      getTaskV6Status(t).includes("aguardar")
                    ).length;
                    const cRedist = uTasks.filter(
                      (t) => getTaskV6Status(t) === "Redistribuída"
                    ).length;
                    const cDone = uTasks.filter(
                      (t) => getTaskV6Status(t) === "Concluída"
                    ).length;
                    const cActive = uTasks.filter(
                      (t) => getTaskV6Status(t) !== "Concluída"
                    ).length;
                    const totalSecs = uTasks.reduce(
                      (acc, t) => acc + (t.total_duration_seconds || 0),
                      0
                    );
                    const hrs = Math.floor(totalSecs / 3600);
                    const mins = Math.floor((totalSecs % 3600) / 60);

                    return (
                      <tr key={u.id} className="hover:bg-[#fdfbf9]">
                        <td className="py-3 px-3 font-semibold text-[#28202a]">
                          <div>{u.name}</div>
                          <div className="text-[10.5px] text-[#776f73] font-normal">
                            {u.email}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="v6-badge start">{cStart}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="v6-badge">{cRun}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="v6-badge wait">{cWait}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="v6-badge redist">{cRedist}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="v6-badge done">{cDone}</span>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-[#59083e]">
                          {cActive}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-[#28202a]">
                          {hrs}h {String(mins).padStart(2, "0")}m
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setLawyerFilter(u.id);
                              onSwitchTab("tasks");
                            }}
                            className="v6-btn py-1 px-2.5 text-[11px]"
                          >
                            Ver tarefas
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. A MINHA ÁREA DE TRABALHO (Fiel a `sample/minha_area_trabalho.jpeg` sem aniversário)
  // ─────────────────────────────────────────────────────────────────────────────
  if (mode === "work") {
    const firstName = currentUser.name.replace("Dr.ª ", "").split(" ")[0];
    const personalTasksOnly = activeTasks.filter(
      (t) =>
        t.assigned_to === currentUser.id ||
        (t.lawyer_name &&
          t.lawyer_name.toLowerCase().includes(firstName.toLowerCase()))
    );
    const myTasks = sortTasksByUrgency(
      (personalTasksOnly.length > 0 || !isAdmin ? personalTasksOnly : activeTasks).filter(
        matchesGlobal
      )
    );

    const porIniciarCount = myTasks.filter(
      (t) => getTaskV6Status(t) === "Por iniciar"
    ).length;
    const emCursoCount = myTasks.filter(
      (t) => getTaskV6Status(t) === "Em curso"
    ).length;
    const aguardarCount = myTasks.filter((t) =>
      getTaskV6Status(t).includes("aguardar")
    ).length;
    const concluidasCount = myTasks.filter(
      (t) => getTaskV6Status(t) === "Concluída"
    ).length;

    const todayIso = new Date().toISOString().slice(0, 10);
    const upcomingOrTodayEvents = events.filter((e) => e.date >= todayIso);
    const activeEventPool =
      upcomingOrTodayEvents.length > 0 ? upcomingOrTodayEvents : events;
    const compromissosCount = activeEventPool.filter((e) => {
      const t = normalizeEventType(e.type);
      return t === "Compromisso" || t === "Diligência";
    }).length;
    const prazosCount = activeEventPool.filter((e) =>
      normalizeEventType(e.type).includes("Prazo")
    ).length;

    const runningOrSelectedTask =
      myTasks.find((t) => t.id === selectedWorkTaskId) ||
      myTasks.find((t) => t.status === "in_progress") ||
      myTasks.find((t) => getTaskV6Status(t) !== "Concluída") ||
      myTasks[0];

    const todayTotalSeconds = myTasks.reduce(
      (acc, t) => acc + (t.total_duration_seconds || 0),
      0
    );
    const todayHours = Math.floor(todayTotalSeconds / 3600);
    const todayMins = Math.floor((todayTotalSeconds % 3600) / 60);

    const fullWeekdayDate = new Date().toLocaleDateString("pt-PT", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const capitalizedDate =
      fullWeekdayDate.charAt(0).toUpperCase() + fullWeekdayDate.slice(1);

    return (
      <div className="space-y-5">
        {/* Greeting Header (Birthday card removed from here and placed in Calendar!) */}
        <div>
          <h1 className="font-serif-v6 text-[31px] text-[#28202a] leading-tight">
            Bem-vinda, {firstName}!
          </h1>
          <p className="text-[#6e6569] text-sm mt-0.5">{capitalizedDate}</p>
        </div>

        {/* Top Row: 5 KPI Cards matching minha_area_trabalho.jpeg */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-3.5">
          <div className="v6-card v6-metric py-4 px-4">
            <div className="v6-circle">☷</div>
            <div>
              <b>{porIniciarCount}</b>
              <span>Por iniciar</span>
            </div>
          </div>

          <div className="v6-card v6-metric py-4 px-4">
            <div className="v6-circle">▶</div>
            <div>
              <b>{emCursoCount}</b>
              <span>Em curso</span>
            </div>
          </div>

          <div className="v6-card v6-metric py-4 px-4">
            <div className="v6-circle">◷</div>
            <div>
              <b>{aguardarCount}</b>
              <span>A aguardar</span>
            </div>
          </div>

          <div className="v6-card v6-metric py-4 px-4">
            <div className="v6-circle">✓</div>
            <div>
              <b>{concluidasCount}</b>
              <span>Concluídas</span>
            </div>
          </div>

          {/* 5th Card: Agenda de hoje (Sombreado diferenciado para maior destaque!) */}
          <div
            onClick={() => onSwitchTab("calendar")}
            style={{
              background: "linear-gradient(135deg, #fdf6eb 0%, #f1dfc1 100%)",
              borderColor: "#d3b178",
              boxShadow:
                "0 12px 28px rgba(89, 8, 62, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.85)",
            }}
            className="col-span-2 lg:col-span-1 v6-card py-4 px-4 flex flex-col justify-center cursor-pointer hover:scale-[1.01] transition-all"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-[#59083e] uppercase tracking-wider">
              <span className="w-7 h-7 rounded-full bg-white/80 text-[#966c2d] shadow-xs flex items-center justify-center text-sm">
                📅
              </span>
              <span>Agenda de hoje</span>
            </div>
            <div className="mt-2.5 flex items-center gap-2 text-xs text-[#28202a] font-bold">
              <span>{compromissosCount} Compromissos</span>
              <span className="text-[#966c2d]">|</span>
              <span>{prazosCount} Prazo</span>
            </div>
          </div>
        </div>

        {/* Middle Row: Tarefa em execução (Left) + Calendário Geral (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Tarefa em execução */}
          <section className="lg:col-span-6 v6-card flex flex-col justify-between space-y-3">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#f0eae6] pb-2.5">
                <h2 className="font-serif-v6 text-[21px] text-[#28202a] m-0">
                  Tarefa em execução
                </h2>
                <button
                  type="button"
                  onClick={() => onSwitchTab("tasks")}
                  className="text-xs font-semibold text-[#92006f] hover:underline cursor-pointer"
                >
                  Ver todas ›
                </button>
              </div>

              {myTasks.filter((t) => getTaskV6Status(t) !== "Concluída")
                .length > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <select
                    value={runningOrSelectedTask?.id || ""}
                    onChange={(e) => setSelectedWorkTaskId(e.target.value)}
                    className="flex-1 text-xs border border-[#dfd6d6] rounded-[7px] px-3 py-2 bg-[#faf8f6] text-[#28202a] font-semibold"
                  >
                    {myTasks
                      .filter((t) => getTaskV6Status(t) !== "Concluída")
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} ({resolveClientLabel(t)})
                        </option>
                      ))}
                  </select>

                  {runningOrSelectedTask && (
                    <span
                      className={getV6BadgeClass(
                        getTaskV6Status(runningOrSelectedTask)
                      )}
                    >
                      {getTaskV6Status(runningOrSelectedTask)}
                    </span>
                  )}
                </div>
              )}

              {runningOrSelectedTask ? (
                <>
                  <div>
                    <h3 className="font-serif-v6 text-lg text-[#28202a] m-0">
                      {runningOrSelectedTask.title}
                    </h3>
                    <p className="text-xs text-[#6d5d66] font-semibold mt-0.5">
                      {resolveClientLabel(runningOrSelectedTask)}
                    </p>
                    {runningOrSelectedTask.description && (
                      <p className="text-xs text-[#776f73] mt-1">
                        {runningOrSelectedTask.description}
                      </p>
                    )}
                  </div>

                  <div className="v6-timer">
                    {formatSeconds(
                      runningOrSelectedTask.total_duration_seconds || 0
                    )}
                    <small>Tempo em execução</small>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {runningOrSelectedTask.status === "in_progress" ? (
                      <button
                        type="button"
                        onClick={() => onPauseTimer(runningOrSelectedTask)}
                        className="v6-btn primary"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        <span>Ⅱ Pausar</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onStartTimer(runningOrSelectedTask)}
                        className="v6-btn primary"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>▶ Iniciar / Retomar</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onCompleteTask(runningOrSelectedTask)}
                      className="v6-btn gold"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>✓ Concluir</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenTaskDetails(runningOrSelectedTask)}
                      className="v6-btn"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>✎ Registar manualmente</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-10 text-center text-xs text-[#776f73]">
                  Não existem tarefas ativas selecionadas. Crie uma nova tarefa
                  para iniciar o cronómetro.
                </div>
              )}
            </div>

            <p className="text-xs text-[#776f73] pt-2 border-t border-[#f0eae6]">
              Um cronómetro por utilizadora. O tempo guardado é associado à
              tarefa e à advogada.
            </p>
          </section>

          {/* Right: Calendário Geral — Agendas e Prazos */}
          <section className="lg:col-span-6 v6-card space-y-3">
            <div className="flex items-center justify-between border-b border-[#f0eae6] pb-2.5">
              <h2 className="font-serif-v6 text-[21px] text-[#28202a] m-0">
                Calendário Geral – Agendas e Prazos
              </h2>
              <button
                type="button"
                onClick={() => onSwitchTab("calendar")}
                className="text-xs font-semibold text-[#92006f] hover:underline cursor-pointer"
              >
                Abrir agenda ›
              </button>
            </div>

            {renderEmbeddedGoogleCalendar()}
          </section>
        </div>

        {/* Bottom Row: As minhas tarefas (Left) + Próximos acontecimentos (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: As minhas tarefas */}
          <section className="lg:col-span-6 v6-card space-y-3">
            <div className="flex items-center justify-between border-b border-[#f0eae6] pb-2.5">
              <h2 className="font-serif-v6 text-[21px] text-[#28202a] m-0">
                As minhas tarefas
              </h2>
              <button
                type="button"
                onClick={() => onSwitchTab("tasks")}
                className="text-xs font-semibold text-[#92006f] hover:underline cursor-pointer"
              >
                Ver todas ›
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#f7f3ef] text-[#50454b] border-b border-[#f0eae6]">
                    <th className="py-2.5 px-2.5">Tarefa</th>
                    <th className="py-2.5 px-2.5">Cliente</th>
                    <th className="py-2.5 px-2.5">Estado</th>
                    <th className="py-2.5 px-2.5">Prazo</th>
                    <th className="py-2.5 px-2.5 text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0eae6]">
                  {myTasks.slice(0, 6).map((t) => {
                    const v6St = getTaskV6Status(t);
                    const cObj = clients.find((x) => x.id === t.client_id);
                    const sem = getTaskDeadlineSemaphore(t);
                    return (
                      <tr
                        key={t.id}
                        className="hover:bg-[#fdfbf9]"
                        style={{ backgroundColor: sem.rowBg || undefined }}
                      >
                        <td className="py-2.5 px-2.5">
                          <button
                            type="button"
                            onClick={() => onOpenTaskDetails(t)}
                            className="font-semibold text-[#28202a] hover:text-[#92006f] text-left cursor-pointer"
                          >
                            {t.title}
                          </button>
                        </td>
                        <td className="py-2.5 px-2.5 text-[#6d5d66]">
                          {cObj?.number
                            ? `PCN ${cObj.number}`
                            : t.client_name}
                        </td>
                        <td className="py-2.5 px-2.5">
                          <span className={getV6BadgeClass(v6St)}>{v6St}</span>
                        </td>
                        <td className="py-2.5 px-2.5 whitespace-nowrap">
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border"
                            style={{
                              backgroundColor: sem.bg,
                              color: sem.text,
                              borderColor: sem.border,
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: sem.dotColor }}
                            />
                            <span>
                              {sem.formattedDate} · {sem.label}
                            </span>
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => onOpenTaskDetails(t)}
                            className="p-1 text-[#776f73] hover:text-[#28202a] cursor-pointer"
                            title="Editar tarefa"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {myTasks.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-6 text-center text-[#776f73] italic"
                      >
                        Sem tarefas atribuídas de momento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Right: Próximos acontecimentos */}
          <section className="lg:col-span-6 v6-card space-y-3">
            <div className="flex items-center justify-between border-b border-[#f0eae6] pb-2.5">
              <h2 className="font-serif-v6 text-[21px] text-[#28202a] m-0">
                Próximos acontecimentos
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenNewEventModal("Compromisso")}
                  className="text-xs font-semibold text-[#59083e] hover:underline cursor-pointer"
                >
                  + Novo registo
                </button>
                <span className="text-[#dfd6d6]">|</span>
                <button
                  type="button"
                  onClick={() => onSwitchTab("calendar")}
                  className="text-xs font-semibold text-[#92006f] hover:underline cursor-pointer"
                >
                  Ver todas ›
                </button>
              </div>
            </div>

            <div className="divide-y divide-[#f0eae6]">
              {events.slice(0, 8).map((e) => {
                const normType = normalizeEventType(e.type);
                return (
                  <div
                    key={e.id}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-[#fdfbf9] px-1 rounded"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-16 shrink-0 text-left">
                        <strong className="font-serif-v6 text-sm text-[#28202a] block leading-tight">
                          {e.time}
                        </strong>
                        <span className="text-[10px] text-[#776f73] font-medium">
                          {formatIsoDatePt(e.date)}
                        </span>
                      </div>
                       <span
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm shadow-2xs border"
                        style={{
                          backgroundColor: normType.includes("Prazo")
                            ? "#fff0d6"
                            : normType.includes("Férias")
                            ? "#e0eefc"
                            : "#faebf6",
                          borderColor: normType.includes("Prazo")
                            ? "#eed6a7"
                            : normType.includes("Férias")
                            ? "#b6d4fe"
                            : "#f0cde6",
                        }}
                      >
                        {normType.includes("Prazo")
                          ? "⚖️"
                          : normType.includes("Diligência")
                          ? "🏛️"
                          : normType.includes("Férias")
                          ? "🌴"
                          : "📅"}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-[#28202a] truncate">
                            {e.title}
                          </p>
                          <span
                            className={`v6-badge text-[10px]! py-0! px-1.5! shrink-0 ${
                              normType.includes("Prazo")
                                ? "wait"
                                : normType.includes("Férias")
                                ? "start"
                                : ""
                            }`}
                          >
                            {normType}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#776f73] truncate mt-0.5">
                          {e.subtitle || `${formatIsoDatePt(e.date)} · ${normType}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          onEditEvent ? onEditEvent(e) : onSwitchTab("calendar")
                        }
                        className="v6-btn py-1 px-2 text-[11px]"
                        title="Editar acontecimento"
                      >
                        Editar
                      </button>
                      {!e.id.startsWith("task_deadline_") && onDeleteEvent && (
                        <button
                          type="button"
                          onClick={() => onDeleteEvent(e.id)}
                          className="v6-btn danger py-1 px-1.5 text-[11px]"
                          title="Eliminar acontecimento"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {events.length === 0 && (
                <div className="py-6 text-center text-xs text-[#776f73] italic">
                  Sem acontecimentos ou prazos agendados.
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer Quick-Action Cards matching minha_area_trabalho.jpeg */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={() =>
              isAdmin ? onOpenNewClientModal() : onSwitchTab("clients")
            }
            className="v6-card py-3.5 px-4 flex items-center justify-center gap-2.5 font-serif-v6 text-sm text-[#59083e] hover:border-[#c5a467] hover:bg-[#fdfaf6] cursor-pointer transition-all"
          >
            <span className="w-7 h-7 rounded-full bg-[#f4ead9] border border-[#e2d0b1] flex items-center justify-center text-sm shrink-0">
              👤
            </span>
            <span className="font-semibold">+ Novo cliente</span>
          </button>

          <button
            type="button"
            onClick={onOpenNewTaskModal}
            className="v6-card py-3.5 px-4 flex items-center justify-center gap-2.5 font-serif-v6 text-sm text-[#59083e] hover:border-[#c5a467] hover:bg-[#fdfaf6] cursor-pointer transition-all"
          >
            <span className="w-7 h-7 rounded-full bg-[#faebf6] border border-[#efd0e6] flex items-center justify-center text-sm shrink-0">
              📋
            </span>
            <span className="font-semibold">+ Nova tarefa</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenNewEventModal("Compromisso")}
            className="v6-card py-3.5 px-4 flex items-center justify-center gap-2.5 font-serif-v6 text-sm text-[#59083e] hover:border-[#c5a467] hover:bg-[#fdfaf6] cursor-pointer transition-all"
          >
            <span className="w-7 h-7 rounded-full bg-[#e0eefc] border border-[#c2dcf7] flex items-center justify-center text-sm shrink-0">
              📅
            </span>
            <span className="font-semibold">+ Novo compromisso</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenNewEventModal("Prazo")}
            className="v6-card py-3.5 px-4 flex items-center justify-center gap-2.5 font-serif-v6 text-sm text-[#59083e] hover:border-[#c5a467] hover:bg-[#fdfaf6] cursor-pointer transition-all"
          >
            <span className="w-7 h-7 rounded-full bg-[#fff0d6] border border-[#eed6a7] flex items-center justify-center text-sm shrink-0">
              ⚖️
            </span>
            <span className="font-semibold">+ Novo prazo</span>
          </button>

          <div className="v6-card py-3 px-4 bg-[#f9f5f1] flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#f2eae0] text-[#966c2d] flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-xs leading-tight">
              <span className="text-[#50454b]">Tempo de hoje: </span>
              <strong className="font-serif-v6 text-sm text-[#59083e]">
                {todayHours}h {String(todayMins).padStart(2, "0")}m
              </strong>
              <span className="block text-[10px] text-[#776f73] mt-0.5">
                Registado nas minhas tarefas
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. GESTÃO DE TAREFAS (V6.0 Row-Based Table + Prioridade + Tempo + Semáforo)
  // ─────────────────────────────────────────────────────────────────────────────
  const filteredTableTasks = sortTasksByUrgency(
    activeTasks
      .filter(matchesGlobal)
      .filter(
        (t) =>
          v6StatusFilter === "Todas" || getTaskV6Status(t) === v6StatusFilter
      )
      .filter((t) => {
        if (lawyerFilter === "Todas") return true;
        const u = usersList.find((x) => x.id === lawyerFilter);
        return (
          t.assigned_to === lawyerFilter ||
          (u &&
            t.lawyer_name &&
            t.lawyer_name.toLowerCase().includes(u.name.toLowerCase()))
        );
      })
      .filter(
        (t) =>
          priorityFilter === "Todas" ||
          (t.priority || "Normal") === priorityFilter
      )
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-serif-v6 text-[31px] text-[#28202a] leading-tight">
            Gestão de Tarefas
          </h1>
          <p className="text-[#6e6569] text-sm mt-0.5">
            Registo único e partilhado por toda a equipa · Ordenadas da mais
            urgente para a menos urgente
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <button
              type="button"
              onClick={() => onSwitchTab("archived")}
              className="v6-btn text-xs"
            >
              <Archive className="w-3.5 h-3.5 text-[#59083e]" />
              <span>Tarefas Arquivadas ({archivedCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenNewTaskModal}
            className="v6-btn primary"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Nova tarefa</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <select
            value={v6StatusFilter}
            onChange={(e) => setV6StatusFilter(e.target.value)}
            className="border border-[#dfd6d6] rounded-[7px] px-3 py-2 bg-white text-[#28202a]"
          >
            <option value="Todas">Estado: Todas</option>
            {V6_STATUS_LIST.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <select
            value={lawyerFilter}
            onChange={(e) => setLawyerFilter(e.target.value)}
            className="border border-[#dfd6d6] rounded-[7px] px-3 py-2 bg-white text-[#28202a]"
          >
            <option value="Todas">Responsável: Todas</option>
            {usersList
              .filter((u) => u.is_active !== false)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="border border-[#dfd6d6] rounded-[7px] px-3 py-2 bg-white text-[#28202a]"
          >
            <option value="Todas">Prioridade: Todas</option>
            <option value="Urgente">Urgente</option>
            <option value="Alta">Alta</option>
            <option value="Normal">Normal</option>
          </select>

          <span className="text-[#776f73] font-medium ml-1">
            {filteredTableTasks.length} tarefa(s)
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#fde8e8] text-[#9b2226] border border-[#f5c2c7] font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#dc2626]" />
            Vermelho: vence hoje ou vencido
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#fff3cd] text-[#856404] border border-[#ffe69c] font-semibold">
            <span className="w-2 h-2 rounded-full bg-[#d97706]" />
            Amarelo: vence nos próximos 5 dias
          </span>
        </div>
      </div>

      {/* V6 Shared Row Table with Priority & Time */}
      <div className="v6-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="bg-[#f7f3ef] text-[#50454b] border-b border-[#f0eae6]">
                <th className="py-3 px-3.5">Tarefa</th>
                <th className="py-3 px-3.5">Cliente</th>
                <th className="py-3 px-3.5">Responsável</th>
                <th className="py-3 px-3.5">Prioridade</th>
                <th className="py-3 px-3.5">Tempo</th>
                <th className="py-3 px-3.5">Estado</th>
                <th className="py-3 px-3.5">Prazo</th>
                <th className="py-3 px-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0eae6]">
              {filteredTableTasks.map((task) => {
                const v6Status = getTaskV6Status(task);
                const prio = getPriorityBadgeStyle(task.priority);
                const sem = getTaskDeadlineSemaphore(task);
                const isRunning = task.status === "in_progress";
                const cObj = clients.find((x) => x.id === task.client_id);

                return (
                  <tr
                    key={task.id}
                    className={`hover:bg-[#fdfbf9] ${
                      isRunning ? "bg-[#fbf3f9]/60" : ""
                    }`}
                    style={{
                      backgroundColor: !isRunning && sem.rowBg ? sem.rowBg : undefined,
                    }}
                  >
                    <td className="py-3 px-3.5">
                      <button
                        type="button"
                        onClick={() => onOpenTaskDetails(task)}
                        className="font-semibold text-[#7b175f] hover:underline text-left cursor-pointer block"
                      >
                        {task.title}
                      </button>
                      <span className="text-[11px] text-[#776f73]">
                        {task.task_type}
                        {task.origin ? ` · ${task.origin}` : ""}
                        {task.entity ? ` · ${task.entity}` : ""}
                      </span>
                    </td>

                    <td className="py-3 px-3.5 text-[#28202a]">
                      {cObj
                        ? `${cObj.name}${
                            cObj.number ? ` · PCN ${cObj.number}` : ""
                          }`
                        : task.client_name}
                    </td>

                    <td className="py-3 px-3.5 font-medium text-[#28202a]">
                      {resolveLawyerLabel(task)}
                    </td>

                    <td className="py-3 px-3.5">
                      <span
                        className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                        style={{
                          backgroundColor: prio.bg,
                          color: prio.text,
                          borderColor: prio.border,
                        }}
                      >
                        {prio.label}
                      </span>
                    </td>

                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <span
                          className={`font-mono text-xs font-bold px-2 py-1 rounded border ${
                            isRunning
                              ? "bg-[#f4e3ef] text-[#7b175f] border-[#d9b3cf]"
                              : "bg-[#faf8f6] text-[#28202a] border-[#e9e0dd]"
                          }`}
                        >
                          {formatSeconds(task.total_duration_seconds || 0)}
                        </span>

                        {canWorkOn(task) && v6Status !== "Concluída" && (
                          <button
                            type="button"
                            onClick={() =>
                              isRunning
                                ? onPauseTimer(task)
                                : onStartTimer(task)
                            }
                            className={`v6-btn py-1 px-2 text-xs ${
                              isRunning ? "gold" : "primary"
                            }`}
                            title={
                              isRunning
                                ? "Pausar cronómetro"
                                : "Iniciar cronómetro"
                            }
                          >
                            {isRunning ? "Ⅱ" : "▶"}
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3.5">
                      <span className={getV6BadgeClass(v6Status)}>
                        {v6Status}
                      </span>
                    </td>

                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border"
                        style={{
                          backgroundColor: sem.bg,
                          color: sem.text,
                          borderColor: sem.border,
                        }}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: sem.dotColor }}
                        />
                        <span>
                          {sem.formattedDate} · {sem.label}
                        </span>
                      </span>
                    </td>

                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenTaskDetails(task)}
                          className="v6-btn py-1 px-2.5 text-xs"
                        >
                          Editar / Horas
                        </button>

                        {canWorkOn(task) && v6Status !== "Concluída" && (
                          <button
                            type="button"
                            onClick={() => onCompleteTask(task)}
                            className="v6-btn gold py-1 px-2 text-xs"
                            title="Concluir tarefa"
                          >
                            ✓
                          </button>
                        )}

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => onDeleteTask(task)}
                            className="v6-btn danger py-1 px-2 text-xs"
                            title="Eliminar tarefa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredTableTasks.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-10 text-center text-xs text-[#776f73] italic"
                  >
                    Nenhuma tarefa encontrada para os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

