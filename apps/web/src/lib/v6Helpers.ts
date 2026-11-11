import {
  AttendanceRecord,
  CalendarEvent,
  Client,
  FeeNoteClientMeta,
  FeeNoteCustomLine,
  Task,
  TaskV6Status,
  TaskWaitingPeriod,
} from "./types";

export const TASK_ORIGIN_OPTIONS = [
  "Pessoal",
  "E-mail",
  "Telefonema",
  "WhatsApp",
  "Outros",
] as const;

export const V6_STATUS_LIST: TaskV6Status[] = [
  "Por iniciar",
  "Em curso",
  "Pausada",
  "A aguardar cliente",
  "A aguardar entidade",
  "A aguardar terceiros",
  "Redistribuída",
  "Concluída",
];

export function isWaitingStatus(v6Status?: string): boolean {
  return Boolean(v6Status && v6Status.toLowerCase().includes("aguardar"));
}

export function getTaskV6Status(task: Task): TaskV6Status {
  if (task.v6_status) return task.v6_status;
  switch (task.status) {
    case "in_progress":
      return "Em curso";
    case "paused":
      return "Pausada";
    case "completed":
    case "archived":
      return "Concluída";
    case "pool":
    case "assigned":
    case "backlog":
    default:
      return "Por iniciar";
  }
}

export function mapV6StatusToBackend(
  v6Status: TaskV6Status
): Task["status"] {
  switch (v6Status) {
    case "Em curso":
      return "in_progress";
    case "Pausada":
    case "A aguardar":
    case "A aguardar cliente":
    case "A aguardar entidade":
    case "A aguardar terceiros":
      return "paused";
    case "Concluída":
      return "completed";
    case "Redistribuída":
    case "Por iniciar":
    default:
      return "assigned";
  }
}

export function getV6BadgeClass(status: TaskV6Status): string {
  if (status === "Concluída") return "v6-badge done";
  if (status === "Redistribuída") return "v6-badge redist";
  if (status === "Pausada") return "v6-badge paused";
  if (status.includes("aguardar")) return "v6-badge wait";
  if (status === "Por iniciar") return "v6-badge start";
  return "v6-badge";
}

/**
 * Calcula o tempo total em espera externa (Terceiros / Entidade / Cliente),
 * devolvendo o total em segundos (períodos já fechados + período ativo atual).
 */
export function getTaskWaitingSeconds(
  task: Pick<Task, "v6_status" | "status" | "waiting_started_at" | "waiting_total_seconds">,
  nowMs: number = Date.now()
): number {
  const closedSec = Math.max(0, Number(task.waiting_total_seconds) || 0);
  const v6St = task.v6_status || "";
  if (!isWaitingStatus(v6St) || !task.waiting_started_at) {
    return closedSec;
  }
  const startMs = new Date(task.waiting_started_at).getTime();
  if (isNaN(startMs)) return closedSec;
  const liveElapsedSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
  return closedSec + liveElapsedSec;
}

/**
 * Formata uma duração em dias e horas (ex.: "3d 04h", "0d 06h").
 */
export function formatDaysAndHours(totalSeconds: number): string {
  const clean = Math.max(0, Math.floor(totalSeconds || 0));
  const totalHours = Math.floor(clean / 3600);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return `${days}d ${String(hours).padStart(2, "0")}h`;
}

/**
 * Converte uma ISO string UTC/local para input `datetime-local` ("YYYY-MM-DDTHH:mm").
 */
export function toDatetimeLocalValue(iso?: string | null): string {
  if (!iso) return "";
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) {
    return String(iso).slice(0, 16);
  }
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

/**
 * Aplica transição automática de contagem de espera externa quando o estado muda
 * entre "A aguardar..." e outros estados, sem duplicar lógica entre criação e edição.
 */
