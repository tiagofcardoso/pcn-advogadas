/**
 * Cliente HTTP tipado para a API PCN Advogadas (FastAPI).
 */

function getApiBase(): string {
  let raw = (
    process.env.NEXT_PUBLIC_API_URL ||
    "https://remarkable-cat-production-2dc2.up.railway.app/api/v1"
  ).trim().replace(/\/+$/, "");
  if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
    raw = `https://${raw}`;
  }
  return raw;
}

export const API_BASE = getApiBase();

interface RequestOptions extends RequestInit {
  token?: string;
}

export async function apiFetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers = {}, ...rest } = options;
  const reqHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string>),
  };

  if (token) {
    reqHeaders["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: reqHeaders,
    ...rest,
  });

  const isAuthRoute = endpoint.startsWith("/auth/");

  if (res.status === 401 && !isAuthRoute) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("pcn_session_token");
      localStorage.removeItem("pcn_session_expiry");
      localStorage.removeItem("pcn_session_user");
      localStorage.removeItem("pcn_session_closed_at");
      localStorage.removeItem("pcn_session_last_seen");
      window.dispatchEvent(
        new CustomEvent("pcn_session_expired", {
          detail: "A sua sessão expirou. Por favor, inicie sessão novamente.",
        })
      );
    }
    throw new Error("A sua sessão expirou. Por favor, autentique-se novamente.");
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    // Token from before the mandatory password/2FA setup: send the user back to login.
    if (res.status === 403 && errorBody.code === "setup_required" && typeof window !== "undefined") {
      localStorage.removeItem("pcn_session_token");
      localStorage.removeItem("pcn_session_expiry");
      localStorage.removeItem("pcn_session_user");
      localStorage.removeItem("pcn_session_closed_at");
      localStorage.removeItem("pcn_session_last_seen");
      window.dispatchEvent(
        new CustomEvent("pcn_session_expired", {
          detail: "Por segurança, conclua a configuração da conta (nova palavra-passe e 2FA). Inicie sessão novamente.",
        })
      );
    }
    throw new Error(errorBody.message || errorBody.detail || `Erro ${res.status}: ${res.statusText}`);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

// ── Auth ──
export async function loginApi(email: string, password: string) {
  return apiFetch<any>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: email.trim(), password }),
  });
}

export async function verifyMfaLoginApi(mfaToken: string, code: string) {
  return apiFetch<any>("/auth/2fa/verify-login", {
    method: "POST",
    body: JSON.stringify({ mfa_token: mfaToken, code: code.trim() }),
  });
}

export async function setup2faApi(token: string) {
  return apiFetch<{ secret: string; qr_svg_data_uri: string }>("/auth/2fa/setup", {
    method: "POST",
    token,
  });
}

export async function verify2faApi(token: string, code: string) {
  return apiFetch<any>("/auth/2fa/verify", {
    method: "POST",
    token,
    body: JSON.stringify({ code: code.trim() }),
  });
}

