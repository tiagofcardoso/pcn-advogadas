"use client";

import React, { useState, useEffect } from "react";
import {
  Client,
  FeeNoteClientMeta,
  FeeNoteCustomLine,
  ServiceCategory,
  Task,
} from "@/lib/types";
import {
  formatCurrencyPt,
  formatIsoDatePt,
  getTaskV6Status,
  openEditorialFeeNotePdf,
} from "@/lib/v6Helpers";
import {
  Download,
  FileSpreadsheet,
  Plus,
  Sparkles,
  Trash2,
  Edit3,
  Check,
  X,
} from "lucide-react";

interface FeeNotesV6TabProps {
  clients: Client[];
  tasks: Task[];
  serviceCategories: ServiceCategory[];
  selectedFeeClient: string;
  setSelectedFeeClient: (clientId: string) => void;
  feeTaskPrices: Record<string, number>;
  setFeeTaskPrices: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  feeNotesByClient: Record<string, any>;
  calculateTaskFeeByCategory: (task: Task, rounding?: 0 | 6 | 15) => number;
  billingRoundingMinutes: 0 | 6 | 15;
  updateBillingRounding: (mins: 0 | 6 | 15) => void;
  saveFeeNoteToDb: (
    clientId?: string,
    overridePrices?: Record<string, number>,
    overrideWithholding?: boolean,
    silent?: boolean
  ) => Promise<any>;
  handleExportExcel: (internal: boolean) => Promise<void>;
  isExportingExcel: boolean;
  onSwitchTab: (tab: any) => void;
  onAudit?: (action: string, area: string, detail: string) => void;
  onFeedback?: (msg: string) => void;
}