export function applyWaitingTransition(params: {
  previousWaitingStartedAt?: string | null;
  previousWaitingTotalSeconds?: number;
  previousWaitingPeriods?: TaskWaitingPeriod[];
  previousV6Status?: TaskV6Status;
  nextV6Status: TaskV6Status;
  editedWaitingStartedAt?: string | null;
  now?: Date;
}): {
  waiting_started_at: string | null;
  waiting_total_seconds: number;
  waiting_periods: TaskWaitingPeriod[];
} {
  const now = params.now || new Date();
  const prevTotal = Math.max(0, Number(params.previousWaitingTotalSeconds) || 0);
  const prevPeriods = Array.isArray(params.previousWaitingPeriods)
    ? [...params.previousWaitingPeriods]
    : [];
  const enteringWaiting = isWaitingStatus(params.nextV6Status);
  const prevStartedRaw = params.previousWaitingStartedAt || null;
  const editedRaw = params.editedWaitingStartedAt?.trim() || "";

  const toIsoOrNull = (val?: string | null): string | null => {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  if (enteringWaiting) {
    const resolvedStart = toIsoOrNull(editedRaw) || toIsoOrNull(prevStartedRaw) || now.toISOString();
    return {
      waiting_started_at: resolvedStart,
      waiting_total_seconds: prevTotal,
      waiting_periods: prevPeriods,
    };
  }

  // Saindo de espera (ou criando já fora de espera)
  if (prevStartedRaw) {
    const startDate = new Date(prevStartedRaw);
    const elapsed = isNaN(startDate.getTime())
      ? 0
      : Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / 1000));
    const closedPeriod: TaskWaitingPeriod = {
      id: `wp_${now.getTime()}`,
      reason: params.previousV6Status || "A aguardar",
      started_at: isNaN(startDate.getTime()) ? now.toISOString() : startDate.toISOString(),
      ended_at: now.toISOString(),
    };
    return {
      waiting_started_at: null,
      waiting_total_seconds: prevTotal + elapsed,
      waiting_periods: [...prevPeriods, closedPeriod].slice(-25),
    };
  }

  return {
    waiting_started_at: null,
    waiting_total_seconds: prevTotal,
    waiting_periods: prevPeriods,
  };
}

/**
 * Resumo estatístico das tarefas de um cliente por estado (estilo V5.2).
 */
export function getClientTaskStatusBreakdown(tasks: Task[]): {
  inProgress: number;
  toStart: number;
  paused: number;
  waiting: number;
  completed: number;
  redistributed: number;
  parts: string[];
} {
  let inProgress = 0;
  let toStart = 0;
  let paused = 0;
  let waiting = 0;
  let completed = 0;
  let redistributed = 0;

  for (const t of tasks) {
    const st = getTaskV6Status(t);
    if (st === "Em curso") inProgress++;
    else if (st === "Por iniciar") toStart++;
    else if (st === "Pausada") paused++;
    else if (isWaitingStatus(st)) waiting++;
    else if (st === "Redistribuída") redistributed++;
    else if (st === "Concluída") completed++;
  }

  const parts: string[] = [];
  if (inProgress > 0) parts.push(`${inProgress} em curso`);
  if (waiting > 0) parts.push(`${waiting} pendente(s)`);
  if (toStart > 0) parts.push(`${toStart} por iniciar`);
  if (paused > 0) parts.push(`${paused} pausada(s)`);
  if (redistributed > 0) parts.push(`${redistributed} redistribuída(s)`);
  if (completed > 0) parts.push(`${completed} concluída(s)`);

  return { inProgress, toStart, paused, waiting, completed, redistributed, parts };
}

export function getPriorityBadgeStyle(priority?: string): {
  bg: string;
  text: string;
  border: string;
  label: string;
} {
  switch (priority) {
    case "Urgente":
      return {
        bg: "#fde8ec",
        text: "#9d2842",
        border: "#f5c2cb",
        label: "Urgente",
      };
    case "Alta":
      return {
        bg: "#fff0d6",
        text: "#805c17",
        border: "#eed6a7",
        label: "Alta",
      };
    case "Normal":
    default:
      return {
        bg: "#f4eee8",
        text: "#50454b",
        border: "#e2d8d0",
        label: "Normal",
      };
  }
}

