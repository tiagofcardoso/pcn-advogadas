"use client";

import React from "react";
import {
  Client,
  ROLE_LABELS,
  ServiceCategory,
  Task,
  TaskPriority,
  TaskV6Status,
  TaskWaitingPeriod,
  UserProfile,
} from "@/lib/types";
import {
  TASK_ORIGIN_OPTIONS,
  V6_STATUS_LIST,
  formatDaysAndHours,
  getTaskDeadlineSemaphore,
  isWaitingStatus,
  toDatetimeLocalValue,
} from "@/lib/v6Helpers";
import { Clock, Hourglass } from "lucide-react";

export interface UnifiedTaskFormState {
  title: string;
  client_id: string;
  task_type_id: string;
  custom_type_name: string;
  custom_rate: string;
  assigned_to: string;
  request_date: string;
  origin: string;
  communication_ref: string;
  start_date: string;
  due_date: string;
  v6_status: TaskV6Status;
  priority: TaskPriority;
  entity: string;
  process_reference: string;
  follow_up_date: string;
  waiting_started_at: string;
  waiting_total_seconds: number;
  waiting_periods: TaskWaitingPeriod[];
  duration_hours: number;
  duration_minutes: number;
  duration_seconds: number;
  description: string;
}

interface TaskFormFieldsProps {
  form: UnifiedTaskFormState;
  onChange: (next: UnifiedTaskFormState) => void;
  clients: Client[];
  users: UserProfile[];
  serviceCategories: ServiceCategory[];
  formatSeconds: (sec: number) => string;
  existingTask?: Task | null;
}

/**
 * Shared fields for both "Nova Tarefa" and "Editar Tarefa" modals (V5.2/V6 unified structure
 * with time-tracking, Pausada state, and external waiting-time tracking in days & hours).
 */
