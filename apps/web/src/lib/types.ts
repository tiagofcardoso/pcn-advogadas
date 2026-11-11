export interface Client {
  id: string;
  name: string;
  number?: string; // N.º PCN (ex: "0042")
  birthday?: string; // MM-DD (ex: "10-26")
  nif?: string;
  process_reference?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  description?: string;
  hourly_rate: number;
  default_billable?: boolean;
  color: string;
}

export type TaskPriority = "Normal" | "Alta" | "Urgente";

export interface TaskWaitingPeriod {
  id: string;
  reason: string;
  started_at: string;
  ended_at?: string | null;
}

export type TaskV6Status =
  | "Por iniciar"
  | "Em curso"
  | "Pausada"
  | "A aguardar"
  | "A aguardar cliente"
  | "A aguardar entidade"
  | "A aguardar terceiros"
  | "Redistribuída"
  | "Concluída"
  | "Cancelada";

export interface TaskRedistributionAlert {
  id: string;
  taskId: string;
  taskTitle: string;
  clientName: string;
  fromUserId?: string;
  fromUserName: string;
  toUserId?: string;
  toUserName: string;
  targetUserId?: string;
  targetUserName: string;
  roleInChange: "previous_owner" | "new_owner";
  changedBy: string;
  createdAt: string;
  acknowledgedAt?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  client_id: string;
  client_name: string;
  client_number?: string;
  task_type: string;
  task_type_id?: string;
  status: "backlog" | "pool" | "assigned" | "in_progress" | "paused" | "completed" | "archived";
  v6_status?: TaskV6Status;
  priority?: TaskPriority;
  request_date?: string;
  origin?: string;
  communication_ref?: string;
  start_date?: string;
  entity?: string;
  process_reference?: string;
  follow_up_date?: string;
  waiting_started_at?: string | null;
  waiting_total_seconds?: number;
  waiting_periods?: TaskWaitingPeriod[];
  created_date?: string;
  assigned_to?: string;
  lawyer_name?: string;
  due_date?: string;
  total_duration_seconds: number;
  fee_amount?: number;
  documented_expenses?: number;
  undocumented_expenses?: number;
  is_billed?: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  subtitle?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  type: "Compromisso" | "Diligência" | "Prazo" | "Prazo de tarefa" | "Férias / Ausência";
  owner: string;
}

export interface FeeNoteCustomLine {
  id: string;
  task_id?: string;
  date: string;
  description: string;
  hours?: string;
  documented_expenses: number;
  undocumented_expenses: number;
  fees: number;
}

export interface FeeNoteClientMeta {
  subject: string;
  period: string;
  provisions_received: number;
  credits_payments: number;
  apply_vat: boolean;
}

export interface AttendanceRecord {
  id: string;
  collaborator_id: string;
  collaborator_name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  absence_type: "Férias" | "Outra falta" | "Atraso";
  reason: string;
  full_days: number;
  partial_hours: number;
}

export interface AuditLogEntry {
  id: string;
  at: string;
  user: string;
  action: string;
  area: string;
  detail: string;
  oldVal?: string;
  newVal?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  role: "master" | "admin_lawyer" | "lawyer";
  email: string;
  is_active?: boolean;
  permissions?: Record<string, boolean>;
}

/** Direção (admin_lawyer) and IT (master) have full management access. */
export function isAdminRole(role?: string | null): boolean {
  return role === "admin_lawyer" || role === "master";
}

export const ROLE_LABELS: Record<string, string> = {
  master: "Master (TI)",
  admin_lawyer: "Direção / Administradora",
  lawyer: "Advogada",
};