export function formatCurrencyPt(val: number): string {
  return Number(val || 0).toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " €";
}

export function formatIsoDatePt(iso?: string): string {
  if (!iso) return "—";
  const clean = iso.split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split("-");
    return `${d}/${m}/${y}`;
  }
  return clean;
}

export interface TaskDeadlineSemaphore {
  diffDays: number | null;
  level: "red" | "yellow" | "normal";
  label: string;
  formattedDate: string;
  bg: string;
  text: string;
  border: string;
  rowBg: string;
  dotColor: string;
}

/**
 * Regra global de prazos em todo o sistema:
 * - Vermelho: vencendo hoje (diffDays === 0) ou vencido (diffDays < 0)
 * - Amarelo: a vencer nos próximos 5 dias (1 <= diffDays <= 5)
 */
export function getTaskDeadlineSemaphore(task: Task): TaskDeadlineSemaphore {
  const formattedDate = formatIsoDatePt(task.due_date);
  const v6St = getTaskV6Status(task);
  if (v6St === "Concluída" || !task.due_date) {
    return {
      diffDays: null,
      level: "normal",
      label: formattedDate,
      formattedDate,
      bg: "#f4eee8",
      text: "#50454b",
      border: "#e2d8d0",
      rowBg: "",
      dotColor: "#8c7d6b",
    };
  }

  const raw = task.due_date.split("T")[0];
  let year = 0,
    month = 0,
    day = 0;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    year = y;
    month = m;
    day = d;
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split("/").map(Number);
    year = y;
    month = m;
    day = d;
  } else {
    return {
      diffDays: null,
      level: "normal",
      label: formattedDate,
      formattedDate,
      bg: "#f4eee8",
      text: "#50454b",
      border: "#e2d8d0",
      rowBg: "",
      dotColor: "#8c7d6b",
    };
  }

  const dueMidnight = new Date(year, month - 1, day);
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round(
    (dueMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) {
    const overdue = Math.abs(diffDays);
    return {
      diffDays,
      level: "red",
      label: `Vencido há ${overdue} ${overdue === 1 ? "dia" : "dias"}`,
      formattedDate,
      bg: "#fde8e8",
      text: "#9b2226",
      border: "#f5c2c7",
      rowBg: "rgba(253, 232, 232, 0.38)",
      dotColor: "#dc2626",
    };
  }

  if (diffDays === 0) {
    return {
      diffDays: 0,
      level: "red",
      label: "Vence hoje",
      formattedDate,
      bg: "#fde8e8",
      text: "#9b2226",
      border: "#f5c2c7",
      rowBg: "rgba(253, 232, 232, 0.38)",
      dotColor: "#dc2626",
    };
  }

  if (diffDays >= 1 && diffDays <= 5) {
    return {
      diffDays,
      level: "yellow",
      label: diffDays === 1 ? "Vence amanhã (1 dia)" : `Vence em ${diffDays} dias`,
      formattedDate,
      bg: "#fff3cd",
      text: "#856404",
      border: "#ffe69c",
      rowBg: "rgba(255, 243, 205, 0.35)",
      dotColor: "#d97706",
    };
  }

  return {
    diffDays,
    level: "normal",
    label: `Em ${diffDays} dias`,
    formattedDate,
    bg: "#e1f3d9",
    text: "#326421",
    border: "#c3e6cb",
    rowBg: "",
    dotColor: "#16a34a",
  };
}

