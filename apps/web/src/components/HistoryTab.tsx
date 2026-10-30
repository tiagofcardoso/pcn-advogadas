"use client";

import React, { useState, useMemo } from "react";
import { Download, Filter, Search, Globe, User } from "lucide-react";
import { AuditLogEntry, UserProfile } from "@/lib/types";

interface HistoryTabProps {
  auditLogs: AuditLogEntry[];
  usersList: UserProfile[];
}

export default function HistoryTab({ auditLogs, usersList }: HistoryTabProps) {
  // Filter out any "Sistema PCN" or ghost system entries
  const validLogs = useMemo(() => {
    return auditLogs.filter(
      (l) =>
        l.user &&
        l.user.trim() !== "Sistema PCN" &&
        l.user.trim() !== "Sistema" &&
        l.user.trim() !== ""
    );
  }, [auditLogs]);

  // Distinct active users with at least 1 action
  const activeUsersWithHistory = useMemo(() => {
    const counts: Record<string, number> = {};
    validLogs.forEach((log) => {
      const u = log.user.trim();
      counts[u] = (counts[u] || 0) + 1;
    });

    // Return users that have count > 0, ordered by count descending
    return Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => {
        const profile = usersList.find(
          (p) =>
            p.name.toLowerCase() === name.toLowerCase() ||
            p.name.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(p.name.toLowerCase())
        );
        return {
          name,
          count,
          role: profile?.role,
        };
      });
  }, [validLogs, usersList]);

  // Selected tab: "general" OR a specific user name
  const [activeTab, setActiveTab] = useState<string>("general");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [areaFilter, setAreaFilter] = useState<string>("Todas");
  const [actionCategoryFilter, setActionCategoryFilter] = useState<string>("Todas");
  const [pageSize, setPageSize] = useState<number>(30);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Distinct areas for filter
  const allAreas = useMemo(() => {
    const set = new Set<string>();
    validLogs.forEach((l) => {
      if (l.area) set.add(l.area.trim());
    });
    return ["Todas", ...Array.from(set).sort()];
  }, [validLogs]);

  // If activeTab is a user that no longer has history, fallback to "general"
  const currentTab = useMemo(() => {
    if (activeTab === "general") return "general";
    const exists = activeUsersWithHistory.some((u) => u.name === activeTab);
    return exists ? activeTab : "general";
  }, [activeTab, activeUsersWithHistory]);

  // Filter logs based on active tab and filters
  const displayedLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return validLogs.filter((log) => {
      // If a specific user tab is selected, filter strictly by that user
      if (currentTab !== "general") {
        const isMatch =
          log.user.toLowerCase() === currentTab.toLowerCase() ||
          log.user.toLowerCase().includes(currentTab.toLowerCase());
        if (!isMatch) return false;
      }

      // Filter by Area
      if (areaFilter !== "Todas" && (log.area || "Sistema") !== areaFilter) {
        return false;
      }

      // Filter by Action Type
      if (actionCategoryFilter !== "Todas") {
        const act = (log.action || "").toLowerCase();
        if (actionCategoryFilter === "Criação" && !act.includes("criada") && !act.includes("criado") && !act.includes("registad")) {
          return false;
        }
        if (actionCategoryFilter === "Edição" && !act.includes("atualizad") && !act.includes("editad")) {
          return false;
        }
        if (actionCategoryFilter === "Cronómetro" && !act.includes("cronómetr") && !act.includes("cronometr")) {
          return false;
        }
        if (actionCategoryFilter === "Remoção" && !act.includes("removid") && !act.includes("apagad") && !act.includes("eliminad")) {
          return false;
        }
      }

      // Search Query
      if (q) {
        const full = `${log.at} ${log.user} ${log.area} ${log.action} ${log.detail}`.toLowerCase();
        if (!full.includes(q)) return false;
      }

      return true;
    });
  }, [validLogs, currentTab, searchQuery, areaFilter, actionCategoryFilter]);

  // Pagination
  const paginatedLogs = useMemo(() => {
    if (pageSize === 0) return displayedLogs;
    const start = (currentPage - 1) * pageSize;
    return displayedLogs.slice(start, start + pageSize);
  }, [displayedLogs, currentPage, pageSize]);

  const totalPages = pageSize === 0 ? 1 : Math.ceil(displayedLogs.length / pageSize);

  // Badge styling
  const getActionBadgeClass = (action: string) => {
    const act = (action || "").toLowerCase();
    if (act.includes("criada") || act.includes("criado") || act.includes("registad")) {
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    }
    if (act.includes("atualizad") || act.includes("editad")) {
      return "bg-blue-50 text-blue-800 border-blue-200";
    }
    if (act.includes("iniciado") || act.includes("concluíd") || act.includes("concluid")) {
      return "bg-[#f5ecf2] text-[#690d4b] border-[#e2cad9]";
    }
    if (act.includes("pausado")) {
      return "bg-amber-50 text-amber-800 border-amber-200";
    }
    if (act.includes("removid") || act.includes("apagad") || act.includes("eliminad")) {
      return "bg-rose-50 text-rose-800 border-rose-200";
    }
    return "bg-stone-50 text-stone-700 border-stone-200";
  };

  const getAreaBadgeClass = (area: string) => {
    const ar = (area || "").toLowerCase();
    if (ar.includes("agenda") || ar.includes("prazo")) {
      return "bg-amber-50 text-[#845618] border-[#e8d5bc]";
    }
    if (ar.includes("tarefa")) {
      return "bg-purple-50 text-[#59083e] border-[#dfc3d5]";
    }
    if (ar.includes("cliente")) {
      return "bg-blue-50 text-[#1b4b72] border-[#bcd5ea]";
    }
    if (ar.includes("assiduidade")) {
      return "bg-teal-50 text-[#145d58] border-[#b5ddd8]";
    }
    if (ar.includes("utilizadora") || ar.includes("perfil")) {
      return "bg-indigo-50 text-[#2f3972] border-[#cad2f2]";
    }
    return "bg-stone-100 text-stone-700 border-stone-200";
  };

  // Export CSV
  const handleExportCsv = () => {
    const d = new Date().toISOString().slice(0, 10);
    const filename =
      currentTab === "general"
        ? `historico_pcn_geral_${d}.csv`
        : `historico_pcn_${currentTab.replace(/\s+/g, "_").toLowerCase()}_${d}.csv`;

    const headers =
      currentTab === "general"
        ? ["Data/Hora", "Utilizadora", "Área", "Ação", "Detalhes"]
        : ["Data/Hora", "Área", "Ação", "Detalhes"];

    const rows = displayedLogs.map((l) =>
      currentTab === "general"
        ? [
            `"${l.at.replace(/"/g, '""')}"`,
            `"${(l.user || "").replace(/"/g, '""')}"`,
            `"${(l.area || "Sistema").replace(/"/g, '""')}"`,
            `"${(l.action || "").replace(/"/g, '""')}"`,
            `"${(l.detail || "").replace(/"/g, '""')}"`,
          ]
        : [
            `"${l.at.replace(/"/g, '""')}"`,
            `"${(l.area || "Sistema").replace(/"/g, '""')}"`,
            `"${(l.action || "").replace(/"/g, '""')}"`,
            `"${(l.detail || "").replace(/"/g, '""')}"`,
          ]
    );

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* ── BARRA DE ABAS (TABS) ── */}
      <div className="border-b border-[#ded2c9] flex flex-wrap items-center gap-1.5 pt-1">
        {/* Aba 1: Visão Geral */}
        <button
          type="button"
          onClick={() => {
            setActiveTab("general");
            setCurrentPage(1);
          }}
          className={`py-2.5 px-4 font-serif-v6 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            currentTab === "general"
              ? "border-[#59083e] text-[#59083e] bg-[#fbf8f5] rounded-t-lg"
              : "border-transparent text-[#736872] hover:text-[#28202a] hover:bg-[#faf6f2] rounded-t-lg"
          }`}
        >
          <Globe className="w-4 h-4 text-[#8a766e]" />
          <span>Visão Geral</span>
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full font-sans font-bold ${
              currentTab === "general"
                ? "bg-[#59083e] text-white"
                : "bg-[#ece4dc] text-[#59083e]"
            }`}
          >
            {validLogs.length}
          </span>
        </button>

        {/* Abas individuais APENAS para quem tem histórico */}
        {activeUsersWithHistory.map((u) => {
          const isSelected = currentTab === u.name;
          return (
            <button
              key={u.name}
              type="button"
              onClick={() => {
                setActiveTab(u.name);
                setCurrentPage(1);
              }}
              className={`py-2.5 px-4 font-serif-v6 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                isSelected
                  ? "border-[#59083e] text-[#59083e] bg-[#fbf8f5] rounded-t-lg"
                  : "border-transparent text-[#736872] hover:text-[#28202a] hover:bg-[#faf6f2] rounded-t-lg"
              }`}
            >
              <User className="w-3.5 h-3.5 text-[#8a766e]" />
              <span>{u.name}</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-sans font-bold ${
                  isSelected
                    ? "bg-[#59083e] text-white"
                    : "bg-[#ece4dc] text-[#59083e]"
                }`}
              >
                {u.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── FILTROS E PESQUISA ── */}
      <div className="v6-card p-4 space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Caixa de pesquisa */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#736872] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={
                currentTab === "general"
                  ? "Pesquisar por utilizadora, ação, detalhe ou data..."
                  : `Pesquisar ações de ${currentTab}...`
              }
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[#d9ccc5] bg-[#faf8f6] text-[#28202a] focus:bg-white focus:border-[#92006f] outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#736872] hover:text-black cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filtro por Área */}
            <div className="flex items-center gap-1.5 text-xs text-[#736872]">
              <Filter className="w-3.5 h-3.5 text-[#59083e]" />
              <span>Área:</span>
              <select
                value={areaFilter}
                onChange={(e) => {
                  setAreaFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="py-1 px-2.5 rounded-lg border border-[#d9ccc5] bg-white text-xs text-[#28202a]"
              >
                {allAreas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por Ação */}
            <div className="flex items-center gap-1.5 text-xs text-[#736872]">
              <span>Ação:</span>
              <select
                value={actionCategoryFilter}
                onChange={(e) => {
                  setActionCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="py-1 px-2.5 rounded-lg border border-[#d9ccc5] bg-white text-xs text-[#28202a]"
              >
                <option value="Todas">Todas as ações</option>
                <option value="Criação">Criação / Registo</option>
                <option value="Edição">Atualização / Edição</option>
                <option value="Cronómetro">Cronómetro</option>
                <option value="Remoção">Remoção / Apagar</option>
              </select>
            </div>

            {/* Itens por página */}
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="py-1 px-2 rounded-lg border border-[#d9ccc5] bg-white text-xs text-[#28202a]"
            >
              <option value={15}>15 linhas</option>
              <option value={30}>30 linhas</option>
              <option value={50}>50 linhas</option>
              <option value={100}>100 linhas</option>
              <option value={0}>Todas</option>
            </select>

            {/* Exportar CSV */}
            <button
              type="button"
              onClick={handleExportCsv}
              className="v6-btn flex items-center gap-1.5 text-xs py-1 px-3 cursor-pointer"
              title="Descarregar histórico visível em CSV"
            >
              <Download className="w-3.5 h-3.5 text-[#59083e]" />
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>

        {/* ── TABELA DE DADOS ── */}
        <div className="v6-table-wrap">
          <table className="v6-table">
            <thead>
              <tr>
                <th className="w-36">Data / Hora</th>
                {currentTab === "general" && <th className="w-48">Utilizadora</th>}
                <th className="w-36">Área</th>
                <th className="w-44">Ação</th>
                <th>Detalhe da Atividade</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#faf7f4] transition-colors">
                  <td className="font-mono text-xs text-[#61555c] whitespace-nowrap">
                    {log.at}
                  </td>
                  {currentTab === "general" && (
                    <td>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab(log.user);
                          setCurrentPage(1);
                        }}
                        className="font-bold text-xs text-[#28202a] hover:text-[#59083e] hover:underline cursor-pointer flex items-center gap-1.5"
                      >
                        <span className="w-5 h-5 rounded-full bg-[#ede4df] text-[#59083e] text-[10px] flex items-center justify-center font-serif-v6">
                          {(log.user || "U")[0]}
                        </span>
                        <span>{log.user}</span>
                      </button>
                    </td>
                  )}
                  <td>
                    <span
                      className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded-md border ${getAreaBadgeClass(
                        log.area
                      )}`}
                    >
                      {log.area || "Sistema"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`inline-block px-2.5 py-0.5 text-[11px] font-semibold rounded-full border ${getActionBadgeClass(
                        log.action
                      )}`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="text-xs text-[#362b32] font-normal leading-relaxed">
                    {log.detail}
                  </td>
                </tr>
              ))}
              {paginatedLogs.length === 0 && (
                <tr>
                  <td
                    colSpan={currentTab === "general" ? 5 : 4}
                    className="py-10 text-center text-xs text-[#736872] italic"
                  >
                    Nenhum registo histórico encontrado com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINAÇÃO ── */}
        {pageSize > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-[#ede4df] text-xs text-[#736872]">
            <span>
              Mostrando {paginatedLogs.length} de {displayedLogs.length} registos
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded border border-[#d9ccc5] bg-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="px-2 font-bold text-[#28202a]">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded border border-[#d9ccc5] bg-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                Seguinte
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
