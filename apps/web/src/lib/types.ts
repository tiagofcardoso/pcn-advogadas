export interface Client {
  id: string;
  name: string;
  nif?: string;
  process_reference?: string;
  email?: string;
  phone?: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  description?: string;
  hourly_rate: number;
  default_billable?: boolean;
  color: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  client_id: string;
  client_name: string;
  task_type: string;
  task_type_id?: string;
  status: "backlog" | "pool" | "assigned" | "in_progress" | "paused" | "completed" | "archived";
  assigned_to?: string;
  lawyer_name?: string;
  due_date?: string;
  total_duration_seconds: number;
  fee_amount?: number;
  is_billed?: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  role: "admin_lawyer" | "lawyer";
  email: string;
}