export function sortTasksByUrgency(tasks: Task[]): Task[] {
  const prioRank = (p?: string) =>
    p === "Urgente" ? 0 : p === "Alta" ? 1 : 2;

  return [...tasks].sort((a, b) => {
    const aDone = getTaskV6Status(a) === "Concluída" ? 1 : 0;
    const bDone = getTaskV6Status(b) === "Concluída" ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;

    const semA = getTaskDeadlineSemaphore(a);
    const semB = getTaskDeadlineSemaphore(b);

    const levelRank = (lvl: TaskDeadlineSemaphore["level"]) =>
      lvl === "red" ? 0 : lvl === "yellow" ? 1 : 2;

    const lA = levelRank(semA.level);
    const lB = levelRank(semB.level);
    if (lA !== lB) return lA - lB;

    const dA = semA.diffDays ?? 99999;
    const dB = semB.diffDays ?? 99999;
    if (dA !== dB) return dA - dB;

    const pA = prioRank(a.priority);
    const pB = prioRank(b.priority);
    if (pA !== pB) return pA - pB;

    return a.title.localeCompare(b.title, "pt-PT");
  });
}

/**
 * Generates and opens the A4 Editorial Fee Note PDF matching
 * Dr.ª Patrícia's final Aptos Light 2-page layout (`PCN_Nota_Honorarios_Revista.pdf`).
 */
