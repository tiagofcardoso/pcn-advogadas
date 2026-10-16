import { Client, Task, UserProfile } from "./types";

export const INITIAL_USERS: UserProfile[] = [
  { id: "usr_patricia", name: "Patrícia", role: "admin_lawyer", email: "patricia@pcnadvogadas.pt" },
  { id: "usr_ines", name: "Inês", role: "lawyer", email: "ines@pcnadvogadas.pt" },
  { id: "usr_sofia", name: "Sofia", role: "lawyer", email: "sofia@pcnadvogadas.pt" },
];

export const INITIAL_CLIENTS: Client[] = [];

export const INITIAL_TASKS: Task[] = [];

export const DEMO_CLIENTS: Client[] = [
  {
    id: "cli_1",
    name: "Cliente A",
    nif: "501234567",
    process_reference: "Proc. 142/26.8T8LSB",
    email: "contacto@clientea.pt",
    phone: "+351 210 123 456",
  },
  {
    id: "cli_2",
    name: "Cliente B (Sociedade Imobiliária)",
    nif: "509876543",
    process_reference: "Proc. 890/26.1T8OVR",
    email: "geral@imobiliaria.pt",
    phone: "+351 220 987 654",
  },
];

export const DEMO_TASKS: Task[] = [
  {
    id: "tsk_1",
    title: "Registo predial",
    description: "Submissão de pedido de certidão permanente predial e atualização matricial.",
    client_id: "cli_1",
    client_name: "Cliente A",
    task_type: "Certidões e Registos",
    status: "assigned",
    assigned_to: "usr_ines",
    lawyer_name: "Inês",
    due_date: "2026-10-21",
    total_duration_seconds: 2700, // 45m
    fee_amount: 85.00,
  },
  {
    id: "tsk_2",
    title: "Emitir certidão negativa de dívidas tributárias",
    description: "Obtenção de certidão negativa junto da Autoridade Tributária e Segurança Social.",
    client_id: "cli_2",
    client_name: "Cliente B (Sociedade Imobiliária)",
    task_type: "Certidões e Registos",
    status: "pool",
    total_duration_seconds: 0,
    due_date: "2026-10-25",
  },
  {
    id: "tsk_3",
    title: "Redação de Contestação Cível",
    description: "Elaboração de peça processual de contestação e arrolamento de testemunhas.",
    client_id: "cli_1",
    client_name: "Cliente A",
    task_type: "Peças Processuais",
    status: "in_progress",
    assigned_to: "usr_ines",
    lawyer_name: "Inês",
    due_date: "2026-10-28",
    total_duration_seconds: 4800, // 1h 20m
    fee_amount: 350.00,
  },
  {
    id: "tsk_4",
    title: "Análise de autos e consulta jurídica",
    description: "Estudo prévio de viabilidade processual e reunião de conferência.",
    client_id: "cli_1",
    client_name: "Cliente A",
    task_type: "Consultoria e Reuniões",
    status: "completed",
    assigned_to: "usr_ines",
    lawyer_name: "Inês",
    due_date: "2026-10-14",
    total_duration_seconds: 9000, // 2h 30m
    fee_amount: 250.00,
    is_billed: false,
  },
  {
    id: "tsk_5",
    title: "Elaboração de Parecer Sucessório",
    description: "Análise de partilha e quinhão hereditário com consulta de inventário.",
    client_id: "cli_2",
    client_name: "Cliente B (Sociedade Imobiliária)",
    task_type: "Consultoria e Reuniões",
    status: "paused",
    assigned_to: "usr_sofia",
    lawyer_name: "Sofia",
    due_date: "2026-11-02",
    total_duration_seconds: 3600,
    fee_amount: 180.00,
    is_billed: false,
  },
];
