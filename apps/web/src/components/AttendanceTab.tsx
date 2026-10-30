"use client";

import React, { useState } from "react";
import { AttendanceRecord, UserProfile } from "@/lib/types";
import { exportAttendanceCsv, formatIsoDatePt } from "@/lib/v6Helpers";
import { Plus, Trash2, Download, Calendar, Edit3, X } from "lucide-react";

interface AttendanceTabProps {
  records: AttendanceRecord[];
  usersList: UserProfile[];
  onSaveRecord: (rec: AttendanceRecord, isEdit: boolean) => void;
  onDeleteRecord: (id: string) => void;
}

export default function AttendanceTab({
  records,
  usersList,
  onSaveRecord,
  onDeleteRecord,
}: AttendanceTabProps) {
  const collaborators = React.useMemo(() => {
    const lawyers = usersList.filter(
      (u) => u.role === "lawyer" || u.role === "admin_lawyer"
    );
    const defaultList = [
      { id: "usr_luana", name: "Luana de Sousa" },
      { id: "usr_ines", name: "Inês Ferreira de Oliveira" },
      { id: "usr_sofia", name: "Sofia" },
    ];
    const merged: { id: string; name: string }[] = [...defaultList];
    for (const l of lawyers) {
      if (l.id === "usr_patricia") continue;
      if (!merged.some((m) => m.id === l.id)) {
        merged.push({ id: l.id, name: l.name });
      }
    }
    return merged;
  }, [usersList]);

  const [selectedView, setSelectedView] = useState<string>("resumo_geral");
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(
    null
  );

  const [formState, setFormState] = useState<{
    collaborator_id: string;
    start_date: string;
    end_date: string;
    absence_type: "Férias" | "Outra falta" | "Atraso";
    reason: string;
    full_days: number;
    partial_hours: number;
  }>({
    collaborator_id: "usr_luana",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    absence_type: "Férias",
    reason: "",
    full_days: 1,
    partial_hours: 0,
  });

  const openNewModal = (defaultCollabId?: string) => {
    const cId =
      defaultCollabId && defaultCollabId !== "resumo_geral"
        ? defaultCollabId
        : collaborators[0]?.id || "usr_luana";
    setEditingRecord(null);
    setFormState({
      collaborator_id: cId,
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date().toISOString().slice(0, 10),
      absence_type: "Férias",
      reason: "",
      full_days: 1,
      partial_hours: 0,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (rec: AttendanceRecord) => {
    setEditingRecord(rec);
    setFormState({
      collaborator_id: rec.collaborator_id,
      start_date: rec.start_date,
      end_date: rec.end_date,
      absence_type: rec.absence_type,
      reason: rec.reason,
      full_days: rec.full_days,
      partial_hours: rec.partial_hours,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const collab = collaborators.find((c) => c.id === formState.collaborator_id);
    const payload: AttendanceRecord = {
      id: editingRecord ? editingRecord.id : `att_${Date.now()}`,
      collaborator_id: formState.collaborator_id,
      collaborator_name: collab?.name || "Colaboradora",
      start_date: formState.start_date,
      end_date: formState.end_date || formState.start_date,
      absence_type: formState.absence_type,
      reason: formState.reason.trim() || formState.absence_type,
      full_days: Math.max(0, Number(formState.full_days) || 0),
      partial_hours: Math.max(0, Number(formState.partial_hours) || 0),
    };
    onSaveRecord(payload, !!editingRecord);
    setIsModalOpen(false);
    setEditingRecord(null);
  };

  // Summary calculations across all collaborators
  const generalStats = collaborators.map((c) => {
    const cRecs = records.filter(
      (r) =>
        r.collaborator_id === c.id &&
        (!selectedYear || r.start_date.startsWith(String(selectedYear)))
    );
    const feriasH = cRecs
      .filter((r) => r.absence_type === "Férias")
      .reduce(
        (acc, r) => acc + (Number(r.full_days) || 0) * 8 + (Number(r.partial_hours) || 0),
        0
      );
    const outrasH = cRecs
      .filter((r) => r.absence_type !== "Férias")
      .reduce(
        (acc, r) => acc + (Number(r.full_days) || 0) * 8 + (Number(r.partial_hours) || 0),
        0
      );
    const totalH = feriasH + outrasH;
    const equivDays = totalH / 8;
    return {
      ...c,
      records: cRecs,
      feriasH,
      outrasH,
      totalH,
      equivDays,
    };
  });

  const allTotals = generalStats.map((s) => s.totalH);
  const minTotalH = allTotals.length > 0 ? Math.min(...allTotals) : 0;
  const maxTotalH = allTotals.length > 0 ? Math.max(...allTotals) : 0;

  const activeCollab = collaborators.find((c) => c.id === selectedView);
  const activeCollabStats = generalStats.find((s) => s.id === selectedView);

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-serif-v6 text-[31px] text-[#28202a] leading-tight">
            Gestão de Assiduidade
          </h1>
          <p className="text-[#6e6569] text-sm mt-0.5">
            Mapa de assiduidade das colaboradoras PCN · Horário diário de referência: 8 horas
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-xs border border-[#dfd6d6] rounded-[7px] px-3 py-2 bg-white text-[#28202a]"
          >
            <option value={2026}>Ano 2026</option>
            <option value={2025}>Ano 2025</option>
          </select>

          <button
            type="button"
            onClick={() => exportAttendanceCsv(records, collaborators)}
            className="v6-btn gold"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Mapa (.CSV / Excel)</span>
          </button>

          <button
            type="button"
            onClick={() => openNewModal(selectedView)}
            className="v6-btn primary"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Registar Ausência / Férias</span>
          </button>
        </div>
      </div>

      {/* Sheet Selector Pills (Matching the 4 tabs of the Excel workbook) */}
      <div className="flex items-center gap-2 flex-wrap border-b border-[#e9e0dd] pb-3">
        <button
          type="button"
          onClick={() => setSelectedView("resumo_geral")}
          className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            selectedView === "resumo_geral"
              ? "bg-[#59083e] text-white shadow-xs"
              : "bg-white text-[#50454b] border border-[#e1d5d9] hover:border-[#c5a467]"
          }`}
        >
          📊 Resumo Geral de Assiduidade
        </button>

        {collaborators.map((c, idx) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedView(c.id)}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              selectedView === c.id
                ? "bg-[#59083e] text-white shadow-xs"
                : "bg-white text-[#50454b] border border-[#e1d5d9] hover:border-[#c5a467]"
            }`}
          >
            👤 Colaboradora {idx + 1}: {c.name}
          </button>
        ))}
      </div>

      {/* VIEW 1: RESUMO GERAL DE ASSIDUIDADE (Sheet 4 of Excel) */}
      {selectedView === "resumo_geral" && (
        <div className="space-y-5">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {generalStats.map((s) => {
              const isMostAssiduous = s.totalH === minTotalH;
              const isLeastAssiduous = s.totalH === maxTotalH && maxTotalH > minTotalH;
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedView(s.id)}
                  className="v6-card cursor-pointer hover:border-[#c5a467] transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-[#776f73] uppercase tracking-wider">
                        Colaboradora
                      </p>
                      <h3 className="font-serif-v6 text-lg text-[#28202a] mt-0.5">
                        {s.name}
                      </h3>
                    </div>
                    <span
                      className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                      style={{
                        backgroundColor: isMostAssiduous
                          ? "#D9EAD3"
                          : isLeastAssiduous
                          ? "#F4CCCC"
                          : "#FFF2CC",
                        color: isMostAssiduous
                          ? "#274E13"
                          : isLeastAssiduous
                          ? "#781F19"
                          : "#7F6000",
                      }}
                    >
                      {isMostAssiduous
                        ? "Mais assídua"
                        : isLeastAssiduous
                        ? "Menos assídua"
                        : "Intermédia"}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#f0eae6] grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-[#776f73] block text-[11px]">Férias</span>
                      <strong className="text-[#28202a] text-sm">{s.feriasH} h</strong>
                    </div>
                    <div>
                      <span className="text-[#776f73] block text-[11px]">Outras faltas</span>
                      <strong className="text-[#28202a] text-sm">{s.outrasH} h</strong>
                    </div>
                    <div>
                      <span className="text-[#776f73] block text-[11px]">Equiv. (8h)</span>
                      <strong className="text-[#59083e] text-sm">
                        {s.equivDays.toFixed(2).replace(".", ",")} d
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Comparative Table matching Sheet "Resumo Geral" */}
          <div className="v6-card p-0 overflow-hidden">
            <div className="bg-[#59083E] text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h2 className="font-serif-v6 text-base font-bold tracking-wide text-white m-0">
                  PCN ADVOGADAS — RESUMO GERAL DE ASSIDUIDADE ({selectedYear})
                </h2>
                <p className="text-[11px] text-[#e6d4e0] mt-0.5">
                  Comparação automática de horas de férias, outras faltas e indicador de assiduidade
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[#EAD1DC] text-[#28202a] font-bold border-b border-[#d8c3cd]">
                    <th className="py-3 px-4">Colaboradora</th>
                    <th className="py-3 px-4 text-center">Férias (h)</th>
                    <th className="py-3 px-4 text-center">Outras faltas (h)</th>
                    <th className="py-3 px-4 text-center">Total ausências (h)</th>
                    <th className="py-3 px-4 text-center">Equiv. dias (8h)</th>
                    <th className="py-3 px-4 text-center">Assiduidade</th>
                    <th className="py-3 px-4 text-right">Ficha Individual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0eae6]">
                  {generalStats.map((s) => {
                    const isMostAssiduous = s.totalH === minTotalH;
                    const isLeastAssiduous =
                      s.totalH === maxTotalH && maxTotalH > minTotalH;
                    const label = isMostAssiduous
                      ? "Mais assídua"
                      : isLeastAssiduous
                      ? "Menos assídua"
                      : "Intermédia";

                    return (
                      <tr key={s.id} className="hover:bg-[#fdfbf9]">
                        <td className="py-3 px-4 font-bold text-[#28202a]">
                          {s.name}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {s.feriasH.toFixed(1).replace(".", ",")}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {s.outrasH.toFixed(1).replace(".", ",")}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-[#59083e]">
                          {s.totalH.toFixed(1).replace(".", ",")}
                        </td>
                        <td className="py-3 px-4 text-center font-semibold">
                          {s.equivDays.toFixed(2).replace(".", ",")}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className="inline-block px-3 py-1 rounded-full text-xs font-bold"
                            style={{
                              backgroundColor: isMostAssiduous
                                ? "#D9EAD3"
                                : isLeastAssiduous
                                ? "#F4CCCC"
                                : "#FFF2CC",
                              color: isMostAssiduous
                                ? "#274E13"
                                : isLeastAssiduous
                                ? "#781F19"
                                : "#7F6000",
                            }}
                          >
                            {label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedView(s.id)}
                            className="v6-btn text-xs py-1 px-2.5"
                          >
                            Ver Mapa Individual →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: INDIVIDUAL COLLABORATOR SHEET (Matching Colaboradora 1, 2, 3 sheets) */}
      {selectedView !== "resumo_geral" && activeCollab && activeCollabStats && (
        <div className="space-y-5">
          {/* Individual Header Banner matching Excel rows 1-4 */}
          <div className="v6-card p-0 overflow-hidden">
            <div className="bg-[#59083E] text-white px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="font-serif-v6 text-base font-bold tracking-wide text-white m-0">
                PCN ADVOGADAS — REGISTO DE ASSIDUIDADE
              </h2>
              <span className="text-xs text-[#e9c885] font-semibold">
                Horário diário de referência: 8 horas
              </span>
            </div>

            <div className="p-4 bg-[#faf8f6] border-b border-[#e9e0dd] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="font-bold text-[#6d5d66]">Colaboradora: </span>
                <strong className="text-[#28202a] text-sm">
                  {activeCollab.name}
                </strong>
              </div>
              <div>
                <span className="font-bold text-[#6d5d66]">Função: </span>
                <strong className="text-[#28202a]">Advogada</strong>
              </div>
              <div>
                <span className="font-bold text-[#6d5d66]">Ano: </span>
                <strong className="text-[#28202a]">{selectedYear}</strong>
              </div>
            </div>

            {/* Absence Records Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[#EAD1DC] text-[#28202a] font-bold border-b border-[#d8c3cd]">
                    <th className="py-3 px-3.5">Data início</th>
                    <th className="py-3 px-3.5">Data fim</th>
                    <th className="py-3 px-3.5">Tipo de ausência</th>
                    <th className="py-3 px-3.5">Descrição / Motivo</th>
                    <th className="py-3 px-3.5 text-center">Dias completos</th>
                    <th className="py-3 px-3.5 text-center">Horas parciais</th>
                    <th className="py-3 px-3.5 text-center">Total horas</th>
                    <th className="py-3 px-3.5 text-center">Equiv. dias (8h)</th>
                    <th className="py-3 px-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0eae6]">
                  {activeCollabStats.records.map((rec) => {
                    const totalH =
                      (Number(rec.full_days) || 0) * 8 +
                      (Number(rec.partial_hours) || 0);
                    const equivD = totalH / 8;
                    return (
                      <tr key={rec.id} className="hover:bg-[#fdfbf9]">
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          {formatIsoDatePt(rec.start_date)}
                        </td>
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          {formatIsoDatePt(rec.end_date)}
                        </td>
                        <td className="py-2.5 px-3.5">
                          <span
                            className={`v6-badge ${
                              rec.absence_type === "Férias"
                                ? "start"
                                : rec.absence_type === "Atraso"
                                ? "wait"
                                : ""
                            }`}
                          >
                            {rec.absence_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 text-[#28202a]">
                          {rec.reason}
                        </td>
                        <td className="py-2.5 px-3.5 text-center">
                          {rec.full_days}
                        </td>
                        <td className="py-2.5 px-3.5 text-center">
                          {rec.partial_hours}
                        </td>
                        <td className="py-2.5 px-3.5 text-center font-bold text-[#59083e]">
                          {totalH.toFixed(1).replace(".", ",")}
                        </td>
                        <td className="py-2.5 px-3.5 text-center font-semibold">
                          {equivD.toFixed(2).replace(".", ",")}
                        </td>
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(rec)}
                              className="v6-btn py-1 px-2 text-xs"
                              title="Editar registo"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteRecord(rec.id)}
                              className="v6-btn danger py-1 px-2 text-xs"
                              title="Eliminar registo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {activeCollabStats.records.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-8 text-center text-xs text-[#776f73] italic"
                      >
                        Nenhuma ausência ou período de férias registado para esta
                        colaboradora.
                      </td>
                    </tr>
                  )}

                  {/* Row 24 TOTAL row matching Excel */}
                  <tr className="bg-[#F3EFE6] font-bold text-[#28202a] border-t-2 border-[#c5a467]">
                    <td colSpan={4} className="py-3 px-3.5">
                      TOTAL
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      {activeCollabStats.records.reduce(
                        (a, r) => a + (Number(r.full_days) || 0),
                        0
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-center">
                      {activeCollabStats.records.reduce(
                        (a, r) => a + (Number(r.partial_hours) || 0),
                        0
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-center text-[#59083e]">
                      {activeCollabStats.totalH.toFixed(1).replace(".", ",")}
                    </td>
                    <td className="py-3 px-3.5 text-center text-[#59083e]">
                      {activeCollabStats.equivDays.toFixed(2).replace(".", ",")}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Individual RESUMO DE ASSIDUIDADE block (Rows 26-30 of Excel) */}
          <div className="v6-card max-w-xl p-0 overflow-hidden">
            <div className="bg-[#59083E] text-white px-4 py-2.5">
              <h3 className="font-serif-v6 text-sm font-bold text-white m-0">
                RESUMO DE ASSIDUIDADE — {activeCollab.name.toUpperCase()}
              </h3>
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#EAD1DC] text-[#28202a] font-bold">
                  <th className="py-2.5 px-4">Natureza</th>
                  <th className="py-2.5 px-4 text-center">Total horas</th>
                  <th className="py-2.5 px-4 text-center">Equiv. dias (8h)</th>
                  <th className="py-2.5 px-4 text-right">% do total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0eae6]">
                <tr>
                  <td className="py-2.5 px-4 font-medium">Férias</td>
                  <td className="py-2.5 px-4 text-center">
                    {activeCollabStats.feriasH.toFixed(1).replace(".", ",")}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {(activeCollabStats.feriasH / 8).toFixed(2).replace(".", ",")}
                  </td>
                  <td className="py-2.5 px-4 text-right font-semibold">
                    {activeCollabStats.totalH > 0
                      ? `${Math.round(
                          (activeCollabStats.feriasH / activeCollabStats.totalH) *
                            100
                        )}%`
                      : "0%"}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-medium">Outras faltas</td>
                  <td className="py-2.5 px-4 text-center">
                    {activeCollabStats.outrasH.toFixed(1).replace(".", ",")}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {(activeCollabStats.outrasH / 8).toFixed(2).replace(".", ",")}
                  </td>
                  <td className="py-2.5 px-4 text-right font-semibold">
                    {activeCollabStats.totalH > 0
                      ? `${Math.round(
                          (activeCollabStats.outrasH / activeCollabStats.totalH) *
                            100
                        )}%`
                      : "0%"}
                  </td>
                </tr>
                <tr className="bg-[#F3EFE6] font-bold text-[#59083e]">
                  <td className="py-2.5 px-4">TOTAL</td>
                  <td className="py-2.5 px-4 text-center">
                    {activeCollabStats.totalH.toFixed(1).replace(".", ",")}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {activeCollabStats.equivDays.toFixed(2).replace(".", ",")}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    {activeCollabStats.totalH > 0 ? "100%" : "0%"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create / Edit Attendance Record */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#160617]/55 backdrop-blur-xs p-4">
          <div className="bg-white border border-[#e5d7d9] rounded-[14px] shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#f0eae6] pb-3">
              <h2 className="font-serif-v6 text-xl text-[#28202a] m-0">
                {editingRecord
                  ? "Editar Registo de Assiduidade"
                  : "Novo Registo de Assiduidade"}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-[#776f73] hover:text-[#28202a]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-[#6d5d66]">
                  <span>Colaboradora *</span>
                  <select
                    value={formState.collaborator_id}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        collaborator_id: e.target.value,
                      })
                    }
                    className="border border-[#dfd6d6] rounded-[7px] p-2.5 bg-white text-[#28202a]"
                  >
                    {collaborators.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-[#6d5d66]">
                  <span>Tipo de ausência *</span>
                  <select
                    value={formState.absence_type}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        absence_type: e.target.value as any,
                      })
                    }
                    className="border border-[#dfd6d6] rounded-[7px] p-2.5 bg-white text-[#28202a]"
                  >
                    <option value="Férias">Férias</option>
                    <option value="Outra falta">Outra falta</option>
                    <option value="Atraso">Atraso</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-[#6d5d66]">
                  <span>Data início *</span>
                  <input
                    type="date"
                    required
                    value={formState.start_date}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        start_date: e.target.value,
                        end_date:
                          formState.end_date < e.target.value
                            ? e.target.value
                            : formState.end_date,
                      })
                    }
                    className="border border-[#dfd6d6] rounded-[7px] p-2.5 bg-white text-[#28202a]"
                  />
                </label>

                <label className="flex flex-col gap-1 text-[#6d5d66]">
                  <span>Data fim *</span>
                  <input
                    type="date"
                    required
                    value={formState.end_date}
                    onChange={(e) =>
                      setFormState({ ...formState, end_date: e.target.value })
                    }
                    className="border border-[#dfd6d6] rounded-[7px] p-2.5 bg-white text-[#28202a]"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-[#6d5d66]">
                  <span>Dias completos (× 8h)</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formState.full_days}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        full_days: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    className="border border-[#dfd6d6] rounded-[7px] p-2.5 bg-white text-[#28202a]"
                  />
                </label>

                <label className="flex flex-col gap-1 text-[#6d5d66]">
                  <span>Horas parciais</span>
                  <input
                    type="number"
                    min="0"
                    max="7.5"
                    step="0.5"
                    value={formState.partial_hours}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        partial_hours: Math.max(
                          0,
                          parseFloat(e.target.value) || 0
                        ),
                      })
                    }
                    className="border border-[#dfd6d6] rounded-[7px] p-2.5 bg-white text-[#28202a]"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1 text-[#6d5d66]">
                <span>Descrição / Motivo</span>
                <input
                  type="text"
                  placeholder="Ex.: Período de férias de verão, Consulta médica, Assunto pessoal..."
                  value={formState.reason}
                  onChange={(e) =>
                    setFormState({ ...formState, reason: e.target.value })
                  }
                  className="border border-[#dfd6d6] rounded-[7px] p-2.5 bg-white text-[#28202a]"
                />
              </label>

              <div className="p-3 rounded-lg bg-[#f9f5f1] border border-[#e9e0dd] flex items-center justify-between text-xs">
                <span className="text-[#6d5d66]">
                  Cálculo automático (Base 8h/dia):
                </span>
                <strong className="text-[#59083e]">
                  {(
                    (Number(formState.full_days) || 0) * 8 +
                    (Number(formState.partial_hours) || 0)
                  ).toFixed(1)}{" "}
                  horas (
                  {(
                    ((Number(formState.full_days) || 0) * 8 +
                      (Number(formState.partial_hours) || 0)) /
                    8
                  ).toFixed(2)}{" "}
                  dias)
                </strong>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#f0eae6]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="v6-btn"
                >
                  Cancelar
                </button>
                <button type="submit" className="v6-btn primary">
                  Guardar Registo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