export function openEditorialFeeNotePdf(params: {
  refCode: string;
  issueDatePt: string;
  client: Client;
  meta: FeeNoteClientMeta;
  lines: FeeNoteCustomLine[];
  signatoryName?: string;
}) {
  if (typeof window === "undefined") return;
  const { refCode, issueDatePt, client, meta, lines, signatoryName } = params;

  const totalDocExpenses = lines.reduce(
    (acc, l) => acc + (Number(l.documented_expenses) || 0),
    0
  );
  const totalUndocExpenses = lines.reduce(
    (acc, l) => acc + (Number(l.undocumented_expenses) || 0),
    0
  );
  const totalFees = lines.reduce((acc, l) => acc + (Number(l.fees) || 0), 0);
  const baseBeforeVat = totalFees + totalDocExpenses + totalUndocExpenses;
  const vatAmount = meta.apply_vat ? Math.round(totalFees * 0.23 * 100) / 100 : 0;
  const subtotalWithVat = Math.round((baseBeforeVat + vatAmount) * 100) / 100;
  const provisions = Math.max(0, Number(meta.provisions_received) || 0);
  const credits = Math.max(0, Number(meta.credits_payments) || 0);
  const finalBalance =
    Math.round((subtotalWithVat - provisions - credits) * 100) / 100;

  const clientDisplay = client.name;
  const subjectDisplay =
    meta.subject?.trim() ||
    client.process_reference ||
    "Prestação de serviços jurídicos";
  const periodDisplay = meta.period?.trim() || "Outubro de 2026";
  const lawyerSign = signatoryName || "Patrícia da Costa Neto";
  const logoUrl = `${window.location.origin}/logo_pcn_official.png`;

  const fmtEuroAlways = (v: number) => {
    const num = Number(v || 0);
    return (
      num.toLocaleString("pt-PT", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + " €"
    );
  };

  const fmtEuroBlankIfZero = (v: number) => {
    const num = Number(v || 0);
    if (Math.abs(num) < 0.005) return "";
    return fmtEuroAlways(num);
  };

  const cell = (extra: string) =>
    `padding:3.8px 8px; border-bottom:1px solid #EFEFEF; color:#333333; font-size:10px; font-weight:300; vertical-align:top; ${extra}`;

  const rowsHtml = lines
    .map(
      (l) => `
        <tr style="page-break-inside:avoid; break-inside:avoid;">
          <td style="${cell("white-space:nowrap;")}">${formatIsoDatePt(l.date)}</td>
          <td style="${cell("line-height:1.32;")}"><div>${l.description}</div></td>
          <td style="${cell("text-align:center; white-space:nowrap;")}">${fmtEuroBlankIfZero(l.documented_expenses)}</td>
          <td style="${cell("text-align:center; white-space:nowrap;")}">${fmtEuroBlankIfZero(l.undocumented_expenses)}</td>
          <td style="${cell("text-align:right; white-space:nowrap;")}">${fmtEuroBlankIfZero(l.fees)}</td>
        </tr>`
    )
    .join("");

  const apRow = (label: string, value: string, extra = "") => `
    <div style="display:flex; justify-content:space-between; padding:6px 6px; font-size:10.5px; font-weight:300; color:#333333; ${extra}">
      <span>${label}</span><span>${value}</span>
    </div>`;

  // Layout dinâmico: cabeçalho (thead) e rodapé (tfoot) repetem-se em cada página impressa;
  // a tabela e o APURAMENTO fluem naturalmente, sem página fixa.
  const bodyHtml = `
  <div class="a4-sheet">
    <table class="layout">
      <thead>
        <tr><td>
          <div style="display:flex; align-items:center; gap:14px; margin-bottom:18px;">
            <div style="flex:1; height:1px; background:#C5B38E;"></div>
            <img src="${logoUrl}" alt="PCN Advogadas" style="height:54px; max-width:140px; object-fit:contain;" />
          </div>
        </td></tr>
      </thead>
      <tfoot>
        <tr><td>
          <div style="padding-top:14px;">
            <svg viewBox="0 0 600 22" width="100%" height="20" preserveAspectRatio="none" style="display:block;">
              <path d="M 0 18 Q 220 6 430 12 T 600 16" fill="none" stroke="#C5B38E" stroke-width="2.2" opacity="0.55" />
              <path d="M 0 20 Q 250 10 470 15 T 600 19" fill="none" stroke="#D8C8A8" stroke-width="3.5" opacity="0.35" />
            </svg>
            <div style="text-align:right; font-size:9.5px; font-weight:300; color:#666666; padding-top:6px;">
              PCN ADVOGADAS
            </div>
          </div>
        </td></tr>
      </tfoot>
      <tbody>
        <tr><td>
          <div style="margin-bottom:14px;">
            <h1 style="font-size:13px; font-weight:700; color:#700053; margin:0; letter-spacing:0.2px; text-transform:uppercase;">NOTA DE HONORÁRIOS</h1>
            <div style="font-size:10.5px; font-weight:300; color:#333333; margin-top:4px; text-transform:uppercase;">${client.name} &middot; ${refCode}</div>
          </div>

          <div style="background:#F6F6EE; padding:12px 14px; display:grid; grid-template-columns:1.25fr 1fr; gap:10px 24px; margin-bottom:18px;">
            <div>
              <div class="lbl">CLIENTE</div>
              <div class="val" style="margin-bottom:10px;">${clientDisplay}</div>
              <div class="lbl">ASSUNTO</div>
              <div class="val">${subjectDisplay}</div>
            </div>
            <div>
              <div class="lbl">DATA DE EMISSÃO</div>
              <div class="val" style="margin-bottom:10px;">${issueDatePt}</div>
              <div class="lbl">PERÍODO</div>
              <div class="val">${periodDisplay}</div>
            </div>
          </div>

          <table style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="background:#6D074A; color:#FFFFFF; font-size:10px; font-weight:600;">
                <th style="padding:7px 8px; text-align:center; width:78px;">Data</th>
                <th style="padding:7px 8px; text-align:center;">Descrição da Tarefa</th>
                <th style="padding:7px 8px; text-align:center; width:104px;">Despesas<br/>documentadas</th>
                <th style="padding:7px 8px; text-align:center; width:108px;">Despesas não<br/>documentadas</th>
                <th style="padding:7px 8px; text-align:right; width:86px;">Honorários</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>

          <div style="page-break-inside:avoid; break-inside:avoid; margin-top:26px;">
            <div style="font-size:10.5px; font-weight:300; color:#333333; text-transform:uppercase; margin-bottom:10px;">APURAMENTO</div>
            ${apRow("Honorários", fmtEuroAlways(totalFees))}
            ${apRow("Despesas documentadas", fmtEuroAlways(totalDocExpenses))}
            ${apRow("Despesas não documentadas", fmtEuroAlways(totalUndocExpenses))}
            ${apRow(`IVA (${meta.apply_vat ? "23% — simulação" : "Isento / 0%"})`, fmtEuroAlways(vatAmount))}
            ${apRow("Subtotal", fmtEuroAlways(subtotalWithVat))}
            ${apRow("Provisões recebidas (a deduzir)", provisions > 0 ? "-" + fmtEuroAlways(provisions) : fmtEuroAlways(0))}
            ${apRow("Créditos / pagamentos adicionais", credits > 0 ? "-" + fmtEuroAlways(credits) : fmtEuroAlways(0), "margin-bottom:4px;")}
            <div style="height:1px; background:#C5B38E; margin:2px 0;"></div>
            <div style="background:#F6F6EE; padding:7px 6px; display:flex; justify-content:space-between; align-items:center; font-size:10.5px; font-weight:300; color:#333333;">
              <span>SALDO FINAL</span><span>${fmtEuroAlways(finalBalance)}</span>
            </div>

            <div style="margin-top:26px; font-size:10.5px; font-weight:300; color:#333333; line-height:1.6;">
              <div>A Advogada,</div>
              <div style="margin-top:4px;">${lawyerSign}</div>
            </div>

            <div style="margin-top:22px; font-size:10px; font-weight:300; color:#333333; line-height:1.45;">
              Documento demonstrativo com dados fictícios. A incidência de IVA, a classificação das despesas e a imputação de provisões dependem da situação concreta e deverão ser confirmadas antes da emissão.
            </div>
          </div>
        </td></tr>
      </tbody>
    </table>
  </div>`;

  const htmlDoc = `<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8" />
  <title>Nota_Honorarios_${refCode.replace(/\//g, "-")}_${client.name.replace(/\s+/g, "_")}</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { margin:0; padding:0; background:#E8E3DA; font-family:'Aptos Light','Aptos','Calibri Light','Segoe UI Light',Arial,sans-serif; font-weight:300; color:#333333; }
    .toolbar { position:sticky; top:0; z-index:50; background:#380723; color:#fff; padding:12px 24px; display:flex; align-items:center; justify-content:space-between; border-bottom:2px solid #c5a467; }
    .toolbar-btn { background:linear-gradient(100deg,#85005f,#640845); color:#fff; border:1px solid #c5a467; padding:8px 18px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; }
    .toolbar-btn-close { background:transparent; color:#e6d4e0; border:1px solid #ffffff40; padding:8px 14px; border-radius:6px; font-size:12px; cursor:pointer; margin-left:8px; }
    .a4-sheet { width:210mm; margin:24px auto; background:#FFFFFF; padding:14mm 18mm 12mm 18mm; box-shadow:0 12px 36px rgba(0,0,0,0.14); }
    table.layout { width:100%; border-collapse:collapse; }
    table.layout > thead { display:table-header-group; }
    table.layout > tfoot { display:table-footer-group; }
    table.layout > thead > tr > td, table.layout > tbody > tr > td, table.layout > tfoot > tr > td { padding:0; }
    .lbl { font-size:9.5px; font-weight:300; color:#444444; text-transform:uppercase; }
    .val { font-size:10.5px; font-weight:300; color:#222222; margin-top:3px; }
    @media print {
      body { background:#FFFFFF; }
      .toolbar { display:none !important; }
      .a4-sheet { width:100%; margin:0; padding:0 16mm; box-shadow:none; }
      table.layout > thead > tr > td { padding-top:12mm; }
      table.layout > tfoot > tr > td { padding-bottom:12mm; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div>
      <strong style="font-size:13px; color:#e9c885;">PCN ADVOGADAS &middot; Nota de Honorários (Aptos Light)</strong>
      <span style="font-size:12px; color:#e6d4e0; margin-left:12px;">${refCode} — ${clientDisplay}</span>
    </div>
    <div>
      <button class="toolbar-btn" onclick="window.print()">Guardar como PDF / Imprimir A4</button>
      <button class="toolbar-btn-close" onclick="window.close()">Fechar</button>
    </div>
  </div>
  ${bodyHtml}
  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 350); };
  </script>
</body>
</html>`;

  const printWin = window.open("", "_blank");
  if (!printWin) {
    alert(
      "Por favor, permita a abertura de janelas pop-up no seu navegador para gerar o PDF A4 oficial."
    );
    return;
  }
  printWin.document.open();
  printWin.document.write(htmlDoc);
  printWin.document.close();
}

/**
 * Exports Attendance records as a UTF-8 CSV compatible with Microsoft Excel (.xlsx structure)
 */
export function exportAttendanceCsv(
  records: AttendanceRecord[],
  collaborators: { id: string; name: string }[]
) {
  const rows: string[][] = [
    ["PCN ADVOGADAS — MAPA DE ASSIDUIDADE (HORÁRIO DE REFERÊNCIA: 8H/DIA)"],
    [],
    [
      "Colaboradora",
      "Data início",
      "Data fim",
      "Tipo de ausência",
      "Descrição / Motivo",
      "Dias completos",
      "Horas parciais",
      "Total horas",
      "Equiv. dias (8h)",
    ],
  ];

  for (const r of records) {
    const totalH = (Number(r.full_days) || 0) * 8 + (Number(r.partial_hours) || 0);
    const equivD = totalH / 8;
    rows.push([
      r.collaborator_name,
      formatIsoDatePt(r.start_date),
      formatIsoDatePt(r.end_date),
      r.absence_type,
      r.reason,
      String(r.full_days),
      String(r.partial_hours),
      totalH.toFixed(1).replace(".", ","),
      equivD.toFixed(2).replace(".", ","),
    ]);
  }

  rows.push([]);
  rows.push(["RESUMO GERAL DE ASSIDUIDADE"]);
  rows.push([
    "Colaboradora",
    "Férias (h)",
    "Outras faltas (h)",
    "Total ausências (h)",
    "Equiv. dias (8h)",
    "Assiduidade",
  ]);

  const stats = collaborators.map((c) => {
    const cRecs = records.filter((r) => r.collaborator_id === c.id);
    const feriasH = cRecs
      .filter((r) => r.absence_type === "Férias")
      .reduce((acc, r) => acc + r.full_days * 8 + r.partial_hours, 0);
    const outrasH = cRecs
      .filter((r) => r.absence_type !== "Férias")
      .reduce((acc, r) => acc + r.full_days * 8 + r.partial_hours, 0);
    const totalH = feriasH + outrasH;
    return {
      name: c.name,
      feriasH,
      outrasH,
      totalH,
      equivD: totalH / 8,
    };
  });

  const totals = stats.map((s) => s.totalH);
  const minH = totals.length > 0 ? Math.min(...totals) : 0;
  const maxH = totals.length > 0 ? Math.max(...totals) : 0;

  for (const s of stats) {
    const label =
      s.totalH === minH
        ? "Mais assídua"
        : s.totalH === maxH
        ? "Menos assídua"
        : "Intermédia";
    rows.push([
      s.name,
      s.feriasH.toFixed(1).replace(".", ","),
      s.outrasH.toFixed(1).replace(".", ","),
      s.totalH.toFixed(1).replace(".", ","),
      s.equivD.toFixed(2).replace(".", ","),
      label,
    ]);
  }

  const csvContent =
    "\ufeff" +
    rows
      .map((r) =>
        r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";")
      )
      .join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Mapa_Assiduidade_Colaboradoras_PCN_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE CALENDAR EMBED & UNIFIED EVENTS SYNC HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_GCAL_ID = "https://calendar.google.com/calendar/u/0/r";

/**
 * Constrói o URL de incorporação (iframe) do Google Calendar.
 * Coloca o calendário público de feriados de Portugal como primeiro `src` para garantir
 * que o endpoint `/calendar/embed` da Google responde sempre HTTP 200 OK (sem bloqueio 401),
 * e inclui em seguida o calendário configurado do escritório/utilizador.
 */
export function buildGoogleCalendarEmbedUrl(
  gcalId?: string,
  mode: "MONTH" | "WEEK" | "AGENDA" = "MONTH"
): string {
  const raw = (gcalId || DEFAULT_GCAL_ID).trim();
  const ptHolidays = "pt.portuguese%23holiday%40group.v.calendar.google.com";
  const baseParams = `ctz=Europe%2FLisbon&hl=pt_PT&mode=${mode}&showTitle=0&showPrint=0&showCalendars=1&bgcolor=%23FAF8F6`;

  if (
    !raw ||
    raw.includes("/calendar/u/0/r") ||
    raw.endsWith("/calendar/r") ||
    raw === "pt.portuguese#holiday@group.v.calendar.google.com"
  ) {
    return `https://calendar.google.com/calendar/embed?src=${ptHolidays}&src=tiagofabriciocardoso%40gmail.com&${baseParams}`;
  }

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const url = new URL(raw);
      if (url.pathname.includes("/r")) {
        return `https://calendar.google.com/calendar/embed?src=${ptHolidays}&src=tiagofabriciocardoso%40gmail.com&${baseParams}`;
      }
      url.searchParams.set("mode", mode);
      url.searchParams.set("ctz", "Europe/Lisbon");
      url.searchParams.set("hl", "pt_PT");
      return url.toString();
    } catch {
      return `https://calendar.google.com/calendar/embed?src=${ptHolidays}&${baseParams}`;
    }
  }

  return `https://calendar.google.com/calendar/embed?src=${ptHolidays}&src=${encodeURIComponent(
    raw
  )}&${baseParams}`;
}