export default function TaskFormFields({
  form,
  onChange,
  clients,
  users,
  serviceCategories,
  formatSeconds,
  existingTask,
}: TaskFormFieldsProps) {
  const inWaitingState = isWaitingStatus(form.v6_status);

  const liveWaitingStartMs =
    inWaitingState && form.waiting_started_at
      ? new Date(form.waiting_started_at).getTime()
      : NaN;
  const currentPeriodWaitingSec =
    inWaitingState && !isNaN(liveWaitingStartMs)
      ? Math.max(0, Math.floor((Date.now() - liveWaitingStartMs) / 1000))
      : 0;
  const totalWaitingSec =
    Math.max(0, form.waiting_total_seconds || 0) + currentPeriodWaitingSec;

  const totalWorkSec =
    (Number(form.duration_hours) || 0) * 3600 +
    (Number(form.duration_minutes) || 0) * 60 +
    (Number(form.duration_seconds) || 0);

  const handleStatusChange = (nextStatus: TaskV6Status) => {
    let nextWaitingStart = form.waiting_started_at;
    if (isWaitingStatus(nextStatus) && !nextWaitingStart) {
      nextWaitingStart = toDatetimeLocalValue(new Date().toISOString());
    }
    onChange({
      ...form,
      v6_status: nextStatus,
      waiting_started_at: nextWaitingStart,
    });
  };

  return (
    <div className="v6-form-grid">
      {/* Cliente + Advogada Responsável */}
      <div className="v6-field">
        <label>Cliente *</label>
        <select
          required
          value={form.client_id || (clients[0]?.id ?? "")}
          onChange={(e) => onChange({ ...form, client_id: e.target.value })}
        >
          {clients.map((c, idx) => (
            <option key={c.id} value={c.id}>
              {c.number || `PCN ${String(idx + 1).padStart(4, "0")}`} — {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="v6-field">
        <label>Advogada responsável</label>
        <select
          value={form.assigned_to}
          onChange={(e) => onChange({ ...form, assigned_to: e.target.value })}
        >
          <option value="pool">Pool Partilhada (Por atribuir)</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({ROLE_LABELS[u.role] || "Advogada"})
            </option>
          ))}
        </select>
      </div>

      {/* Descrição da tarefa (Título) */}
      <div className="v6-field full">
        <label>Descrição da tarefa *</label>
        <input
          type="text"
          required
          placeholder="Ex.: Contestação / Registo predial / Parecer jurídico..."
          value={form.title}
          onChange={(e) => onChange({ ...form, title: e.target.value })}
        />
      </div>

      {/* Serviço / Categoria */}
      <div className="v6-field">
        <label>Serviço / Categoria (€/h)</label>
        <select
          value={form.task_type_id}
          onChange={(e) => {
            const val = e.target.value;
            const found = serviceCategories.find((c) => c.id === val);
            onChange({
              ...form,
              task_type_id: val,
              custom_rate: found ? String(found.hourly_rate) : form.custom_rate,
            });
          }}
        >
          {serviceCategories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name} ({cat.hourly_rate.toFixed(2)} €/h)
            </option>
          ))}
          <option value="__custom__">✍️ Outra / Texto livre (Personalizada)...</option>
        </select>
      </div>

      {/* Data de entrada do pedido */}
      <div className="v6-field">
        <label>Data de entrada do pedido</label>
        <input
          type="date"
          value={form.request_date}
          onChange={(e) => onChange({ ...form, request_date: e.target.value })}
        />
      </div>

      {form.task_type_id === "__custom__" && (
        <>
          <div className="v6-field">
            <label>Nome da Categoria Personalizada *</label>
            <input
              type="text"
              required
              placeholder="Ex.: Requerimento avulso, Diligência, Parecer..."
              value={form.custom_type_name}
              onChange={(e) =>
                onChange({ ...form, custom_type_name: e.target.value })
              }
            />
          </div>
          <div className="v6-field">
            <label>Taxa / Valor Hora (€/h)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              placeholder="120.00"
              value={form.custom_rate}
              onChange={(e) =>
                onChange({ ...form, custom_rate: e.target.value })
              }
            />
          </div>
        </>
      )}

      {/* Origem + Referência da comunicação */}
      <div className="v6-field">
        <label>Origem</label>
        <select
          value={form.origin || "E-mail"}
          onChange={(e) => onChange({ ...form, origin: e.target.value })}
        >
          {TASK_ORIGIN_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
          {form.origin &&
            !TASK_ORIGIN_OPTIONS.includes(form.origin as any) && (
              <option value={form.origin}>{form.origin}</option>
            )}
        </select>
      </div>

      <div className="v6-field">
        <label>Referência da comunicação (e-mail / mensagem)</label>
        <input
          type="text"
          placeholder="Assunto do e-mail, WhatsApp ou carta..."
          value={form.communication_ref}
          onChange={(e) =>
            onChange({ ...form, communication_ref: e.target.value })
          }
        />
      </div>

      {/* Início do trabalho + Prazo interno / judicial */}
      <div className="v6-field">
        <label>Início do trabalho</label>
        <input
          type="date"
          value={form.start_date}
          onChange={(e) => onChange({ ...form, start_date: e.target.value })}
        />
      </div>

      <div className="v6-field">
        <div className="flex items-center justify-between">
          <label>Prazo interno / judicial</label>
          {form.due_date &&
            (() => {
              const sem = getTaskDeadlineSemaphore({
                ...(existingTask || {
                  id: "preview",
                  title: form.title,
                  client_id: form.client_id,
                  client_name: "",
                  task_type: "",
                  status: "assigned",
                  total_duration_seconds: totalWorkSec,
                }),
                due_date: form.due_date,
                v6_status: form.v6_status,
              });
              if (sem.level === "red" || sem.level === "yellow") {
                return (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: sem.bg,
                      color: sem.text,
                      border: `1px solid ${sem.border}`,
                    }}
                  >
                    {sem.label}
                  </span>
                );
              }
              return null;
            })()}
        </div>
        <input
          type="date"
          value={form.due_date}
          onChange={(e) => onChange({ ...form, due_date: e.target.value })}
        />
      </div>

      {/* Estado + Prioridade */}
      <div className="v6-field">
        <label>Estado</label>
        <select
          value={form.v6_status}
          onChange={(e) => handleStatusChange(e.target.value as TaskV6Status)}
        >
          {V6_STATUS_LIST.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </div>

      <div className="v6-field">
        <label>Prioridade</label>
        <select
          value={form.priority}
          onChange={(e) =>
            onChange({ ...form, priority: e.target.value as TaskPriority })
          }
        >
          <option value="Normal">Normal</option>
          <option value="Alta">Alta</option>
          <option value="Urgente">Urgente</option>
        </select>
      </div>

      {/* Local de distribuição / entidade + Referência do processo / pedido */}
      <div className="v6-field">
        <label>Local de distribuição / entidade</label>
        <input
          type="text"
          placeholder="Ex.: Conservatória do Porto / Tribunal de Braga..."
          value={form.entity}
          onChange={(e) => onChange({ ...form, entity: e.target.value })}
        />
      </div>

      <div className="v6-field">
        <label>Referência do processo / pedido</label>
        <input
          type="text"
          placeholder="Ex.: Proc. 512/26.4T8OVR..."
          value={form.process_reference}
          onChange={(e) =>
            onChange({ ...form, process_reference: e.target.value })
          }
        />
      </div>

      {/* Painel: Próxima data de acompanhamento & Tempo em Espera de Terceiros / Cliente / Entidade */}
      <div className="v6-field full">
        <div className="rounded-xl border border-[#ebd8b9] bg-[#fffaf2] p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#7a5414] flex items-center gap-1.5">
              <Hourglass className="w-3.5 h-3.5 text-[#966c2d]" />
              Acompanhamento e Tempo em Espera (Cliente / Entidade / Terceiros)
            </span>
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-[#fff0d6] text-[#7a5414] border border-[#ebd2a6]">
              Espera acumulada: {formatDaysAndHours(totalWaitingSec)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="block text-[11px] font-semibold text-[#6d5d66] mb-1">
                Próxima data de acompanhamento
              </span>
              <input
                type="date"
                value={form.follow_up_date}
                onChange={(e) =>
                  onChange({ ...form, follow_up_date: e.target.value })
                }
                className="bg-white!"
              />
            </div>

            <div>
              <span className="block text-[11px] font-semibold text-[#6d5d66] mb-1">
                Em espera desde (início da pendência externa)
              </span>
              <input
                type="datetime-local"
                disabled={!inWaitingState}
                value={inWaitingState ? form.waiting_started_at : ""}
                onChange={(e) =>
                  onChange({ ...form, waiting_started_at: e.target.value })
                }
                className="bg-white! disabled:opacity-50"
              />
            </div>
          </div>

          <p className="text-[11px] text-[#736872] m-0">
            {inWaitingState
              ? `Contagem ativa (${form.v6_status}): ${formatDaysAndHours(
                  currentPeriodWaitingSec
                )} neste período. Separado das horas de trabalho do escritório.`
              : "Ao colocar o estado em «A aguardar cliente / entidade / terceiros», este contador regista automaticamente em dias e horas o tempo de espera externa."}
          </p>

          {form.waiting_periods.length > 0 && (
            <div className="pt-2 border-t border-[#efe2ca] space-y-1">
              <span className="text-[10.5px] font-bold text-[#7a5414] uppercase tracking-wide block">
                Registo de períodos de espera anteriores ({form.waiting_periods.length})
              </span>
              <div className="max-h-24 overflow-y-auto space-y-1 text-[11px] text-[#50454b]">
                {form.waiting_periods.map((wp) => {
                  const sMs = new Date(wp.started_at).getTime();
                  const eMs = wp.ended_at ? new Date(wp.ended_at).getTime() : Date.now();
                  const diffSec =
                    !isNaN(sMs) && !isNaN(eMs)
                      ? Math.max(0, Math.floor((eMs - sMs) / 1000))
                      : 0;
                  return (
                    <div
                      key={wp.id}
                      className="flex items-center justify-between bg-white/70 px-2 py-1 rounded border border-[#efe2ca]"
                    >
                      <span>
                        <strong>{wp.reason}</strong> ·{" "}
                        {new Date(wp.started_at).toLocaleDateString("pt-PT")} →{" "}
                        {wp.ended_at
                          ? new Date(wp.ended_at).toLocaleDateString("pt-PT")
                          : "em curso"}
                      </span>
                      <span className="font-mono font-bold text-[#7a5414]">
                        {formatDaysAndHours(diffSec)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Painel Dedicado de Tempo de Trabalho Acumulado na Tarefa */}
      <div className="v6-field full">
        <div className="rounded-xl border border-[#e5d8d0] bg-[#faf6f2] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <span className="text-xs font-bold text-[#59083e] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#92006f]" />
              Tempo Acumulado na Tarefa (Trabalho Efetivo)
            </span>
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-[#59083e] text-[#e9c885]">
              Atual: {formatSeconds(totalWorkSec)}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="block text-[11px] font-semibold text-[#6d5d66] mb-1">
                Horas (h)
              </span>
              <input
                type="number"
                min={0}
                placeholder="0"
                value={form.duration_hours}
                onChange={(e) =>
                  onChange({
                    ...form,
                    duration_hours: Math.max(0, parseInt(e.target.value, 10) || 0),
                  })
                }
                className="bg-white! font-mono font-bold text-center"
              />
            </div>
            <div>
              <span className="block text-[11px] font-semibold text-[#6d5d66] mb-1">
                Minutos (min)
              </span>
              <input
                type="number"
                min={0}
                max={59}
                placeholder="0"
                value={form.duration_minutes}
                onChange={(e) =>
                  onChange({
                    ...form,
                    duration_minutes: Math.min(
                      59,
                      Math.max(0, parseInt(e.target.value, 10) || 0)
                    ),
                  })
                }
                className="bg-white! font-mono font-bold text-center"
              />
            </div>
            <div>
              <span className="block text-[11px] font-semibold text-[#6d5d66] mb-1">
                Segundos (seg)
              </span>
              <input
                type="number"
                min={0}
                max={59}
                placeholder="0"
                value={form.duration_seconds}
                onChange={(e) =>
                  onChange({
                    ...form,
                    duration_seconds: Math.min(
                      59,
                      Math.max(0, parseInt(e.target.value, 10) || 0)
                    ),
                  })
                }
                className="bg-white! font-mono font-bold text-center"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-[#ece2dc]">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-[#736872] mr-1">
                Adicionar rápido:
              </span>
              {[
                { label: "+15m", sec: 900 },
                { label: "+30m", sec: 1800 },
                { label: "+1h", sec: 3600 },
              ].map((b) => (
                <button
                  key={b.label}
                  type="button"
                  className="v6-btn sm"
                  onClick={() => {
                    const cur = totalWorkSec + b.sec;
                    onChange({
                      ...form,
                      duration_hours: Math.floor(cur / 3600),
                      duration_minutes: Math.floor((cur % 3600) / 60),
                      duration_seconds: cur % 60,
                    });
                  }}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="v6-btn sm danger"
              onClick={() =>
                onChange({
                  ...form,
                  duration_hours: 0,
                  duration_minutes: 0,
                  duration_seconds: 0,
                })
              }
            >
              Zerar tempo
            </button>
          </div>
        </div>
      </div>

      {/* Observações / Notas Forenses */}
      <div className="v6-field full">
        <label>Observações / Notas Forenses</label>
        <textarea
          placeholder="Registe observações, próximos passos ou informações relevantes..."
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
        />
      </div>
    </div>
  );
}