export default function FeeNotesV6Tab({
  clients,
  tasks,
  serviceCategories,
  selectedFeeClient,
  setSelectedFeeClient,
  feeTaskPrices,
  setFeeTaskPrices,
  feeNotesByClient,
  calculateTaskFeeByCategory,
  billingRoundingMinutes,
  updateBillingRounding,
  saveFeeNoteToDb,
  handleExportExcel,
  isExportingExcel,
  onSwitchTab,
  onAudit,
  onFeedback,
}: FeeNotesV6TabProps) {
  const activeClient =
    clients.find((c) => c.id === selectedFeeClient) || clients[0];
  const clientId = activeClient?.id || "";

  const [linesByClient, setLinesByClient] = useState<
    Record<string, FeeNoteCustomLine[]>
  >({});
  const [metaByClient, setMetaByClient] = useState<
    Record<string, FeeNoteClientMeta>
  >({});

  const [isLineModalOpen, setIsLineModalOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<FeeNoteCustomLine | null>(null);
  const [lineForm, setLineForm] = useState<{
    date: string;
    description: string;
    hours: string;
    documented_expenses: number;
    undocumented_expenses: number;
    fees: number;
  }>({
    date: new Date().toISOString().slice(0, 10),
    description: "",
    hours: "",
    documented_expenses: 0,
    undocumented_expenses: 0,
    fees: 0,
  });

  // Load saved custom lines & meta from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawLines = localStorage.getItem("pcn_v6_feenote_lines");
      if (rawLines) setLinesByClient(JSON.parse(rawLines));
      const rawMeta = localStorage.getItem("pcn_v6_feenote_meta");
      if (rawMeta) setMetaByClient(JSON.parse(rawMeta));
    } catch {}
  }, []);

  const persistLines = (next: Record<string, FeeNoteCustomLine[]>) => {
    setLinesByClient(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("pcn_v6_feenote_lines", JSON.stringify(next));
      } catch {}
    }
  };

  const persistMeta = (next: Record<string, FeeNoteClientMeta>) => {
    setMetaByClient(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("pcn_v6_feenote_meta", JSON.stringify(next));
      } catch {}
    }
  };

  const clientTasks = tasks.filter(
    (t) => t.client_id === clientId && t.status !== "archived"
  );

  // Build effective lines for this client: if not initialized yet, seed from client's tasks
  const currentLines: FeeNoteCustomLine[] = React.useMemo(() => {
    if (linesByClient[clientId] && linesByClient[clientId].length > 0) {
      return linesByClient[clientId];
    }
    return clientTasks.map((t) => {
      const suggested = calculateTaskFeeByCategory(t, billingRoundingMinutes);
      const feeVal =
        feeTaskPrices[t.id] !== undefined
          ? feeTaskPrices[t.id]
          : t.fee_amount ?? suggested;
      const hoursVal =
        t.total_duration_seconds > 0
          ? `${(t.total_duration_seconds / 3600).toFixed(2)} h`
          : "";
      return {
        id: `ln_${t.id}`,
        task_id: t.id,
        date: t.due_date || new Date().toISOString().slice(0, 10),
        description: t.description ? `${t.title} — ${t.description}` : t.title,
        hours: hoursVal,
        documented_expenses: t.documented_expenses || 0,
        undocumented_expenses: t.undocumented_expenses || 0,
        fees: Number.isFinite(feeVal) ? feeVal : 0,
      };
    });
  }, [
    linesByClient,
    clientId,
    clientTasks,
    feeTaskPrices,
    billingRoundingMinutes,
    calculateTaskFeeByCategory,
  ]);

  const currentMeta: FeeNoteClientMeta = metaByClient[clientId] || {
    subject:
      activeClient?.process_reference ||
      "Registos, contratos e acompanhamento jurídico",
    period: "Setembro — Outubro de 2026",
    provisions_received: 0,
    credits_payments: 0,
    apply_vat: true,
  };

  const updateMetaField = (patch: Partial<FeeNoteClientMeta>) => {
    const next = {
      ...metaByClient,
      [clientId]: { ...currentMeta, ...patch },
    };
    persistMeta(next);
  };

  const updateLineInline = (
    lineId: string,
    patch: Partial<FeeNoteCustomLine>
  ) => {
    const nextList = currentLines.map((l) =>
      l.id === lineId ? { ...l, ...patch } : l
    );
    persistLines({ ...linesByClient, [clientId]: nextList });

    const target = nextList.find((l) => l.id === lineId);
    if (target?.task_id && patch.fees !== undefined) {
      const nextPrices = { ...feeTaskPrices, [target.task_id]: patch.fees };
      setFeeTaskPrices(nextPrices);
      saveFeeNoteToDb(clientId, nextPrices, true, true).catch(() => {});
    }
  };

  const openAddLineModal = () => {
    setEditingLine(null);
    setLineForm({
      date: new Date().toISOString().slice(0, 10),
      description: "",
      hours: "",
      documented_expenses: 0,
      undocumented_expenses: 0,
      fees: 0,
    });
    setIsLineModalOpen(true);
  };

  const openEditLineModal = (line: FeeNoteCustomLine) => {
    setEditingLine(line);
    setLineForm({
      date: line.date,
      description: line.description,
      hours: line.hours || "",
      documented_expenses: line.documented_expenses || 0,
      undocumented_expenses: line.undocumented_expenses || 0,
      fees: line.fees || 0,
    });
    setIsLineModalOpen(true);
  };

  const handleSaveLine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lineForm.description.trim()) return;
    if (editingLine) {
      const nextList = currentLines.map((l) =>
        l.id === editingLine.id
          ? {
              ...l,
              date: lineForm.date,
              description: lineForm.description.trim(),
              hours: lineForm.hours.trim(),
              documented_expenses: Number(lineForm.documented_expenses) || 0,
              undocumented_expenses: Number(lineForm.undocumented_expenses) || 0,
              fees: Number(lineForm.fees) || 0,
            }
          : l
      );
      persistLines({ ...linesByClient, [clientId]: nextList });
      onAudit?.("Alterou linha", "Notas de Honorários", lineForm.description);
    } else {
      const newLine: FeeNoteCustomLine = {
        id: `ln_${Date.now()}`,
        date: lineForm.date,
        description: lineForm.description.trim(),
        hours: lineForm.hours.trim(),
        documented_expenses: Number(lineForm.documented_expenses) || 0,
        undocumented_expenses: Number(lineForm.undocumented_expenses) || 0,
        fees: Number(lineForm.fees) || 0,
      };
      persistLines({
        ...linesByClient,
        [clientId]: [...currentLines, newLine],
      });
      onAudit?.("Criou linha", "Notas de Honorários", newLine.description);
    }
    setIsLineModalOpen(false);
    setEditingLine(null);
  };

  const handleRemoveLine = (lineId: string) => {
    const nextList = currentLines.filter((l) => l.id !== lineId);
    persistLines({ ...linesByClient, [clientId]: nextList });
  };

  const handleAddTaskToNote = (t: Task) => {
    const suggested = calculateTaskFeeByCategory(t, billingRoundingMinutes);
    const feeVal =
      feeTaskPrices[t.id] !== undefined
        ? feeTaskPrices[t.id]
        : t.fee_amount ?? suggested;
    const newLine: FeeNoteCustomLine = {
      id: `ln_${t.id}_${Date.now()}`,
      task_id: t.id,
      date: t.due_date || new Date().toISOString().slice(0, 10),
      description: t.description ? `${t.title} — ${t.description}` : t.title,
      hours:
        t.total_duration_seconds > 0
          ? `${(t.total_duration_seconds / 3600).toFixed(2)} h`
          : "",
      documented_expenses: t.documented_expenses || 0,
      undocumented_expenses: t.undocumented_expenses || 0,
      fees: Number.isFinite(feeVal) ? feeVal : 0,
    };
    persistLines({
      ...linesByClient,
      [clientId]: [...currentLines, newLine],
    });
    onAudit?.("Incluiu serviço", "Notas de Honorários", t.title);
    onFeedback?.(`Serviço "${t.title}" adicionado à Nota de Honorários.`);
  };

  const handleCalculateAllByCategory = () => {
    const nextPrices = { ...feeTaskPrices };
    const updatedLines = currentLines.map((l) => {
      if (!l.task_id) return l;
      const matchedTask = tasks.find((t) => t.id === l.task_id);
      if (!matchedTask) return l;
      const calc = calculateTaskFeeByCategory(
        matchedTask,
        billingRoundingMinutes
      );
      nextPrices[matchedTask.id] = calc;
      return { ...l, fees: calc };
    });
    setFeeTaskPrices(nextPrices);
    persistLines({ ...linesByClient, [clientId]: updatedLines });
    saveFeeNoteToDb(clientId, nextPrices, true, false).catch(() => {});
    onFeedback?.(
      "Honorários calculados automaticamente segundo a Tabela de Serviços (€/h por categoria)!"
    );
  };

  // Financial Totals (matching PCN_Nota_Honorarios_Editorial_V3-3.pdf)
  const totalDocExpenses = currentLines.reduce(
    (acc, l) => acc + (Number(l.documented_expenses) || 0),
    0
  );
  const totalUndocExpenses = currentLines.reduce(
    (acc, l) => acc + (Number(l.undocumented_expenses) || 0),
    0
  );
  const totalFees = currentLines.reduce(
    (acc, l) => acc + (Number(l.fees) || 0),
    0
  );
  const baseBeforeVat = totalFees + totalDocExpenses + totalUndocExpenses;
  const vatAmount = currentMeta.apply_vat
    ? Math.round(totalFees * 0.23 * 100) / 100
    : 0;
  const subtotalWithVat = Math.round((baseBeforeVat + vatAmount) * 100) / 100;
  const provisions = Math.max(0, Number(currentMeta.provisions_received) || 0);
  const credits = Math.max(0, Number(currentMeta.credits_payments) || 0);
  const finalBalance =
    Math.round((subtotalWithVat - provisions - credits) * 100) / 100;

  const savedClientNote = feeNotesByClient[clientId];
  const refCode = savedClientNote?.reference_code
    ? savedClientNote.reference_code.replace(/-/g, "/")
    : "NH/2026/001";
  const issueDatePt = formatIsoDatePt(new Date().toISOString().slice(0, 10));

  const availableTasksNotInNote = clientTasks.filter(
    (t) => !currentLines.some((l) => l.task_id === t.id)
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-serif-v6 text-[31px] text-[#28202a] leading-tight">
            Notas de Honorários
          </h1>
          <p className="text-[#6e6569] text-sm mt-0.5">
            Área reservada à Direção · Modelo Editorial V3 (Honorários, Despesas
            Documentadas, Despesas Não Documentadas e Apuramento)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={openAddLineModal}
            className="v6-btn gold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Linha livre</span>
          </button>

          <button
            type="button"
            onClick={handleCalculateAllByCategory}
            className="v6-btn"
            title="Converte automaticamente o tempo gasto em cada tarefa pelo valor €/h da Categoria"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#966c2d]" />
            <span>Calcular pela Categoria (€/h)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!activeClient) return;
              openEditorialFeeNotePdf({
                refCode,
                issueDatePt,
                client: activeClient,
                meta: currentMeta,
                lines: currentLines,
              });
            }}
            disabled={!activeClient || currentLines.length === 0}
            className="v6-btn primary"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Emitir PDF Oficial (A4 Editorial V3)</span>
          </button>

          <button
            type="button"
            onClick={() => handleExportExcel(false)}
            disabled={isExportingExcel || currentLines.length === 0}
            className="v6-btn"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#92006F]" />
            <span>{isExportingExcel ? "A exportar..." : "Excel (Cliente)"}</span>
          </button>
        </div>
      </div>

      {/* Editorial Document Header Preview Card */}
      <div className="v6-card space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#e9e0dd]">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-xs text-[#6d5d66] flex items-center gap-2">
              <strong className="text-[#28202a]">Cliente:</strong>
              <select
                value={clientId}
                onChange={(e) => setSelectedFeeClient(e.target.value)}
                className="border border-[#dfd6d6] rounded-[7px] px-3 py-2 bg-white text-[#28202a] font-semibold text-xs"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.number ? `· PCN ${c.number}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <span className="text-xs text-[#776f73]">
              Ref.ª: <strong className="text-[#59083e]">{refCode}</strong>
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => onSwitchTab("services")}
              className="text-[#92006f] hover:underline font-semibold cursor-pointer"
            >
              Tabela de Serviços ({serviceCategories.length} categorias €/h) →
            </button>
          </div>
        </div>

        {/* Cream Metadata Box matching PDF Page 1 */}
        <div className="bg-[#F7F6F0] border border-[#E5DEC9] rounded-md p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-2.5">
            <div>
              <span className="font-serif-v6 text-[10px] font-bold text-[#59083E] uppercase tracking-wider block">
                CLIENTE
              </span>
              <p className="text-sm font-semibold text-[#28202a] mt-0.5">
                {activeClient?.name}{" "}
                {activeClient?.number
                  ? `— Cliente PCN ${activeClient.number}`
                  : ""}
              </p>
            </div>
            <div>
              <label className="font-serif-v6 text-[10px] font-bold text-[#59083E] uppercase tracking-wider block mb-1">
                ASSUNTO
              </label>
              <input
                type="text"
                value={currentMeta.subject}
                onChange={(e) => updateMetaField({ subject: e.target.value })}
                placeholder="Registos, contratos e acompanhamento jurídico"
                className="w-full bg-white border border-[#dfd6d6] rounded px-2.5 py-1.5 text-xs text-[#28202a]"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            <div>
              <span className="font-serif-v6 text-[10px] font-bold text-[#59083E] uppercase tracking-wider block">
                DATA DE EMISSÃO
              </span>
              <p className="text-sm font-semibold text-[#28202a] mt-0.5">
                {issueDatePt}
              </p>
            </div>
            <div>
              <label className="font-serif-v6 text-[10px] font-bold text-[#59083E] uppercase tracking-wider block mb-1">
                PERÍODO
              </label>
              <input
                type="text"
                value={currentMeta.period}
                onChange={(e) => updateMetaField({ period: e.target.value })}
                placeholder="Setembro — Outubro de 2026"
                className="w-full bg-white border border-[#dfd6d6] rounded px-2.5 py-1.5 text-xs text-[#28202a]"
              />
            </div>
          </div>
        </div>

        <p className="text-xs text-[#776f73]">
          As horas são apresentadas por defeito. Pode alterá-las, ocultá-las, ou
          deixar apenas a descrição, despesas e honorários. O registo original da
          tarefa não é modificado.
        </p>

        {/* 5-Column Table matching PCN_Nota_Honorarios_Editorial_V3-3.pdf */}
        <div className="overflow-x-auto border border-[#E5DEC9] rounded-md">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#59083E] text-white font-serif-v6 text-[11px] uppercase tracking-wider">
                <th className="py-3 px-3 w-28">DATA</th>
                <th className="py-3 px-3">DESCRIÇÃO DA TAREFA</th>
                <th className="py-3 px-3 text-right w-36">
                  DESPESAS DOCUMENTADAS (€)
                </th>
                <th className="py-3 px-3 text-right w-40">
                  DESPESAS NÃO DOCUMENTADAS (€)
                </th>
                <th className="py-3 px-3 text-right w-36">HONORÁRIOS (€)</th>
                <th className="py-3 px-3 text-right w-24">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EBE5DC]">
              {currentLines.map((line, idx) => (
                <tr
                  key={line.id}
                  className={idx % 2 === 1 ? "bg-[#FAF8F5]" : "bg-white"}
                >
                  <td className="py-2.5 px-3 whitespace-nowrap text-[#28202a]">
                    {formatIsoDatePt(line.date)}
                  </td>
                  <td className="py-2.5 px-3 text-[#28202a]">
                    <div className="font-medium">{line.description}</div>
                    {line.hours && (
                      <span className="text-[11px] text-[#776f73]">
                        Tempo: {line.hours}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.documented_expenses}
                      onChange={(e) =>
                        updateLineInline(line.id, {
                          documented_expenses: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-24 text-right bg-white border border-[#dfd6d6] rounded px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.undocumented_expenses}
                      onChange={(e) =>
                        updateLineInline(line.id, {
                          undocumented_expenses:
                            parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-24 text-right bg-white border border-[#dfd6d6] rounded px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.fees}
                      onChange={(e) =>
                        updateLineInline(line.id, {
                          fees: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-28 text-right font-bold text-[#59083e] bg-white border border-[#dfd6d6] rounded px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditLineModal(line)}
                        className="v6-btn py-1 px-2 text-xs"
                        title="Editar linha"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(line.id)}
                        className="v6-btn danger py-1 px-2 text-xs"
                        title="Retirar linha"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {currentLines.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-xs text-[#776f73] italic"
                  >
                    Nenhuma linha incluída nesta Nota de Honorários. Adicione uma
                    linha livre ou selecione tarefas abaixo.
                  </td>
                </tr>
              )}

              {/* SUBTOTAL (VALORES SEM IVA) row matching PDF */}
              <tr className="bg-[#F3EFE6] border-t-2 border-[#C5A467] font-serif-v6 font-bold text-[#59083E] text-xs">
                <td colSpan={2} className="py-3 px-3">
                  SUBTOTAL (VALORES SEM IVA)
                </td>
                <td className="py-3 px-3 text-right">
                  {formatCurrencyPt(totalDocExpenses)}
                </td>
                <td className="py-3 px-3 text-right">
                  {formatCurrencyPt(totalUndocExpenses)}
                </td>
                <td className="py-3 px-3 text-right">
                  {formatCurrencyPt(totalFees)}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        {/* APURAMENTO Block matching Page 2 of PCN_Nota_Honorarios_Editorial_V3-3.pdf */}
        <div className="pt-3 flex flex-col md:flex-row justify-between items-start gap-6">
          <div className="text-xs text-[#6e6569] space-y-2 max-w-md">
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-[#28202a]">
              <input
                type="checkbox"
                checked={currentMeta.apply_vat}
                onChange={(e) =>
                  updateMetaField({ apply_vat: e.target.checked })
                }
                className="rounded border-[#dfd6d6] text-[#92006f]"
              />
              <span>Incluir IVA (23% — simulação) no Apuramento</span>
            </label>
            <p className="text-[11px] text-[#776f73]">
              O documento PDF A4 reproduz fielmente o layout editorial PCN
              Advogadas com cabeçalho dourado, tabela de 5 colunas, quadro de{" "}
              <strong>APURAMENTO</strong> e assinatura de{" "}
              <strong>Patrícia da Costa Neto</strong>.
            </p>
          </div>

          <div className="w-full md:w-96 border border-[#E5DEC9] rounded-lg p-4 bg-white space-y-2 text-xs">
            <div className="font-serif-v6 text-xs font-bold text-[#59083E] uppercase tracking-wider pb-1.5 border-b-2 border-[#C5A467]">
              APURAMENTO
            </div>

            <div className="flex justify-between py-0.5">
              <span className="text-[#50454b]">Honorários</span>
              <span className="font-medium text-[#28202a]">
                {formatCurrencyPt(totalFees)}
              </span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-[#50454b]">Despesas documentadas</span>
              <span className="font-medium text-[#28202a]">
                {formatCurrencyPt(totalDocExpenses)}
              </span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-[#50454b]">Despesas não documentadas</span>
              <span className="font-medium text-[#28202a]">
                {formatCurrencyPt(totalUndocExpenses)}
              </span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-[#50454b]">
                IVA ({currentMeta.apply_vat ? "23% — simulação" : "0%"})
              </span>
              <span className="font-medium text-[#28202a]">
                {formatCurrencyPt(vatAmount)}
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-t border-[#EBE5DC] font-bold text-[#28202a]">
              <span>Subtotal</span>
              <span>{formatCurrencyPt(subtotalWithVat)}</span>
            </div>

            <div className="flex items-center justify-between gap-2 py-0.5">
              <span className="text-[#50454b]">
                Provisões recebidas (a deduzir)
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[#9d2842] font-bold">-</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={currentMeta.provisions_received}
                  onChange={(e) =>
                    updateMetaField({
                      provisions_received: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-24 text-right border border-[#dfd6d6] rounded px-2 py-1 text-xs"
                />
                <span>€</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 py-0.5">
              <span className="text-[#50454b]">
                Créditos / pagamentos adicionais
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[#9d2842] font-bold">-</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={currentMeta.credits_payments}
                  onChange={(e) =>
                    updateMetaField({
                      credits_payments: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-24 text-right border border-[#dfd6d6] rounded px-2 py-1 text-xs"
                />
                <span>€</span>
              </div>
            </div>

            <div className="h-[1.5px] bg-[#C5A467] my-1.5" />

            <div className="bg-[#F3EFE6] px-3 py-2.5 rounded flex justify-between items-center font-serif-v6 text-sm font-bold text-[#59083E]">
              <span>SALDO FINAL</span>
              <span>{formatCurrencyPt(finalBalance)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* V6 Section: Serviços disponíveis do cliente para adicionar */}
      {availableTasksNotInNote.length > 0 && (
        <div className="v6-card space-y-3">
          <h2 className="font-serif-v6 text-lg text-[#28202a] m-0">
            Serviços do cliente disponíveis para adicionar
          </h2>
          <div className="divide-y divide-[#f0eae6]">
            {availableTasksNotInNote.map((t) => (
              <div
                key={t.id}
                className="py-2.5 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <strong className="text-[#28202a]">{t.title}</strong>
                  <span className="text-[#776f73] ml-2">
                    · {getTaskV6Status(t)} ·{" "}
                    {(t.total_duration_seconds / 3600).toFixed(2)} h
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddTaskToNote(t)}
                  className="v6-btn py-1 px-3 text-xs"
                >
                  Adicionar à Nota
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Line */}
      {isLineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#160617]/55 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#e5d7d9] rounded-[14px] shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#f0eae6] pb-3">
              <h2 className="font-serif-v6 text-xl text-[#28202a] m-0">
                {editingLine
                  ? "Editar linha da Nota de Honorários"
                  : "Nova linha da Nota de Honorários"}
              </h2>
              <button
                type="button"
                onClick={() => setIsLineModalOpen(false)}
                className="text-[#776f73] hover:text-[#28202a]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLine} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-[#6d5d66]">
                  <span>Data *</span>
                  <input
                    type="date"
                    required
                    value={lineForm.date}
                    onChange={(e) =>
                      setLineForm({ ...lineForm, date: e.target.value })
                    }
                    className="border border-[#dfd6d6] rounded-[7px] p-2.5 bg-white text-[#28202a]"
                  />
                </label>

                <label className="flex flex-col gap-1 text-[#6d5d66]">
                  <span>Horas (opcional — pode ficar vazio)</span>
                  <input
                    type="text"
                    placeholder="Ex.: 1.50 h"
                    value={lineForm.hours}
                    onChange={(e) =>
                      setLineForm({ ...lineForm, hours: e.target.value })
                    }
                    className="border border-[#dfd6d6] rounded-[7px] p-2.5 bg-white text-[#28202a]"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1 text-[#6d5d66]">
                <span>Descrição da tarefa para o cliente *</span>
                <textarea
                  required
                  rows={3}
                  placeholder="Ex.: Pedido de certidão permanente e verificação dos elementos societários"
                  value={lineForm.description}
                  onChange={(e) =>
                    setLineForm({ ...lineForm, description: e.target.value })
                  }
                  className="border border-[#dfd6d6] rounded-[7px] p-2.5 bg-white text-[#28202a]"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex flex-col gap-1 text-[#6d5d66]">
                  <span>Despesas Documentadas (€)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={lineForm.documented_expenses}
                    onChange={(e) =>
                      setLineForm({
                        ...lineForm,
                        documented_expenses: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="border border-[#dfd6d6] rounded-[7px] p-2.5 bg-white text-[#28202a]"
                  />
                </label>

                <label className="flex flex-col gap-1 text-[#6d5d66]">
                  <span>Despesas Não Doc. (€)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={lineForm.undocumented_expenses}
                    onChange={(e) =>
                      setLineForm({
                        ...lineForm,
                        undocumented_expenses: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="border border-[#dfd6d6] rounded-[7px] p-2.5 bg-white text-[#28202a]"
                  />
                </label>

                <label className="flex flex-col gap-1 text-[#6d5d66]">
                  <span>Honorários (€) *</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={lineForm.fees}
                    onChange={(e) =>
                      setLineForm({
                        ...lineForm,
                        fees: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="border border-[#dfd6d6] rounded-[7px] p-2.5 bg-white font-bold text-[#59083e]"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#f0eae6]">
                <button
                  type="button"
                  onClick={() => setIsLineModalOpen(false)}
                  className="v6-btn"
                >
                  Cancelar
                </button>
                <button type="submit" className="v6-btn primary">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