export function normalizeEventType(rawType?: string): CalendarEvent["type"] {
  if (!rawType) return "Compromisso";
  const t = rawType.trim();
  if (t === "Prazo processual" || t === "Prazo") return "Prazo";
  if (t === "Prazo de tarefa") return "Prazo de tarefa";
  if (t === "Diligência") return "Diligência";
  if (t.includes("Férias") || t.includes("Ausência")) return "Férias / Ausência";
  return "Compromisso";
}

/**
 * Unifica os eventos da agenda interna com os prazos das tarefas ativas,
 * garantindo que qualquer alteração numa tarefa ou evento reflete imediatamente
 * em todas as telas (Painel de Direção, A Minha Área de Trabalho e Agendas e Prazos).
 */
export function buildUnifiedEvents(
  events: CalendarEvent[],
  tasks: Task[],
  clients: Client[]
): CalendarEvent[] {
  const normalizedEvents: CalendarEvent[] = events.map((e) => ({
    ...e,
    date: (e.date || "").split("T")[0],
    time: e.time || "09:00",
    type: normalizeEventType(e.type),
  }));

  const activeTasksWithDue = tasks.filter(
    (t) =>
      t.status !== "archived" &&
      getTaskV6Status(t) !== "Concluída" &&
      Boolean(t.due_date)
  );

  const taskEvents: CalendarEvent[] = [];
  for (const t of activeTasksWithDue) {
    const cleanDate = (t.due_date || "").split("T")[0];
    if (!cleanDate) continue;

    // Evitar duplicação caso já exista um evento manual com o mesmo id ou título na mesma data
    const alreadyExists = normalizedEvents.some(
      (e) =>
        e.id === `task_deadline_${t.id}` ||
        (e.date === cleanDate &&
          e.title.trim().toLowerCase() === t.title.trim().toLowerCase())
    );
    if (alreadyExists) continue;

    const clientObj = clients.find((c) => c.id === t.client_id);
    const clientTag = clientObj?.number
      ? `PCN ${clientObj.number} — ${clientObj.name}`
      : t.client_name || "Cliente PCN";

    taskEvents.push({
      id: `task_deadline_${t.id}`,
      title: t.title,
      subtitle: `${clientTag}${t.entity ? ` · ${t.entity}` : ""}`,
      date: cleanDate,
      time: "17:00",
      type: "Prazo de tarefa",
      owner: t.assigned_to || t.lawyer_name || "usr_luana",
    });
  }

  return [...normalizedEvents, ...taskEvents].sort((a, b) =>
    `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
  );
}