export async function changePasswordApi(token: string, currentPassword: string, newPassword: string) {
  return apiFetch<any>("/auth/change-password", {
    method: "POST",
    token,
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
}

// ── Tarefas e Quadros ──
export async function keepaliveTokenApi(token: string) {
  return apiFetch<{ access_token: string; expires_in: number }>("/auth/keepalive", {
    method: "POST",
    token,
  });
}

export async function getDirectionBoard(token: string) {
  return apiFetch<any[]>("/tasks/boards/direction", { token });
}

export async function getPoolBoard(token: string) {
  return apiFetch<any[]>("/tasks/boards/pool", { token });
}

export async function getPersonalBoard(token: string) {
  return apiFetch<any[]>("/tasks/boards/me", { token });
}

export async function claimTaskApi(taskId: string, token: string) {
  return apiFetch<any>(`/tasks/${taskId}/claim`, { method: "POST", token });
}

export async function createTaskApi(
  token: string,
  payload: {
    title: string;
    description?: string;
    client_id: string;
    task_type_id: string;
    assigned_to?: string | null;
    due_date?: string | null;
    is_urgent_deadline?: boolean;
    publish_to_pool?: boolean;
  }
) {
  return apiFetch<any>("/tasks", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function assignTaskApi(taskId: string, lawyerId: string | null, token: string) {
  return apiFetch<any>(`/tasks/${taskId}/assign`, {
    method: "POST",
    token,
    body: JSON.stringify({ assigned_to: lawyerId }),
  });
}

export async function updateTaskApi(
  taskId: string,
  token: string,
  payload: {
    title?: string;
    description?: string;
    client_id?: string;
    task_type_id?: string;
    due_date?: string | null;
    is_urgent_deadline?: boolean;
    fee_amount?: number;
    status?: string;
    total_duration_seconds?: number;
  }
) {
  return apiFetch<any>(`/tasks/${taskId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export async function archiveTaskApi(taskId: string, token: string) {
  return apiFetch<any>(`/tasks/${taskId}/archive`, {
    method: "POST",
    token,
  });
}

export async function restoreTaskApi(taskId: string, token: string) {
  return apiFetch<any>(`/tasks/${taskId}/restore`, {
    method: "POST",
    token,
  });
}

export async function deleteTaskApi(taskId: string, token: string) {
  return apiFetch<any>(`/tasks/${taskId}`, {
    method: "DELETE",
    token,
  });
}

// ── Cronómetro ──
export async function getActiveTimerApi(token: string) {
  return apiFetch<any>("/timer/active", { token });
}

export async function startTimerApi(taskId: string, token: string) {
  return apiFetch<any>(`/timer/${taskId}/start`, { method: "POST", token });
}

export async function pauseTimerApi(
  taskId: string,
  token: string,
  clientDurationSeconds?: number
) {
  const qs =
    clientDurationSeconds !== undefined
      ? `?client_duration_seconds=${Math.max(0, Math.floor(clientDurationSeconds))}`
      : "";
  return apiFetch<any>(`/timer/${taskId}/pause${qs}`, { method: "POST", token });
}

export async function completeTaskApi(
  taskId: string,
  token: string,
  clientDurationSeconds?: number
) {
  const qs =
    clientDurationSeconds !== undefined
      ? `?client_duration_seconds=${Math.max(0, Math.floor(clientDurationSeconds))}`
      : "";
  return apiFetch<any>(`/timer/${taskId}/complete${qs}`, { method: "POST", token });
}

export async function syncTimersApi(
  token: string,
  tasks: Array<{ task_id: string; total_duration_seconds: number }>,
  keepalive: boolean = false
) {
  return apiFetch<any[]>("/timer/sync", {
    method: "POST",
    token,
    keepalive,
    body: JSON.stringify({ tasks }),
  });
}

export async function notifyTaskOvertimeApi(
  taskId: string,
  token: string,
  durationSeconds?: number,
  recipientEmail?: string
) {
  const params = new URLSearchParams();
  if (durationSeconds !== undefined) params.set("duration_seconds", String(durationSeconds));
  void recipientEmail; // ignored: the server decides who receives the alert
  const qs = params.toString() ? `?${params.toString()}` : "";
  return apiFetch<any>(`/tasks/${taskId}/notify-overtime${qs}`, {
    method: "POST",
    token,
  });
}


// ── Clientes & Tipos de Tarefa ──
export async function getClientsApi(token: string) {
  return apiFetch<any[]>("/clients", { token });
}

export async function createClientApi(
  token: string,
  payload: {
    name: string;
    nif?: string;
    email?: string;
    phone?: string;
    process_reference?: string;
    notes?: string;
  }
) {
  return apiFetch<any>("/clients", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function getTaskTypesApi(token: string) {
  return apiFetch<any[]>("/task-types", { token });
}

export async function createTaskTypeApi(
  token: string,
  payload: {
    name: string;
    description?: string;
    hourly_rate: number;
    default_billable?: boolean;
    color?: string;
  }
) {
  return apiFetch<any>("/task-types", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function updateTaskTypeApi(
  token: string,
  typeId: string,
  payload: {
    name?: string;
    description?: string;
    hourly_rate?: number;
    default_billable?: boolean;
    color?: string;
  }
) {
  return apiFetch<any>(`/task-types/${typeId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export async function deleteTaskTypeApi(token: string, typeId: string) {
  return apiFetch<any>(`/task-types/${typeId}`, {
    method: "DELETE",
    token,
  });
}

export async function getMetricsSummaryApi(token: string, query?: string) {
  const q = query ? `?q=${encodeURIComponent(query)}` : "";
  return apiFetch<any>(`/metrics/summary${q}`, { token });
}

// ── Calculadora de Prazos CPC ──
export async function calculateDeadlineApi(token: string, startDate: string, days: number, isUrgent: boolean) {
  return apiFetch<any>("/agenda/calculate-deadline", {
    method: "POST",
    token,
    body: JSON.stringify({
      start_date: startDate,
      days: days,
      is_urgent: isUrgent,
    }),
  });
}

// ── Notas de Honorários ──
export async function getFeeNotesApi(token: string, clientId?: string) {
  const q = clientId ? `?client_id=${encodeURIComponent(clientId)}` : "";
  return apiFetch<any[]>(`/fee-notes${q}`, { token });
}

export async function getUnbilledTasksApi(token: string, clientId: string) {
  return apiFetch<any[]>(`/fee-notes/unbilled-tasks?client_id=${clientId}`, { token });
}

export async function createFeeNoteDraftApi(
  token: string,
  payload: {
    client_id: string;
    task_ids: string[];
    task_prices?: Record<string, number>;
    vat_rate?: number;
    withholding_rate?: number;
    notes?: string;
  }
) {
  return apiFetch<any>("/fee-notes/drafts", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function updateFeeNotePriceApi(
  token: string,
  noteId: string,
  taskId: string,
  amount: number
) {
  return apiFetch<any>(`/fee-notes/${noteId}/price-item`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ task_id: taskId, amount }),
  });
}

export async function issueFeeNoteApi(token: string, noteId: string) {
  return apiFetch<any>(`/fee-notes/${noteId}/issue`, {
    method: "POST",
    token,
  });
}

export function getExcelExportUrl(feeNoteId: string, internal: boolean = false) {
  return `${API_BASE}/fee-notes/${feeNoteId}/export-excel?internal=${internal}`;
}

export async function downloadFeeNoteExcelApi(
  token: string,
  feeNoteId: string,
  internal: boolean = false,
  referenceCode?: string
): Promise<void> {
  const url = getExcelExportUrl(feeNoteId, internal);
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.message || errorBody.detail || `Erro ao transferir Excel (${res.status})`);
  }

  const blob = await res.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  const label = referenceCode || feeNoteId;
  anchor.download = `PCN_Nota_Honorarios_${label}${internal ? "_Interna" : ""}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(blobUrl);
}

export async function clearDemoDataApi(token: string) {
  return apiFetch<{ status: string; message: string }>("/system/clear-demo-data", {
    method: "POST",
    token,
  });
}

// ── Gestão de Utilizadores (Portal Admin) ──
export async function getUsersApi(token: string) {
  return apiFetch<any[]>("/users", { token });
}

export async function createUserApi(
  token: string,
  payload: {
    name: string;
    email: string;
    role: string;
    password?: string;
  }
) {
  return apiFetch<any>("/users", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function unlockUserApi(token: string, userId: string) {
  return apiFetch<any>(`/users/${userId}/unlock`, { method: "POST", token });
}

export async function resetUserMfaApi(token: string, userId: string) {
  return apiFetch<any>(`/users/${userId}/reset-mfa`, { method: "POST", token });
}

export async function resetUserPasswordApi(token: string, userId: string) {
  return apiFetch<{ temporary_password: string }>(`/users/${userId}/reset-password`, {
    method: "POST",
    token,
  });
}

export async function updateUserApi(
  token: string,
  userId: string,
  payload: {
    name?: string;
    role?: string;
    is_active?: boolean;
  }
) {
  return apiFetch<any>(`/users/${userId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}


