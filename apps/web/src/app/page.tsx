"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  LayoutDashboard,
  Kanban,
  Users,
  Calendar,
  CreditCard,
  Clock,
  Play,
  Pause,
  CheckCircle2,
  Plus,
  Search,
  ChevronDown,
  FileSpreadsheet,
  Scale,
  RefreshCw,
  X,
  Check,
  AlertCircle,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Smartphone,
  Sparkles,
  Archive,
  ArchiveRestore,
  Trash2,
  UserCheck,
  CalendarPlus,
  Share2,
  Download,
  ExternalLink,
  ArrowRight,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Database,
  LogIn,
  LogOut,
  ShieldCheck,
  UserPlus,
  ShieldAlert,
  KeyRound,
  Lock,
  Unlock,
  Ban,
  Smartphone as PhoneIcon,
  Bell,
  BellOff,
  Home,
  Briefcase,
  ClipboardCheck,
  CalendarDays,
  FileText,
  BarChart3,
  History,
  UserCog,
  ClipboardList,
  Settings,
  Landmark,
} from "lucide-react";
import {
  INITIAL_USERS,
  INITIAL_CLIENTS,
  INITIAL_TASKS,
  INITIAL_SERVICE_CATEGORIES,
  INITIAL_EVENTS,
  INITIAL_ATTENDANCE_RECORDS,
  DEMO_TASKS,
} from "@/lib/mockData";
import {
  Task,
  Client,
  UserProfile,
  ServiceCategory,
  CalendarEvent,
  AttendanceRecord,
  AuditLogEntry,
  TaskPriority,
  TaskV6Status,
  TaskRedistributionAlert,
  isAdminRole,
  ROLE_LABELS,
} from "@/lib/types";
import {
  getTaskV6Status,
  mapV6StatusToBackend,
  formatIsoDatePt,
  getV6BadgeClass,
  getPriorityBadgeStyle,
  getTaskDeadlineSemaphore,
  V6_STATUS_LIST,
  buildUnifiedEvents,
  normalizeEventType,
  applyWaitingTransition,
  getClientTaskStatusBreakdown,
  toDatetimeLocalValue,
} from "@/lib/v6Helpers";
import TaskFormFields, { UnifiedTaskFormState } from "@/components/TaskFormFields";
import WorkspaceV6Tab from "@/components/WorkspaceV6Tab";
import CalendarV6Tab from "@/components/CalendarV6Tab";
import FeeNotesV6Tab from "@/components/FeeNotesV6Tab";
import AttendanceTab from "@/components/AttendanceTab";
import HistoryTab from "@/components/HistoryTab";
import { detectPlatform, PlatformInfo } from "@/lib/platform";
import {
  loginApi,
  changePasswordApi,
  keepaliveTokenApi,
  verifyMfaLoginApi,
  setup2faApi,
  verify2faApi,
  unlockUserApi,
  resetUserMfaApi,
  resetUserPasswordApi,
  getDirectionBoard,
  getClientsApi,
  createClientApi,
  getTaskTypesApi,
  createTaskTypeApi,
  updateTaskTypeApi,
  deleteTaskTypeApi,
  getActiveTimerApi,
  startTimerApi,
  pauseTimerApi,
  completeTaskApi,
  syncTimersApi,
  claimTaskApi,
  createTaskApi,
  assignTaskApi,
  updateTaskApi,
  archiveTaskApi,
  restoreTaskApi,
  deleteTaskApi,
  notifyTaskOvertimeApi,
  calculateDeadlineApi,
  getEventsApi,
  createEventApi,
  updateEventApi,
  deleteEventApi,
  getMetricsSummaryApi,
  getFeeNotesApi,
  createFeeNoteDraftApi,
  updateFeeNotePriceApi,
  getExcelExportUrl,
  downloadFeeNoteExcelApi,
  clearDemoDataApi,
  getUsersApi,
  createUserApi,
  updateUserApi,
  updateMyProfileApi,
  deleteUserApi,
  getRedistributionNoticesApi,
  getRedistributedTaskIdsApi,
  createRedistributionNoticesApi,
  ackRedistributionNoticeApi,
} from "@/lib/api";

function formatIsoToEuropean(iso?: string): string {
  if (!iso) return "";
  const clean = iso.split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split("-");
    return `${d}/${m}/${y}`;
  }
  return clean;
}

function EuropeanDateInput({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (isoDate: string) => void;
  className?: string;
}) {
  const datePickerRef = useRef<HTMLInputElement>(null);
  const [textVal, setTextVal] = useState<string>(() => formatIsoToEuropean(value));

  useEffect(() => {
    setTextVal(formatIsoToEuropean(value));
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    setTextVal(formatted);

    if (digits.length === 8) {
      const dd = digits.slice(0, 2);
      const mm = digits.slice(2, 4);
      const yyyy = digits.slice(4, 8);
      onChange(`${yyyy}-${mm}-${dd}`);
    } else if (digits.length === 0) {
      onChange("");
    }
  };

  const openPicker = () => {
    if (datePickerRef.current) {
      try {
        if (typeof (datePickerRef.current as any).showPicker === "function") {
          (datePickerRef.current as any).showPicker();
        } else {
          datePickerRef.current.focus();
          datePickerRef.current.click();
        }
      } catch { }
    }
  };

  return (
    <div className="relative flex items-center w-full">
      <input
        type="text"
        inputMode="numeric"
        placeholder="DD/MM/AAAA"
        value={textVal}
        onChange={handleTextChange}
        onClick={openPicker}
        className={`${className} pr-8`}
      />
      <button
        type="button"
        onClick={openPicker}
        className="absolute right-2.5 text-[#736B5E] hover:text-[#92006F] cursor-pointer"
        tabIndex={-1}
        title="Selecionar data no calendário (DD/MM/AAAA)"
      >
        <Calendar className="w-4 h-4" />
      </button>
      <input
        ref={datePickerRef}
        type="date"
        value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""}
        onChange={(e) => {
          if (e.target.value) {
            onChange(e.target.value);
          }
        }}
        className="sr-only pointer-events-none"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile>(INITIAL_USERS[0]);
  const [authToken, setAuthToken] = useState<string | null>(null);
  // Direção/Master manage everything; lawyers only create tasks and work on their own.
  const isAdmin = isAdminRole(currentUser?.role);
  const canWorkOn = (task: Task) => isAdmin || task.assigned_to === currentUser?.id;
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [sessionExpiry, setSessionExpiry] = useState<number | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "work"
    | "tasks"
    | "archived"
    | "clients"
    | "calendar"
    | "feenotes"
    | "services"
    | "reports"
    | "attendance"
    | "history"
    | "users"
  >("dashboard");

  // V6 Global Search, Events, Attendance & Audit Log State
  const [globalQuery, setGlobalQuery] = useState<string>("");
  const [events, setEvents] = useState<CalendarEvent[]>(INITIAL_EVENTS);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(
    INITIAL_ATTENDANCE_RECORDS
  );
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const updateEvents = (next: CalendarEvent[]) => {
    setEvents(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("pcn_v6_events", JSON.stringify(next));
      } catch { }
    }
  };

  const updateAttendanceRecords = (next: AttendanceRecord[]) => {
    setAttendanceRecords(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("pcn_v6_attendance", JSON.stringify(next));
      } catch { }
    }
  };

  const addAuditLog = (action: string, detail: string, area: string = "Sistema") => {
    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;
    setAuditLogs((prev) => {
      const next: AuditLogEntry[] = [
        {
          id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          at: stamp,
          user: currentUser?.name || "Utilizadora PCN",
          area,
          action,
          detail,
        },
        ...prev,
      ].slice(0, 200);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("pcn_v6_audit_logs", JSON.stringify(next));
        } catch { }
      }
      return next;
    });
  };

  // User Management State (Portal Admin & Seletores de Tarefas)
  const [usersList, setUsersList] = useState<any[]>(INITIAL_USERS);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState<boolean>(false);
  const [showNewUserPassword, setShowNewUserPassword] = useState<boolean>(false);
  const [newUserForm, setNewUserForm] = useState<{
    name: string;
    email: string;
    role: "master" | "admin_lawyer" | "lawyer";
    password: string;
  }>({
    name: "",
    email: "",
    role: "lawyer",
    password: "",
  });
  const [isSubmittingUser, setIsSubmittingUser] = useState<boolean>(false);

  // Edit User / My Profile Modal State
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [showEditUserPassword, setShowEditUserPassword] = useState<boolean>(false);
  const [editUserForm, setEditUserForm] = useState<{
    name: string;
    email: string;
    role: "master" | "admin_lawyer" | "lawyer";
    password: string;
    is_active: boolean;
  }>({
    name: "",
    email: "",
    role: "lawyer",
    password: "",
    is_active: true,
  });

  // Delete User Confirmation Modal State
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState<boolean>(false);

  // Service Categories CRUD State (Admin Only - Tabela de Serviços & Valores €/h)
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>(
    INITIAL_SERVICE_CATEGORIES
  );
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState<{
    name: string;
    description: string;
    hourly_rate: number;
    color: string;
  }>({
    name: "",
    description: "",
    hourly_rate: 120,
    color: "#92006F",
  });
  const [isSubmittingCategory, setIsSubmittingCategory] = useState<boolean>(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const tasksRef = useRef<Task[]>([]);
  tasksRef.current = tasks;
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingApi, setIsLoadingApi] = useState<boolean>(false);
  const [apiConnected, setApiConnected] = useState<boolean>(false);

  // Active Timer State & 1-Hour Overtime Alert State
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [overtimeAlert, setOvertimeAlert] = useState<{
    task: Task;
    hours: number;
    emailSent: boolean;
    recipientEmail: string;
  } | null>(null);
  const alertedHoursRef = useRef<Record<string, number>>({});

  const getTodayDateString = (): string => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // Search in Reports
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [reportsData, setReportsData] = useState<any>(null);

  // Judicial Deadline Calculator State (Art. 138/139 CPC)
  const [calcStartDate, setCalcStartDate] = useState<string>("");
  const [calcDays, setCalcDays] = useState<number>(10);
  const [calcIsUrgent, setCalcIsUrgent] = useState<boolean>(false);
  const [calcResult, setCalcResult] = useState<{
    finalDate: string;
    suspendedDays: number;
    penaltyDays: string[];
  } | null>({
    finalDate: "07/09/2026",
    suspendedDays: 47,
    penaltyDays: ["08/09/2026", "09/09/2026", "10/09/2026"],
  });

  // Fee Note Builder State & Hourly Billing / Retainer Config
  const [selectedFeeClient, setSelectedFeeClient] = useState<string>("");
  const [feeTaskPrices, setFeeTaskPrices] = useState<Record<string, number>>({});
  const [feeNotesByClient, setFeeNotesByClient] = useState<Record<string, any>>({});
  const [applyWithholdingByClient, setApplyWithholdingByClient] = useState<Record<string, boolean>>({});
  const [isSavingFeeNote, setIsSavingFeeNote] = useState<boolean>(false);
  const [hourlyRateByClient, setHourlyRateByClient] = useState<Record<string, number>>({});
  const [retainerHoursByClient, setRetainerHoursByClient] = useState<Record<string, number>>({});
  const [billingRoundingMinutes, setBillingRoundingMinutes] = useState<0 | 6 | 15>(0);
  const [clientSearchQuery, setClientSearchQuery] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedCats = localStorage.getItem("pcn_service_categories");
      if (savedCats) {
        const parsed = JSON.parse(savedCats);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setServiceCategories(parsed);
        }
      }
      const savedRates = localStorage.getItem("pcn_client_hourly_rates");
      if (savedRates) setHourlyRateByClient(JSON.parse(savedRates));
      const savedRetainers = localStorage.getItem("pcn_client_retainer_hours");
      if (savedRetainers) setRetainerHoursByClient(JSON.parse(savedRetainers));
      const savedRounding = localStorage.getItem("pcn_billing_rounding");
      if (savedRounding === "6" || savedRounding === "15" || savedRounding === "0") {
        setBillingRoundingMinutes(parseInt(savedRounding, 10) as 0 | 6 | 15);
      }
      const savedEvents = localStorage.getItem("pcn_v6_events");
      if (savedEvents) {
        const parsedEv = JSON.parse(savedEvents);
        if (Array.isArray(parsedEv)) {
          // Filtra os eventos mock antigos (evt_1 a evt_4) para nunca reaparecerem
          const cleanedEv: CalendarEvent[] = parsedEv
            .filter((ev: any) => !/^evt_[1-4]$/.test(String(ev.id || "")))
            .map((ev: any) => ({
              ...ev,
              type: normalizeEventType(ev.type),
            }));
          setEvents(cleanedEv);
          try {
            localStorage.setItem("pcn_v6_events", JSON.stringify(cleanedEv));
          } catch {}
        }
      } else {
        setEvents([]);
      }
      const savedAtt = localStorage.getItem("pcn_v6_attendance");
      if (savedAtt) {
        const parsedAtt = JSON.parse(savedAtt);
        if (Array.isArray(parsedAtt) && parsedAtt.length > 0) setAttendanceRecords(parsedAtt);
      }
      const savedLogs = localStorage.getItem("pcn_v6_audit_logs");
      if (savedLogs) {
        const parsedLogs = JSON.parse(savedLogs);
        if (Array.isArray(parsedLogs)) {
          const cleaned = parsedLogs.filter(
            (l: any) => l.user && l.user !== "Sistema PCN" && l.user !== "Sistema"
          );
          setAuditLogs(cleaned);
          try {
            localStorage.setItem("pcn_v6_audit_logs", JSON.stringify(cleaned));
          } catch {}
        }
      }
    } catch { }
  }, []);

  const persistCategoriesLocal = (cats: ServiceCategory[]) => {
    setServiceCategories(cats);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("pcn_service_categories", JSON.stringify(cats));
      } catch { }
    }
  };

  const getCategoryForTask = (task: Task): ServiceCategory => {
    const byId =
      task.task_type_id && serviceCategories.find((c) => c.id === task.task_type_id);
    if (byId) return byId;
    const byName = serviceCategories.find(
      (c) => c.name.trim().toLowerCase() === (task.task_type || "").trim().toLowerCase()
    );
    if (byName) return byName;
    return (
      serviceCategories[0] || {
        id: "tp_default",
        name: task.task_type || "Geral",
        hourly_rate: 120,
        color: "#92006F",
      }
    );
  };

  const getTaskCategoryRate = (task: Task): number => {
    const cat = getCategoryForTask(task);
    return Number(cat?.hourly_rate) || 120;
  };

  const updateClientHourlyRate = (clientId: string, rate: number) => {
    const clean = Math.max(0, isNaN(rate) ? 0 : rate);
    setHourlyRateByClient((prev) => {
      const next = { ...prev, [clientId]: clean };
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("pcn_client_hourly_rates", JSON.stringify(next));
        } catch { }
      }
      return next;
    });
  };

  const updateClientRetainerHours = (clientId: string, hours: number) => {
    const clean = Math.max(0, isNaN(hours) ? 0 : hours);
    setRetainerHoursByClient((prev) => {
      const next = { ...prev, [clientId]: clean };
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("pcn_client_retainer_hours", JSON.stringify(next));
        } catch { }
      }
      return next;
    });
  };

  const updateBillingRounding = (mins: 0 | 6 | 15) => {
    setBillingRoundingMinutes(mins);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("pcn_billing_rounding", String(mins));
      } catch { }
    }
  };

  const calculateFeeFromSeconds = (
    seconds: number,
    hourlyRate: number,
    roundingMin: 0 | 6 | 15
  ): number => {
    if (!seconds || seconds <= 0 || !hourlyRate || hourlyRate <= 0) return 0;
    let billableSeconds = seconds;
    if (roundingMin > 0) {
      const blockSec = roundingMin * 60;
      billableSeconds = Math.ceil(seconds / blockSec) * blockSec;
    }
    return Math.round(((billableSeconds / 3600) * hourlyRate) * 100) / 100;
  };

  const calculateTaskFeeByCategory = (
    task: Task,
    roundingMin: 0 | 6 | 15 = billingRoundingMinutes
  ): number => {
    const rate = getTaskCategoryRate(task);
    return calculateFeeFromSeconds(task.total_duration_seconds || 0, rate, roundingMin);
  };

  // Modal & Form States
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState<boolean>(false);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState<boolean>(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [modalFeedback, setModalFeedback] = useState<string | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);
  const [googleCalendarPromptEvent, setGoogleCalendarPromptEvent] = useState<CalendarEvent | null>(null);

  // Quick Event Modal (from Workspace "+ Novo compromisso" / "+ Novo prazo" or editing any event)
  const [isQuickEventModalOpen, setIsQuickEventModalOpen] = useState<boolean>(false);
  const [editingQuickEventId, setEditingQuickEventId] = useState<string | null>(null);
  const [quickEventForm, setQuickEventForm] = useState<{
    title: string;
    date: string;
    time: string;
    type: CalendarEvent["type"];
    clientId: string;
    ownerId: string;
    notes: string;
  }>({
    title: "",
    date: "",
    time: "10:00",
    type: "Compromisso",
    clientId: "",
    ownerId: "usr_patricia",
    notes: "",
  });

  const openQuickEventModal = (defaultType?: CalendarEvent["type"]) => {
    const resolvedType = normalizeEventType(defaultType || "Compromisso");
    setEditingQuickEventId(null);
    setQuickEventForm({
      title: "",
      date: getTodayDateString(),
      time: resolvedType.includes("Prazo") ? "17:00" : "10:30",
      type: resolvedType,
      clientId: clients[0]?.id || "",
      ownerId: currentUser?.id || usersList[0]?.id || "usr_patricia",
      notes: "",
    });
    setIsQuickEventModalOpen(true);
  };

  const openEditEventFromAnyTab = (evt: CalendarEvent) => {
    if (evt.id.startsWith("task_deadline_")) {
      const taskId = evt.id.replace("task_deadline_", "");
      const targetTask = (tasks.length > 0 ? tasks : DEMO_TASKS).find(
        (t) => t.id === taskId
      );
      if (targetTask) {
        openTaskDetails(targetTask);
        return;
      }
    }
    const matchedUser = usersList.find(
      (u) =>
        u.id === evt.owner ||
        u.name.toLowerCase() === (evt.owner || "").toLowerCase()
    );
    setEditingQuickEventId(evt.id);
    setQuickEventForm({
      title: evt.title,
      date: evt.date || getTodayDateString(),
      time: evt.time || "10:00",
      type: normalizeEventType(evt.type),
      clientId: "",
      ownerId: matchedUser?.id || currentUser?.id || usersList[0]?.id || "usr_patricia",
      notes: evt.subtitle || "",
    });
    setIsQuickEventModalOpen(true);
  };

  const mapApiEventToCalendarEvent = (ev: any): CalendarEvent => {
    const iso = String(ev.starts_at || new Date().toISOString());
    const datePart = iso.slice(0, 10);
    const timePart = iso.length >= 16 ? iso.slice(11, 16) : "10:00";
    const evType = normalizeEventType(ev.location || (ev.is_deadline ? "Prazo" : "Compromisso"));
    return {
      id: ev.id,
      title: ev.title,
      subtitle: ev.description || (ev.client?.name ? ev.client.name : undefined),
      date: datePart,
      time: timePart,
      type: evType,
      owner: ev.owner_id || ev.owner?.id || currentUser?.id || "usr_patricia",
    };
  };

  const handleDeleteEventFromAnyTab = async (id: string) => {
    if (id.startsWith("task_deadline_")) return;
    const target = events.find((x) => x.id === id);
    updateEvents(events.filter((x) => x.id !== id));
    if (authToken && apiConnected && !id.startsWith("ev_") && !id.startsWith("evt_")) {
      try {
        await deleteEventApi(authToken, id);
      } catch (e) {
        console.warn("Aviso ao remover evento na API:", e);
      }
    }
    if (target) {
      addAuditLog(
        "Agenda removida",
        `${target.title} (${target.date})`,
        "Agendas e Prazos"
      );
      setModalFeedback(`Registo "${target.title}" removido da agenda.`);
      setTimeout(() => setModalFeedback(null), 3500);
    }
  };

  const handleSaveQuickEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickEventForm.title.trim()) return;
    const ownerObj = usersList.find((u) => u.id === quickEventForm.ownerId);
    const clientObj = clients.find((c) => c.id === quickEventForm.clientId);
    const subtitleParts = [
      clientObj ? clientObj.name : "",
      quickEventForm.notes.trim(),
    ].filter(Boolean);
    const normalizedType = normalizeEventType(quickEventForm.type);
    const evDate = quickEventForm.date || getTodayDateString();
    const evTime = quickEventForm.time || "09:00";
    const evOwner = ownerObj?.id || quickEventForm.ownerId || currentUser?.id || "usr_patricia";
    let payload: CalendarEvent = {
      id: editingQuickEventId || `ev_${Date.now()}`,
      title: quickEventForm.title.trim(),
      subtitle: subtitleParts.join(" · ") || undefined,
      date: evDate,
      time: evTime,
      type: normalizedType,
      owner: evOwner,
    };

    if (editingQuickEventId) {
      if (authToken && apiConnected && !editingQuickEventId.startsWith("ev_") && !editingQuickEventId.startsWith("evt_")) {
        try {
          const updatedEv = await updateEventApi(authToken, editingQuickEventId, {
            title: payload.title,
            description: payload.subtitle || "",
            starts_at: `${evDate}T${evTime}:00Z`,
            owner_id: evOwner,
            client_id: quickEventForm.clientId || undefined,
            location: normalizedType,
            is_deadline: normalizedType === "Prazo",
          });
          if (updatedEv && updatedEv.id) {
            payload = mapApiEventToCalendarEvent(updatedEv);
          }
        } catch (err) {
          console.warn("Aviso ao atualizar evento na API:", err);
        }
      } else if (authToken && apiConnected) {
        try {
          const createdEv = await createEventApi(authToken, {
            title: payload.title,
            description: payload.subtitle || undefined,
            starts_at: `${evDate}T${evTime}:00Z`,
            owner_id: evOwner,
            client_id: quickEventForm.clientId || undefined,
            location: normalizedType,
            is_deadline: normalizedType === "Prazo",
          });
          if (createdEv && createdEv.id) {
            payload = { ...payload, id: createdEv.id };
          }
        } catch (err) {
          console.warn("Aviso ao criar evento na API:", err);
        }
      }
      const exists = events.some((x) => x.id === editingQuickEventId);
      const next = exists
        ? events.map((x) => (x.id === editingQuickEventId ? payload : x))
        : [payload, ...events];
      updateEvents(next);
      addAuditLog(
        "Agenda editada",
        `${payload.type}: ${payload.title} (${payload.date})`,
        "Agendas e Prazos"
      );
      setModalFeedback(`Registo "${payload.title}" atualizado em todas as agendas!`);
    } else {
      if (authToken && apiConnected) {
        try {
          const createdEv = await createEventApi(authToken, {
            title: payload.title,
            description: payload.subtitle || undefined,
            starts_at: `${evDate}T${evTime}:00Z`,
            owner_id: evOwner,
            client_id: quickEventForm.clientId || undefined,
            location: normalizedType,
            is_deadline: normalizedType === "Prazo",
          });
          if (createdEv && createdEv.id) {
            payload = { ...payload, id: createdEv.id };
          }
        } catch (err) {
          console.warn("Aviso ao guardar evento na base de dados:", err);
        }
      }
      updateEvents([payload, ...events]);
      addAuditLog(
        "Agenda criada",
        `${payload.type}: ${payload.title} (${payload.date})`,
        "Agendas e Prazos"
      );
      setModalFeedback(`${payload.type} "${payload.title}" guardado na base de dados e Agenda!`);
    }
    setIsQuickEventModalOpen(false);
    setEditingQuickEventId(null);
    setGoogleCalendarPromptEvent(payload);
    setTimeout(() => setModalFeedback(null), 3500);
  };

  // PWA Standalone & Responsiveness State
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Quick Filters for Task Board
  const [taskStatusFilter, setTaskStatusFilter] = useState<
    "all" | "pool" | "assigned" | "in_progress" | "paused" | "completed"
  >("all");

  // Task Details & Reassign Modal State (unificado com Nova Tarefa + Espera Externa + Tempo)
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState<Task | null>(null);
  const [detailsForm, setDetailsForm] = useState<UnifiedTaskFormState>({
    title: "",
    client_id: "",
    task_type_id: "tp_2",
    custom_type_name: "",
    custom_rate: "120",
    assigned_to: "pool",
    request_date: "",
    origin: "E-mail",
    communication_ref: "",
    start_date: "",
    due_date: "",
    v6_status: "Por iniciar",
    priority: "Normal",
    entity: "",
    process_reference: "",
    follow_up_date: "",
    waiting_started_at: "",
    waiting_total_seconds: 0,
    waiting_periods: [],
    duration_hours: 0,
    duration_minutes: 0,
    duration_seconds: 0,
    description: "",
  });
  const [isSubmittingDetails, setIsSubmittingDetails] = useState<boolean>(false);

  // Task Delete Confirmation Dialog State
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState<boolean>(false);

  // Calendar Export Menu State
  const [showCalendarMenu, setShowCalendarMenu] = useState<boolean>(false);
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo | null>(null);

  // Collapsible Sidebar Group "Gestão PCN" (exclusivo Direção/Admin)
  const [isGestaoPcnOpen, setIsGestaoPcnOpen] = useState<boolean>(true);

  // Alertas de Redistribuição de Tarefa (Sininho 🔔 + Popup com ACK OK em Tempo Real via PostgreSQL)
  const [redistributionAlerts, setRedistributionAlerts] = useState<TaskRedistributionAlert[]>([]);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState<boolean>(false);
  const lastSeenNoticeIdsRef = useRef<Set<string>>(new Set());

  const mapServerNoticeToAlert = (n: any): TaskRedistributionAlert => {
    const dt = n.created_at ? new Date(n.created_at) : new Date();
    const formattedAt = isNaN(dt.getTime())
      ? String(n.created_at || "")
      : dt.toLocaleString("pt-PT", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
    const targetName =
      n.role_in_change === "previous_owner" ? n.from_user_name : n.to_user_name;
    return {
      id: n.id,
      taskId: n.task_id,
      taskTitle: n.task_title,
      clientName: n.client_name || "Cliente",
      fromUserId: n.from_user_id || undefined,
      fromUserName: n.from_user_name,
      toUserId: n.to_user_id || undefined,
      toUserName: n.to_user_name,
      targetUserId: n.target_user_id,
      targetUserName: targetName,
      roleInChange: n.role_in_change === "previous_owner" ? "previous_owner" : "new_owner",
      changedBy: n.changed_by || "Direção PCN",
      createdAt: formattedAt,
      acknowledgedAt: n.acknowledged_at || undefined,
    };
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const loadAlerts = () => {
      try {
        const raw = localStorage.getItem("pcn_redistribution_alerts");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setRedistributionAlerts(parsed);
          }
        }
      } catch {}
    };
    loadAlerts();
    window.addEventListener("storage", loadAlerts);
    return () => window.removeEventListener("storage", loadAlerts);
  }, []);

  // Polling em Tempo Real (a cada 4s) de avisos de redistribuição e estado Redistribuída no PostgreSQL
  useEffect(() => {
    if (!isAuthenticated || !authToken || !apiConnected) return;
    let cancelled = false;

    const pollRealtimeNotifications = async () => {
      try {
        const [serverNotices, redistTaskIds] = await Promise.all([
          getRedistributionNoticesApi(authToken).catch(() => null),
          getRedistributedTaskIdsApi(authToken).catch(() => null),
        ]);
        if (cancelled) return;

        let hasNewUnseenNotice = false;
        if (Array.isArray(serverNotices)) {
          const mappedServer = serverNotices.map(mapServerNoticeToAlert);
          for (const item of mappedServer) {
            if (!lastSeenNoticeIdsRef.current.has(item.id)) {
              lastSeenNoticeIdsRef.current.add(item.id);
              hasNewUnseenNotice = true;
            }
          }
          setRedistributionAlerts((prev) => {
            const localDemoOnly = prev.filter((a) => a.id.startsWith("redist_demo_"));
            const merged = [...mappedServer, ...localDemoOnly];
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem("pcn_redistribution_alerts", JSON.stringify(merged));
              } catch {}
            }
            return merged;
          });
        }

        if (Array.isArray(redistTaskIds) && redistTaskIds.length > 0) {
          const redistSet = new Set(redistTaskIds);
          setTasks((prev) =>
            prev.map((t) =>
              redistSet.has(t.id) &&
              t.status !== "completed" &&
              t.status !== "archived" &&
              t.v6_status !== "Concluída"
                ? { ...t, v6_status: "Redistribuída" }
                : t
            )
          );
        }

        if (hasNewUnseenNotice) {
          const freshTasks = await getDirectionBoard(authToken).catch(() => null);
          if (!cancelled && Array.isArray(freshTasks)) {
            const redistSet = new Set(Array.isArray(redistTaskIds) ? redistTaskIds : []);
            setTasks((prev) => {
              const prevById = new Map(prev.map((p) => [p.id, p]));
              return freshTasks.map((t: any) =>
                hydrateApiTask(t, {
                  existing: prevById.get(t.id),
                  isRedistributed: redistSet.has(t.id),
                })
              );
            });
          }
        }
      } catch {}
    };

    pollRealtimeNotifications();
    const intervalId = setInterval(pollRealtimeNotifications, 4000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [isAuthenticated, authToken, apiConnected, currentUser?.id]);

  const hydrateApiTask = (
    t: any,
    options?: {
      localMeta?: Record<string, any>;
      existing?: Task;
      isRedistributed?: boolean;
      resolvedDuration?: number;
      parsedFee?: number;
    }
  ): Task => {
    const serverMeta = t.meta && typeof t.meta === "object" ? t.meta : {};
    const localMeta = options?.localMeta || {};
    const existing = options?.existing;
    const m = { ...localMeta, ...serverMeta };
    const duration =
      options?.resolvedDuration !== undefined
        ? options.resolvedDuration
        : existing && t.status === "in_progress"
          ? Math.max(existing.total_duration_seconds || 0, t.total_duration_seconds || 0)
          : t.total_duration_seconds || 0;

    let v6St: TaskV6Status | undefined =
      m.v6_status || existing?.v6_status || undefined;
    if (options?.isRedistributed && t.status !== "completed" && t.status !== "archived") {
      v6St = "Redistribuída";
    } else if (t.status === "paused" && v6St === "Em curso") {
      v6St = "Pausada";
    } else if (t.status === "in_progress") {
      v6St = "Em curso";
    } else if (t.status === "completed") {
      v6St = "Concluída";
    }

    return {
      id: t.id,
      title: t.title,
      description: t.description,
      client_id: t.client_id,
      client_name: t.client?.name || existing?.client_name || "Cliente",
      task_type: t.task_type?.name || existing?.task_type || "Geral",
      task_type_id: t.task_type_id || t.task_type?.id || existing?.task_type_id,
      status: t.status,
      v6_status: v6St,
      priority: m.priority || existing?.priority || (t.is_urgent_deadline ? "Urgente" : "Normal"),
      request_date: m.request_date || existing?.request_date,
      origin: m.origin || existing?.origin,
      communication_ref: m.communication_ref || existing?.communication_ref,
      start_date: m.start_date || existing?.start_date,
      entity: m.entity || existing?.entity,
      process_reference: m.process_reference || existing?.process_reference,
      follow_up_date: m.follow_up_date || existing?.follow_up_date,
      waiting_started_at:
        m.waiting_started_at !== undefined
          ? m.waiting_started_at
          : existing?.waiting_started_at ?? null,
      waiting_total_seconds:
        m.waiting_total_seconds !== undefined
          ? Number(m.waiting_total_seconds) || 0
          : existing?.waiting_total_seconds || 0,
      waiting_periods: Array.isArray(m.waiting_periods)
        ? m.waiting_periods
        : existing?.waiting_periods || [],
      assigned_to: t.assigned_to,
      lawyer_name: t.assignee?.name || "—",
      due_date: t.due_date ? t.due_date.split("T")[0] : undefined,
      total_duration_seconds: duration,
      fee_amount: options?.parsedFee ?? existing?.fee_amount,
      documented_expenses: m.documented_expenses ?? existing?.documented_expenses,
      undocumented_expenses: m.undocumented_expenses ?? existing?.undocumented_expenses,
    };
  };

  const isAlertForCurrentUser = (alertItem: TaskRedistributionAlert): boolean => {
    if (!currentUser) return false;
    // Se o aviso tem targetUserId, comparamos estritamente pelo ID (evita falsos positivos por apelido comum como "Cardoso")
    if (alertItem.targetUserId && currentUser.id) {
      return alertItem.targetUserId === currentUser.id;
    }
    const cleanTarget = (alertItem.targetUserName || "")
      .replace("Dr.ª ", "")
      .trim()
      .toLowerCase();
    const cleanCurrent = (currentUser.name || "")
      .replace("Dr.ª ", "")
      .trim()
      .toLowerCase();
    if (!cleanTarget || !cleanCurrent) return false;
    return cleanTarget === cleanCurrent;
  };

  const myPendingRedistAlerts = redistributionAlerts.filter(
    (a) => !a.acknowledgedAt && isAlertForCurrentUser(a)
  );
  const myRecentRedistAlerts = redistributionAlerts
    .filter((a) => isAlertForCurrentUser(a))
    .slice(0, 12);

  // Na barra lateral: de Painel de Direção até Agendas e Prazos visível a todas as utilizadoras
  const allowedTabsForLawyer = new Set([
    "dashboard",
    "work",
    "tasks",
    "clients",
    "calendar",
  ]);

  // Navigation with native mobile back gesture/popstate support
  const switchTab = (
    tab:
      | "dashboard"
      | "work"
      | "tasks"
      | "archived"
      | "clients"
      | "calendar"
      | "feenotes"
      | "services"
      | "reports"
      | "attendance"
      | "history"
      | "users"
  ) => {
    if (!isAdmin && !allowedTabsForLawyer.has(tab)) {
      return;
    }
    if (tab === "users") {
      refreshUsers().catch(() => { });
    }
    if (typeof window !== "undefined") {
      window.history.pushState({ tab }, "");
    }
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const resolveAssigneeValue = (task: Task): string => {
    if (task.status === "pool" || (!task.assigned_to && !task.lawyer_name)) {
      return "pool";
    }
    if (task.assigned_to) {
      const exactMatch = usersList.find((u) => u.id === task.assigned_to);
      if (exactMatch) return exactMatch.id;
    }
    if (task.lawyer_name && task.lawyer_name !== "—") {
      const nameMatch = usersList.find(
        (u) =>
          u.name.toLowerCase() === task.lawyer_name?.toLowerCase() ||
          u.name.toLowerCase().includes(task.lawyer_name?.toLowerCase() || "")
      );
      if (nameMatch) return nameMatch.id;
    }
    return task.assigned_to || (usersList[0]?.id ?? "usr_patricia");
  };

  const openTaskDetails = (task: Task) => {
    if (typeof window !== "undefined") {
      window.history.pushState({ modal: "taskDetails" }, "");
    }
    const liveTask = tasks.find((t) => t.id === task.id) || task;
    const totalSec = Math.max(0, liveTask.total_duration_seconds || 0);
    const v6St = getTaskV6Status(liveTask);
    const matchedCat =
      serviceCategories.find((c) => c.id === liveTask.task_type_id) ||
      serviceCategories.find(
        (c) =>
          c.name.trim().toLowerCase() ===
          (liveTask.task_type || "").trim().toLowerCase()
      );
    setSelectedTaskForDetails(liveTask);
    setDetailsForm({
      title: liveTask.title,
      client_id: liveTask.client_id || (clients[0]?.id ?? ""),
      task_type_id: matchedCat?.id || liveTask.task_type_id || serviceCategories[0]?.id || "tp_2",
      custom_type_name: "",
      custom_rate: String(matchedCat?.hourly_rate || 120),
      assigned_to: resolveAssigneeValue(liveTask),
      request_date: liveTask.request_date || liveTask.created_date || getTodayDateString(),
      origin: liveTask.origin || "E-mail",
      communication_ref: liveTask.communication_ref || "",
      start_date: liveTask.start_date || getTodayDateString(),
      due_date: liveTask.due_date || "",
      v6_status: v6St,
      priority: liveTask.priority || "Normal",
      entity: liveTask.entity || "",
      process_reference: liveTask.process_reference || "",
      follow_up_date: liveTask.follow_up_date || "",
      waiting_started_at: toDatetimeLocalValue(liveTask.waiting_started_at),
      waiting_total_seconds: liveTask.waiting_total_seconds || 0,
      waiting_periods: Array.isArray(liveTask.waiting_periods) ? liveTask.waiting_periods : [],
      duration_hours: Math.floor(totalSec / 3600),
      duration_minutes: Math.floor((totalSec % 3600) / 60),
      duration_seconds: totalSec % 60,
      description: liveTask.description || "",
    });
  };

  const confirmDeleteTask = (task: Task) => {
    if (!isAdmin) { setModalFeedback("Ação reservada à Direção do escritório."); setTimeout(() => setModalFeedback(null), 3500); return; }
    if (typeof window !== "undefined") {
      window.history.pushState({ modal: "deleteConfirm" }, "");
    }
    setTaskToDelete(task);
  };

  // Intercept browser back button / gestures on mobile so app doesn't close abruptly
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
        return;
      }
      if (isNewTaskModalOpen) {
        setIsNewTaskModalOpen(false);
        return;
      }
      if (isNewClientModalOpen) {
        setIsNewClientModalOpen(false);
        return;
      }
      if (selectedTaskForDetails) {
        setSelectedTaskForDetails(null);
        return;
      }
      if (taskToDelete) {
        setTaskToDelete(null);
        return;
      }
      if (showCalendarMenu) {
        setShowCalendarMenu(false);
        return;
      }
      if (e.state?.tab) {
        if (!isAdmin && !allowedTabsForLawyer.has(e.state.tab)) {
          setActiveTab("work");
        } else {
          setActiveTab(e.state.tab);
        }
      } else if (!isAdmin) {
        setActiveTab("work");
      } else if (activeTab !== "dashboard") {
        setActiveTab("dashboard");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [
    isMobileMenuOpen,
    isNewTaskModalOpen,
    isNewClientModalOpen,
    selectedTaskForDetails,
    taskToDelete,
    showCalendarMenu,
    activeTab,
  ]);

  // PWA Standalone Detection & Install Listener
  useEffect(() => {
    const checkPwaMode = () => {
      const isPwa =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes("android-app://");
      setIsStandalone(isPwa);
      if (isPwa) {
        setIsSidebarCollapsed(true);
      }
    };
    checkPwaMode();
    setPlatformInfo(detectPlatform());

    const mq = window.matchMedia("(display-mode: standalone)");
    const handler = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches);
      if (e.matches) setIsSidebarCollapsed(true);
    };
    try {
      mq.addEventListener("change", handler);
    } catch { }

    const beforeInstallHandler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", beforeInstallHandler);

    return () => {
      try {
        mq.removeEventListener("change", handler);
      } catch { }
      window.removeEventListener("beforeinstallprompt", beforeInstallHandler);
    };
  }, []);

  const handleInstallPwa = async () => {
    if (!deferredPrompt) {
      alert(
        "Para instalar a PCN Advogadas no seu telemóvel ou tablet:\n\n1. Toque no ícone de Opções/Partilhar do navegador.\n2. Escolha 'Adicionar ao ecrã principal' ou 'Instalar aplicação'."
      );
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setModalFeedback("Aplicação PCN instalada com sucesso como PWA!");
      setTimeout(() => setModalFeedback(null), 3500);
    }
  };

  // New Task Form (unificado com Editar Tarefa — padrão V5.2 + Tempos + Espera Externa)
  const buildEmptyTaskForm = (
    preClientId?: string,
    defaultDate: string = ""
  ): UnifiedTaskFormState => {
    const defaultCat = serviceCategories[0];
    return {
      title: "",
      client_id: preClientId || clients[0]?.id || "",
      task_type_id: defaultCat?.id || "tp_2",
      custom_type_name: "",
      custom_rate: String(defaultCat?.hourly_rate ?? 120),
      assigned_to: currentUser?.id || usersList[0]?.id || "usr_patricia",
      request_date: defaultDate,
      origin: "E-mail",
      communication_ref: "",
      start_date: defaultDate,
      due_date: defaultDate,
      v6_status: "Por iniciar",
      priority: "Normal",
      entity: "",
      process_reference: "",
      follow_up_date: "",
      waiting_started_at: "",
      waiting_total_seconds: 0,
      waiting_periods: [],
      duration_hours: 0,
      duration_minutes: 0,
      duration_seconds: 0,
      description: "",
    };
  };

  const [newTaskForm, setNewTaskForm] = useState<UnifiedTaskFormState>(() =>
    buildEmptyTaskForm()
  );
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  const openNewTaskModal = (preselectedClientId?: string) => {
    setNewTaskForm(buildEmptyTaskForm(preselectedClientId, getTodayDateString()));
    setIsNewTaskModalOpen(true);
  };

  // Define a data atual no cliente após o mount
  useEffect(() => {
    const today = getTodayDateString();
    setNewTaskForm((prev) => ({
      ...prev,
      due_date: prev.due_date || today,
      request_date: prev.request_date || today,
      start_date: prev.start_date || today,
    }));
    setCalcStartDate((prev) => prev || today);
  }, []);

  // New / Edit Client Form (inclui N.º PCN e Data de aniversário MM-DD)
  const [clientFormNumber, setClientFormNumber] = useState("");
  const [clientFormName, setClientFormName] = useState("");
  const [clientFormNif, setClientFormNif] = useState("");
  const [clientFormProcess, setClientFormProcess] = useState("");
  const [clientFormEmail, setClientFormEmail] = useState("");
  const [clientFormPhone, setClientFormPhone] = useState("");
  const [clientFormBirthday, setClientFormBirthday] = useState("");
  const [clientFormNotes, setClientFormNotes] = useState("");
  const [isSubmittingClient, setIsSubmittingClient] = useState(false);

  const openNewClientModal = () => {
    setEditingClient(null);
    setClientFormNumber(`PCN ${String(clients.length + 1).padStart(4, "0")}`);
    setClientFormName("");
    setClientFormNif("");
    setClientFormProcess("");
    setClientFormEmail("");
    setClientFormPhone("");
    setClientFormBirthday("");
    setClientFormNotes("");
    setIsNewClientModalOpen(true);
  };

  const openEditClientModal = (c: Client) => {
    setEditingClient(c);
    setClientFormNumber(c.number || "");
    setClientFormName(c.name || "");
    setClientFormNif(c.nif || "");
    setClientFormProcess(c.process_reference || "");
    setClientFormEmail(c.email || "");
    setClientFormPhone(c.phone || "");
    setClientFormBirthday(c.birthday || "");
    setClientFormNotes(c.notes || "");
    setIsNewClientModalOpen(true);
  };

  // Garante que o cliente selecionado para novas tarefas ou notas é sempre válido
  useEffect(() => {
    if (clients.length > 0) {
      setNewTaskForm((prev) => {
        const exists = clients.some((c) => c.id === prev.client_id);
        return exists && prev.client_id ? prev : { ...prev, client_id: clients[0].id };
      });
      setSelectedFeeClient((prev) => {
        const exists = clients.some((c) => c.id === prev);
        return exists && prev ? prev : clients[0].id;
      });
    }
  }, [clients]);

  // ── AUTENTICAÇÃO E SESSÃO SEGURA (VÁLIDA ATÉ 1 HORA COM O ECRÃ FECHADO) ──
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const loadAllData = async (token: string, userRole?: string) => {
    setIsLoadingApi(true);
    try {
      const dbPrices: Record<string, number> = {};
      let loadedTasks: Task[] = [];
      let loadedUsers: UserProfile[] = usersList;

      // 1. Tarefas
      try {
        const apiTasks = await getDirectionBoard(token);
        if (apiTasks) {
          let localTimers: Record<string, { seconds: number; updatedAt: number }> = {};
          let localTaskMeta: Record<string, any> = {};
          if (typeof window !== "undefined") {
            try {
              const raw = localStorage.getItem("pcn_running_timers");
              if (raw) localTimers = JSON.parse(raw);
            } catch { }
            try {
              const rawMeta = localStorage.getItem("pcn_v6_task_meta");
              if (rawMeta) localTaskMeta = JSON.parse(rawMeta);
            } catch { }
          }

          const toSyncWithServer: Array<{ task_id: string; total_duration_seconds: number }> = [];
          const nowMs = Date.now();

          let savedThresholds: Record<string, number> = {};
          let savedSilencedInit: string[] = [];
          if (typeof window !== "undefined") {
            try {
              const rawThresh = localStorage.getItem("pcn_overtime_thresholds");
              if (rawThresh) savedThresholds = JSON.parse(rawThresh);
              const rawSil = localStorage.getItem("pcn_silenced_overtime_tasks");
              if (rawSil) savedSilencedInit = JSON.parse(rawSil);
            } catch { }
          }
          const silencedInitSet = new Set(savedSilencedInit);

          const mappedTasks: Task[] = apiTasks.map((t: any) => {
            const parsedFee = t.fee_amount !== null && t.fee_amount !== undefined ? parseFloat(t.fee_amount) : undefined;
            if (parsedFee !== undefined && !isNaN(parsedFee)) {
              dbPrices[t.id] = parsedFee;
            }
            let dur = t.total_duration_seconds || 0;
            if (t.status === "in_progress" && localTimers[t.id]) {
              const elapsedSinceLocal = Math.max(
                0,
                Math.floor((nowMs - (localTimers[t.id].updatedAt || nowMs)) / 1000)
              );
              const candidate = (localTimers[t.id].seconds || 0) + elapsedSinceLocal;
              if (candidate > dur) {
                dur = candidate;
                toSyncWithServer.push({ task_id: t.id, total_duration_seconds: dur });
              }
            }
            const isSilenced = silencedInitSet.has(t.id) || savedThresholds[t.id] === Number.MAX_SAFE_INTEGER;
            let initialThreshold = 3600;
            if (isSilenced) {
              initialThreshold = Number.MAX_SAFE_INTEGER;
            } else if (dur < 3600) {
              initialThreshold = 3600;
            } else if (savedThresholds[t.id] && savedThresholds[t.id] > dur) {
              initialThreshold = savedThresholds[t.id];
            } else {
              initialThreshold = 3600;
            }
            alertedHoursRef.current[t.id] = initialThreshold;
            return hydrateApiTask(t, {
              localMeta: localTaskMeta[t.id] || {},
              resolvedDuration: dur,
              parsedFee,
            });
          });
          loadedTasks = mappedTasks;
          setTasks(mappedTasks);

          const runningList = mappedTasks.filter((t: Task) => t.status === "in_progress");
          if (runningList.length > 0) {
            setActiveTaskId(runningList[0].id);
            setTimerSeconds(runningList[0].total_duration_seconds || 0);
            setIsTimerRunning(true);
          }

          if (toSyncWithServer.length > 0) {
            syncTimersApi(token, toSyncWithServer).catch(() => { });
          }
        }
      } catch (e) {
        console.warn("Aviso ao carregar tarefas:", e);
      }

      // 1.b Cronómetro Ativo
      try {
        const activeTimer = await getActiveTimerApi(token);
        if (activeTimer && activeTimer.is_active && activeTimer.task_id) {
          const accSec = activeTimer.total_accumulated_seconds || 0;
          setActiveTaskId(activeTimer.task_id);
          setIsTimerRunning(true);
          loadedTasks = loadedTasks.map((t) => {
            if (t.id !== activeTimer.task_id) return t;
            const bestSec = Math.max(t.total_duration_seconds || 0, accSec);
            setTimerSeconds(bestSec);
            return { ...t, total_duration_seconds: bestSec };
          });
          setTasks(loadedTasks);
        }
      } catch (e) {
        console.warn("Aviso ao verificar cronómetro ativo:", e);
      }

      // 1.c Categorias de Serviços / Tipos de Tarefa
      try {
        const apiTypes = await getTaskTypesApi(token);
        if (apiTypes && apiTypes.length > 0) {
          let localCats: ServiceCategory[] = [];
          if (typeof window !== "undefined") {
            try {
              const rawCats = localStorage.getItem("pcn_service_categories");
              if (rawCats) localCats = JSON.parse(rawCats);
            } catch { }
          }
          const defaultRateMap: Record<string, number> = {
            "Certidões e Registos": 90,
            "Peças Processuais": 150,
            "Consultoria e Reuniões": 120,
            "Audiências e Julgamentos": 180,
            "Análise Documental": 110,
          };
          const mergedCats: ServiceCategory[] = apiTypes.map((at: any) => {
            const localMatch = localCats.find(
              (lc) =>
                lc.id === at.id ||
                lc.name.trim().toLowerCase() === (at.name || "").trim().toLowerCase()
            );
            const resolvedRate =
              at.hourly_rate !== undefined && at.hourly_rate !== null
                ? Number(at.hourly_rate)
                : localMatch?.hourly_rate ?? defaultRateMap[at.name] ?? 120;
            return {
              id: at.id,
              name: at.name,
              description: at.description || localMatch?.description || "",
              hourly_rate: resolvedRate,
              default_billable: at.default_billable ?? true,
              color: at.color || localMatch?.color || "#92006F",
            };
          });
          persistCategoriesLocal(mergedCats);
          setNewTaskForm((prev) =>
            prev.task_type_id === "__custom__" || mergedCats.some((c) => c.id === prev.task_type_id)
              ? prev
              : { ...prev, task_type_id: mergedCats[0].id }
          );
        }
      } catch (e) {
        console.warn("Aviso ao carregar categorias de serviço:", e);
      }

      // 1.d Eventos da Agenda e Prazos (PostgreSQL)
      try {
        const apiEvents = await getEventsApi(token);
        if (apiEvents) {
          const mappedEvents: CalendarEvent[] = apiEvents.map(mapApiEventToCalendarEvent);
          let localRawEvents: CalendarEvent[] = [];
          if (typeof window !== "undefined") {
            try {
              const rawEv = localStorage.getItem("pcn_v6_events");
              if (rawEv) localRawEvents = JSON.parse(rawEv);
            } catch { }
          }
          for (const locEv of localRawEvents) {
            const lid = String(locEv?.id || "");
            if (
              locEv &&
              (lid.startsWith("ev_") || lid.startsWith("evt_")) &&
              !/^evt_[1-4]$/.test(lid)
            ) {
              const alreadyExists = mappedEvents.some(
                (me) => me.title === locEv.title && me.date === locEv.date
              );
              if (!alreadyExists) {
                try {
                  const createdEv = await createEventApi(token, {
                    title: locEv.title,
                    description: locEv.subtitle || undefined,
                    starts_at: `${locEv.date}T${locEv.time || "10:00"}:00Z`,
                    owner_id: locEv.owner,
                    location: locEv.type,
                    is_deadline: locEv.type === "Prazo",
                  });
                  if (createdEv && createdEv.id) {
                    mappedEvents.push(mapApiEventToCalendarEvent(createdEv));
                  }
                } catch {
                  mappedEvents.push(locEv);
                }
              }
            }
          }
          updateEvents(mappedEvents);
        }
      } catch (e) {
        console.warn("Aviso ao carregar eventos da agenda:", e);
      }

      // 2. Clientes
      try {
        const apiClients = await getClientsApi(token);
        if (apiClients) {
          let localClientMeta: Record<string, any> = {};
          if (typeof window !== "undefined") {
            try {
              const rawCM = localStorage.getItem("pcn_v6_client_meta");
              if (rawCM) localClientMeta = JSON.parse(rawCM);
            } catch { }
          }
          const enrichedClients: Client[] = apiClients.map((c: any, idx: number) => {
            const meta = localClientMeta[c.id] || {};
            const defaultMatch = INITIAL_CLIENTS.find(
              (ic) => ic.id === c.id || ic.name.toLowerCase() === (c.name || "").toLowerCase()
            );
            return {
              ...c,
              number:
                meta.number ||
                c.number ||
                defaultMatch?.number ||
                `PCN ${String(idx + 1).padStart(4, "0")}`,
              birthday: meta.birthday || c.birthday || defaultMatch?.birthday || "",
            };
          });
          setClients(enrichedClients);
          if (enrichedClients.length > 0) {
            setNewTaskForm((prev) => {
              const exists = enrichedClients.some((c: any) => c.id === prev.client_id);
              return exists ? prev : { ...prev, client_id: enrichedClients[0].id };
            });
            setSelectedFeeClient((prev) => {
              const exists = enrichedClients.some((c: any) => c.id === prev);
              return exists ? prev : enrichedClients[0].id;
            });
          }
        }
      } catch (e) {
        console.warn("Aviso ao carregar clientes:", e);
      }

      // 3. Utilizadores
      try {
        setIsLoadingUsers(true);
        const apiUsers = await getUsersApi(token);
        if (apiUsers && apiUsers.length > 0) {
          loadedUsers = apiUsers;
          setUsersList(apiUsers);
          setUsersFetchedAt(Date.now());
          setNewTaskForm((prev) => {
            const exists = apiUsers.some((u: any) => u.id === prev.assigned_to);
            return exists ? prev : { ...prev, assigned_to: apiUsers[0].id };
          });
        }
      } catch (e) {
        console.warn("Aviso ao carregar utilizadoras:", e);
      } finally {
        setIsLoadingUsers(false);
      }

      // 3.b Restaurar Popup de Alerta de 1h+
      try {
        let savedOvertime: {
          taskId?: string;
          hours?: number;
          emailSent?: boolean;
          recipientEmail?: string;
        } | null = null;
        let savedThresholds: Record<string, number> = {};
        if (typeof window !== "undefined") {
          const rawAlert = localStorage.getItem("pcn_overtime_alert");
          if (rawAlert) {
            savedOvertime = JSON.parse(rawAlert);
          }
          const rawThresh = localStorage.getItem("pcn_overtime_thresholds");
          if (rawThresh) {
            savedThresholds = JSON.parse(rawThresh);
          }
        }

        let savedSilenced: string[] = [];
        try {
          const rawSilenced = localStorage.getItem("pcn_silenced_overtime_tasks");
          if (rawSilenced) savedSilenced = JSON.parse(rawSilenced);
        } catch { }
        const silencedSet = new Set(savedSilenced);

        const overtimeCandidates = loadedTasks.filter((t) => {
          if (t.status !== "in_progress") return false;
          if (silencedSet.has(t.id)) return false;
          const dur = t.total_duration_seconds || 0;
          const userThreshold = savedThresholds[t.id];
          if (userThreshold && userThreshold > dur) return false;
          return (
            dur >= 3600 ||
            (savedOvertime?.taskId && savedOvertime.taskId === t.id)
          );
        });

        if (overtimeCandidates.length > 0) {
          const targetTask =
            (savedOvertime?.taskId &&
              overtimeCandidates.find((t) => t.id === savedOvertime?.taskId)) ||
            overtimeCandidates.find(
              (t) =>
                t.assigned_to === currentUser?.id ||
                t.lawyer_name === currentUser?.name
            ) ||
            overtimeCandidates[0];

          const hoursCount = Math.max(
            1,
            Math.floor((targetTask.total_duration_seconds || 0) / 3600)
          );
          const assignedUser = loadedUsers.find(
            (u) => u.id === targetTask.assigned_to || u.name === targetTask.lawyer_name
          );
          const recipientEmail =
            savedOvertime?.recipientEmail ||
            assignedUser?.email ||
            currentUser?.email ||
            "direcao@pcnadvogadas.pt";

          alertedHoursRef.current[targetTask.id] =
            (hoursCount + 1) * 3600;

          const restoredAlert = {
            task: targetTask,
            hours: hoursCount,
            emailSent: true,
            recipientEmail,
          };
          setOvertimeAlert(restoredAlert);

          if (typeof window !== "undefined") {
            localStorage.setItem(
              "pcn_overtime_alert",
              JSON.stringify({
                taskId: targetTask.id,
                hours: hoursCount,
                emailSent: true,
                recipientEmail,
              })
            );
          }
        } else if (typeof window !== "undefined") {
          localStorage.removeItem("pcn_overtime_alert");
        }
      } catch { }

      // 4. Notas de Honorários (se Direção / Admin)
      const roleToCheck = userRole || currentUser?.role;
      if (isAdminRole(roleToCheck)) {
        try {
          const savedNotes = await getFeeNotesApi(token);
          if (savedNotes && savedNotes.length > 0) {
            const notesMap: Record<string, any> = {};
            const withholdingMap: Record<string, boolean> = {};
            for (const note of savedNotes) {
              if (!notesMap[note.client_id]) {
                notesMap[note.client_id] = note;
                withholdingMap[note.client_id] = parseFloat(note.withholding_rate ?? "0.23") > 0;
              }
              if (Array.isArray(note.items)) {
                for (const item of note.items) {
                  if (item.task_id && item.amount !== undefined && item.amount !== null) {
                    dbPrices[item.task_id] = parseFloat(item.amount);
                  }
                }
              }
            }
            setFeeNotesByClient(notesMap);
            setApplyWithholdingByClient((prev) => ({ ...withholdingMap, ...prev }));
          }
        } catch (e) {
          console.warn("Aviso ao carregar notas de honorários:", e);
        }
      }

      setFeeTaskPrices(dbPrices);
    } finally {
      setIsLoadingApi(false);
    }
  };

  const flushRunningTimersToServer = (tokenToUse?: string | null) => {
    const effectiveToken = tokenToUse || authToken;
    const currentTasks = tasksRef.current;
    const running = currentTasks.filter((t) => t.status === "in_progress");
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("pcn_running_timers");
        const map: Record<string, { seconds: number; updatedAt: number }> = raw
          ? JSON.parse(raw)
          : {};
        const nowMs = Date.now();
        for (const r of running) {
          map[r.id] = { seconds: r.total_duration_seconds || 0, updatedAt: nowMs };
        }
        localStorage.setItem("pcn_running_timers", JSON.stringify(map));
      } catch { }
    }
    if (effectiveToken && running.length > 0) {
      const payload = running.map((t) => ({
        task_id: t.id,
        total_duration_seconds: t.total_duration_seconds || 0,
      }));
      syncTimersApi(effectiveToken, payload, true).catch(() => { });
    }
  };

  const handleLogout = (notice?: string) => {
    flushRunningTimersToServer(authToken);
    if (typeof window !== "undefined") {
      localStorage.removeItem("pcn_session_token");
      localStorage.removeItem("pcn_session_expiry");
      localStorage.removeItem("pcn_session_user");
    }
    setAuthToken(null);
    setSessionExpiry(null);
    setIsAuthenticated(false);
    setApiConnected(false);
    if (notice) {
      setSessionNotice(notice);
    } else {
      setSessionNotice(null);
    }
    setActiveTab("dashboard");
  };

  const buildProfile = (res: any, email: string): UserProfile => {
    const matched = INITIAL_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
    const role = (res.role || "lawyer") as UserProfile["role"];
    return {
      id: res.user_id,
      name:
        res.name ||
        matched?.name ||
        (role === "admin_lawyer" ? "Dr.ª Patrícia" : role === "master" ? "Equipa de TI" : "Advogada Associada"),
      role,
      email,
    };
  };

  const completeLogin = (token: string, userProfile: UserProfile) => {
    const expiry = Date.now() + 60 * 60 * 1000;
    if (typeof window !== "undefined") {
      localStorage.setItem("pcn_session_token", token);
      localStorage.setItem("pcn_session_expiry", expiry.toString());
      localStorage.setItem("pcn_session_user", JSON.stringify(userProfile));
    }
    setAuthToken(token);
    setSessionExpiry(expiry);
    setCurrentUser(userProfile);
    setActiveTab(isAdminRole(userProfile.role) ? "dashboard" : "work");
    setLoginPassword("");
    setIsAuthenticated(true);
    setApiConnected(true);
    loadAllData(token, userProfile.role);
  };

  // Direct login with username/email and password (no 2FA or forced first-login password renewal).
  const routeAuthResponse = async (res: any, email: string) => {
    if (!res.access_token) {
      setLoginError("Resposta inesperada do servidor de autenticação.");
      return;
    }
    const userProfile = buildProfile(res, email);
    completeLogin(res.access_token, userProfile);
  };

  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    setSessionNotice(null);
    try {
      const loginRes = await loginApi(loginEmail, loginPassword);
      await routeAuthResponse(loginRes, loginEmail);
    } catch (err: any) {
      setLoginError(err.message || "Credenciais inválidas ou erro de ligação à base de dados.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Restauração de Sessão no Mount (válida se o ecrã esteve fechado há menos de 1 hora)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedToken = localStorage.getItem("pcn_session_token");
      const savedExpiry = localStorage.getItem("pcn_session_expiry");
      const savedUser = localStorage.getItem("pcn_session_user");

      if (savedToken && savedExpiry && savedUser) {
        const expiryTime = parseInt(savedExpiry, 10);
        if (Date.now() < expiryTime) {
          const profile = JSON.parse(savedUser);
          setAuthToken(savedToken);
          const renewedExpiry = Date.now() + 60 * 60 * 1000;
          localStorage.setItem("pcn_session_expiry", renewedExpiry.toString());
          setSessionExpiry(renewedExpiry);
          keepaliveTokenApi(savedToken)
            .then((res) => {
              if (res?.access_token) {
                setAuthToken(res.access_token);
                localStorage.setItem("pcn_session_token", res.access_token);
              }
            })
            .catch(() => { });
          setCurrentUser(profile);
          setActiveTab(isAdminRole(profile.role) ? "dashboard" : "work");
          setIsAuthenticated(true);
          setApiConnected(true);
          loadAllData(savedToken, profile.role);
        } else {
          localStorage.removeItem("pcn_session_token");
          localStorage.removeItem("pcn_session_expiry");
          localStorage.removeItem("pcn_session_user");
          setSessionNotice(
            "A sua sessão anterior expirou porque a janela esteve fechada por mais de 1 hora. Por favor, autentique-se novamente."
          );
        }
      }
    } catch { }
  }, []);

  // Monitorização em tempo real: sessão contínua com ecrã aberto; expira apenas após >1h com a janela fechada/oculta
  useEffect(() => {
    const handleExpiredEvent = (e: any) => {
      handleLogout(e.detail || "Sessão expirada. Por favor, autentique-se novamente.");
    };
    if (typeof window !== "undefined") {
      window.addEventListener("pcn_session_expired", handleExpiredEvent);
    }

    const CLOSED_GRACE_MS = 60 * 60 * 1000; // 1 hora com a janela fechada

    const checkOrSlideExpiry = () => {
      const storedRaw = localStorage.getItem("pcn_session_expiry");
      const effectiveExpiry = storedRaw ? parseInt(storedRaw, 10) : sessionExpiry;
      if (effectiveExpiry && Date.now() >= effectiveExpiry) {
        handleLogout(
          "A sua sessão expirou porque a janela esteve fechada por mais de 1 hora. Por favor, inicie sessão novamente."
        );
        return false;
      }
      if (typeof document !== "undefined" && document.visibilityState !== "hidden") {
        const nextExpiry = Date.now() + CLOSED_GRACE_MS;
        localStorage.setItem("pcn_session_expiry", nextExpiry.toString());
      }
      return true;
    };

    const handleVisibilityOrClose = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        const closeExpiry = Date.now() + CLOSED_GRACE_MS;
        localStorage.setItem("pcn_session_expiry", closeExpiry.toString());
      } else {
        checkOrSlideExpiry();
      }
    };

    const handleBeforeUnload = () => {
      const closeExpiry = Date.now() + CLOSED_GRACE_MS;
      localStorage.setItem("pcn_session_expiry", closeExpiry.toString());
    };

    if (isAuthenticated && sessionExpiry) {
      window.addEventListener("visibilitychange", handleVisibilityOrClose);
      window.addEventListener("focus", checkOrSlideExpiry);
      window.addEventListener("pagehide", handleBeforeUnload);
      window.addEventListener("beforeunload", handleBeforeUnload);
    }

    const keepaliveInterval =
      isAuthenticated && sessionExpiry
        ? setInterval(() => {
            if (
              authToken &&
              typeof document !== "undefined" &&
              document.visibilityState !== "hidden"
            ) {
              keepaliveTokenApi(authToken)
                .then((res) => {
                  if (res?.access_token) {
                    setAuthToken(res.access_token);
                    localStorage.setItem("pcn_session_token", res.access_token);
                  }
                })
                .catch(() => { });
            }
          }, 15 * 60 * 1000)
        : null;

    if (!isAuthenticated || !sessionExpiry) {
      return () => {
        if (typeof window !== "undefined") {
          window.removeEventListener("pcn_session_expired", handleExpiredEvent);
        }
      };
    }

    const interval = setInterval(() => {
      checkOrSlideExpiry();
    }, 5000);

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("pcn_session_expired", handleExpiredEvent);
      }
      window.removeEventListener("visibilitychange", handleVisibilityOrClose);
      window.removeEventListener("focus", checkOrSlideExpiry);
      window.removeEventListener("pagehide", handleBeforeUnload);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (keepaliveInterval) clearInterval(keepaliveInterval);
      clearInterval(interval);
    };
  }, [isAuthenticated, sessionExpiry]);

  // CRUD de Utilizadores (Adicionar, Alterar, Remover) + Meu Perfil
  const isMaster = currentUser?.role === "master";

  const canManageUser = (u: any) =>
    isAdmin && u.id !== currentUser.id && (isMaster || !isAdminRole(u.role));

  const canEditUser = (u: any) =>
    u.id === currentUser.id || canManageUser(u);

  const [usersFetchedAt, setUsersFetchedAt] = useState(0);
  const isUserLocked = (u: any) =>
    !!u.locked_until && new Date(u.locked_until).getTime() > usersFetchedAt;

  const refreshUsers = async () => {
    if (!authToken) return;
    try {
      const updated = await getUsersApi(authToken);
      if (updated) {
        setUsersList(updated);
        setUsersFetchedAt(Date.now());
      }
    } catch { }
  };

  const runUserAction = async (action: () => Promise<any>, success: string) => {
    try {
      await action();
      await refreshUsers();
      setModalFeedback(success);
      setTimeout(() => setModalFeedback(null), 3500);
    } catch (err: any) {
      alert(err.message || "Não foi possível concluir a operação.");
    }
  };

  const handleToggleUserActive = (u: any) => {
    if (!authToken) return;
    const suspending = u.is_active !== false;
    const question = suspending
      ? `Suspender a conta de ${u.name}? A utilizadora perde o acesso imediatamente.`
      : `Reativar a conta de ${u.name}?`;
    if (!window.confirm(question)) return;
    runUserAction(
      () => updateUserApi(authToken, u.id, { is_active: !suspending }),
      suspending ? `Conta de ${u.name} suspensa.` : `Conta de ${u.name} reativada.`
    );
  };

  const handleUnlockUser = (u: any) => {
    if (!authToken) return;
    runUserAction(() => unlockUserApi(authToken, u.id), `Conta de ${u.name} desbloqueada.`);
  };

  const openEditUserModal = (u: any) => {
    setEditingUser(u);
    setShowEditUserPassword(false);
    setEditUserForm({
      name: u.name || "",
      email: u.email || "",
      role: (u.role || "lawyer") as "master" | "admin_lawyer" | "lawyer",
      password: "",
      is_active: u.is_active !== false,
    });
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSubmittingUser(true);
    try {
      const isSelf = editingUser.id === currentUser.id;
      const payload: {
        name?: string;
        email?: string;
        role?: string;
        is_active?: boolean;
        password?: string;
      } = {
        name: editUserForm.name.trim(),
        email: editUserForm.email.trim().toLowerCase(),
      };
      if (editUserForm.password.trim()) {
        payload.password = editUserForm.password.trim();
      }
      if (isAdmin) {
        payload.role = editUserForm.role;
        if (!isSelf) {
          payload.is_active = editUserForm.is_active;
        }
      }

      if (authToken && apiConnected) {
        const updated = isSelf
          ? await updateMyProfileApi(authToken, payload)
          : await updateUserApi(authToken, editingUser.id, payload);
        if (isSelf && updated) {
          const nextProfile: UserProfile = {
            ...currentUser,
            name: updated.name || payload.name || currentUser.name,
            email: updated.email || payload.email || currentUser.email,
            role: (updated.role as any) || (payload.role as any) || currentUser.role,
          };
          setCurrentUser(nextProfile);
          if (typeof window !== "undefined") {
            localStorage.setItem("pcn_session_user", JSON.stringify(nextProfile));
          }
          if (!isAdminRole(nextProfile.role) && !allowedTabsForLawyer.has(activeTab)) {
            setActiveTab("work");
          }
        }
        await refreshUsers();
      } else {
        setUsersList((prev) =>
          prev.map((x) =>
            x.id === editingUser.id
              ? {
                  ...x,
                  name: payload.name || x.name,
                  email: payload.email || x.email,
                  role: payload.role || x.role,
                  is_active:
                    payload.is_active !== undefined ? payload.is_active : x.is_active,
                }
              : x
          )
        );
        if (isSelf) {
          const nextProfile: UserProfile = {
            ...currentUser,
            name: payload.name || currentUser.name,
            email: payload.email || currentUser.email,
            role: (payload.role as any) || currentUser.role,
          };
          setCurrentUser(nextProfile);
          if (typeof window !== "undefined") {
            localStorage.setItem("pcn_session_user", JSON.stringify(nextProfile));
          }
          if (!isAdminRole(nextProfile.role) && !allowedTabsForLawyer.has(activeTab)) {
            setActiveTab("work");
          }
        }
      }

      addAuditLog(
        "Utilizadora atualizada",
        `${payload.name} (${payload.email})`,
        "Utilizadoras"
      );
      setEditingUser(null);
      setModalFeedback(`Dados de ${payload.name} atualizados com sucesso!`);
      setTimeout(() => setModalFeedback(null), 3500);
    } catch (err: any) {
      alert(err.message || "Erro ao atualizar utilizadora.");
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      if (authToken && apiConnected) {
        await deleteUserApi(authToken, userToDelete.id);
        await refreshUsers();
      } else {
        setUsersList((prev) => prev.filter((x) => x.id !== userToDelete.id));
      }
      addAuditLog(
        "Utilizadora removida",
        `${userToDelete.name} (${userToDelete.email})`,
        "Utilizadoras"
      );
      setModalFeedback(`Utilizadora "${userToDelete.name}" removida com sucesso.`);
      setUserToDelete(null);
      setTimeout(() => setModalFeedback(null), 3500);
    } catch (err: any) {
      alert(err.message || "Erro ao remover utilizadora.");
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingUser(true);
    try {
      if (authToken && apiConnected) {
        await createUserApi(authToken, newUserForm);
        await refreshUsers();
      } else {
        const localUser = {
          id: `usr_${Date.now()}`,
          name: newUserForm.name.trim(),
          email: newUserForm.email.trim().toLowerCase(),
          role: newUserForm.role,
          is_active: true,
        };
        setUsersList((prev) => [...prev, localUser]);
      }
      addAuditLog(
        "Utilizadora criada",
        `${newUserForm.name.trim()} (${newUserForm.email.trim()}) · ${
          ROLE_LABELS[newUserForm.role]
        }`,
        "Utilizadoras"
      );
      setModalFeedback(`Utilizadora "${newUserForm.name.trim()}" criada com sucesso!`);
      setIsNewUserModalOpen(false);
      setShowNewUserPassword(false);
      setNewUserForm({
        name: "",
        email: "",
        role: "lawyer",
        password: "",
      });
      setTimeout(() => setModalFeedback(null), 3500);
    } catch (err: any) {
      alert(err.message || "Erro ao criar utilizadora.");
    } finally {
      setIsSubmittingUser(false);
    }
  };

  // Disparo de Alerta de 1 Hora em Execução (Popup + Som + Notificação + Email)
  const triggerOvertimeAlert = async (task: Task, durationSeconds: number, hoursCount: number) => {
    const assignedUser = usersList.find(
      (u) => u.id === task.assigned_to || u.name === task.lawyer_name
    );
    const recipientEmail = assignedUser?.email || currentUser.email || "direcao@pcnadvogadas.pt";

    // 1. Alerta Sonoro Suave (Web Audio API)
    if (typeof window !== "undefined") {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.18); // A5
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.6);
        }
      } catch { }

      // 2. Notificação Nativa do Browser (se autorizada)
      try {
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(`⏰ Tarefa em andamento há ${hoursCount}h — PCN Advogadas`, {
            body: `${task.title} (${task.client_name}) atingiu ${formatSeconds(durationSeconds)} em execução.`,
          });
        } else if ("Notification" in window && Notification.permission === "default") {
          Notification.requestPermission();
        }
      } catch { }
    }

    // 3. Abre Popup Modal Imediato no Ecrã e Persiste no LocalStorage (para sobreviver a queda de sessão / novo login)
    setOvertimeAlert({
      task: { ...task, total_duration_seconds: durationSeconds },
      hours: hoursCount,
      emailSent: false,
      recipientEmail,
    });
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          "pcn_overtime_alert",
          JSON.stringify({
            taskId: task.id,
            hours: hoursCount,
            emailSent: true,
            recipientEmail,
          })
        );
      } catch { }
    }

    // 4. Envia Email via Backend API
    if (authToken && apiConnected) {
      try {
        const res = await notifyTaskOvertimeApi(task.id, authToken, durationSeconds, recipientEmail);
        const resolvedRecipient = res?.recipient_email || recipientEmail;
        setOvertimeAlert((prev) =>
          prev && prev.task.id === task.id
            ? {
              ...prev,
              emailSent: true,
              recipientEmail: resolvedRecipient,
            }
            : prev
        );
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(
              "pcn_overtime_alert",
              JSON.stringify({
                taskId: task.id,
                hours: hoursCount,
                emailSent: true,
                recipientEmail: resolvedRecipient,
              })
            );
          } catch { }
        }
      } catch (e) {
        console.warn("Aviso ao enviar email de alerta de 1h:", e);
      }
    }
  };

  // 2. Live timer interval (supports multiple concurrent in_progress tasks + 1-hour alert check)
  const hasRunningTasks = tasks.some((t) => t.status === "in_progress");
  useEffect(() => {
    if (!hasRunningTasks && !isTimerRunning) return;
    const interval = setInterval(() => {
      const nowMs = Date.now();
      let localMap: Record<string, { seconds: number; updatedAt: number }> = {};
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("pcn_running_timers");
          if (raw) localMap = JSON.parse(raw);
        } catch { }
      }

      setTasks((prev) => {
        const nextList = prev.map((t) => {
          if (t.status !== "in_progress") return t;
          const nextSec = (t.total_duration_seconds || 0) + 1;
          localMap[t.id] = { seconds: nextSec, updatedAt: nowMs };
          let silencedLiveSet = new Set<string>();
          if (typeof window !== "undefined") {
            try {
              const rawSil = localStorage.getItem("pcn_silenced_overtime_tasks");
              if (rawSil) silencedLiveSet = new Set(JSON.parse(rawSil));
            } catch { }
          }
          const isSilenced = silencedLiveSet.has(t.id) || alertedHoursRef.current[t.id] === Number.MAX_SAFE_INTEGER;
          const nextThreshold = alertedHoursRef.current[t.id] ?? 3600;
          if (!isSilenced && nextThreshold < Number.MAX_SAFE_INTEGER && nextSec >= nextThreshold) {
            const currentHours = Math.max(1, Math.floor(nextSec / 3600));
            alertedHoursRef.current[t.id] = (currentHours + 1) * 3600;
            setTimeout(() => {
              triggerOvertimeAlert(t, nextSec, currentHours);
            }, 0);
          }
          return { ...t, total_duration_seconds: nextSec };
        });

        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("pcn_running_timers", JSON.stringify(localMap));
          } catch { }
        }
        return nextList;
      });
      if (isTimerRunning && activeTaskId) {
        setTimerSeconds((prev) => prev + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [hasRunningTasks, isTimerRunning, activeTaskId, authToken, apiConnected, usersList, currentUser]);

  // 2.b Sincronização automática contínua com o PostgreSQL (a cada 8s + ao fechar/atualizar separador)
  useEffect(() => {
    if (!hasRunningTasks || !authToken || !apiConnected) return;

    const syncInterval = setInterval(() => {
      flushRunningTimersToServer(authToken);
    }, 8000);

    const handleBeforeUnload = () => {
      flushRunningTimersToServer(authToken);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushRunningTimersToServer(authToken);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", handleBeforeUnload);
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      clearInterval(syncInterval);
      if (typeof window !== "undefined") {
        window.removeEventListener("beforeunload", handleBeforeUnload);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [hasRunningTasks, authToken, apiConnected]);

  const removeTaskFromLocalTimers = (taskId: string) => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("pcn_running_timers");
      if (raw) {
        const map = JSON.parse(raw);
        delete map[taskId];
        localStorage.setItem("pcn_running_timers", JSON.stringify(map));
      }
    } catch { }
    try {
      const rawAlert = localStorage.getItem("pcn_overtime_alert");
      if (rawAlert) {
        const parsed = JSON.parse(rawAlert);
        if (parsed?.taskId === taskId) {
          let savedThresholds: Record<string, number> = {};
          try {
            const rawThresh = localStorage.getItem("pcn_overtime_thresholds");
            if (rawThresh) savedThresholds = JSON.parse(rawThresh);
          } catch { }
          const otherOvertime = tasksRef.current.find(
            (t) =>
              t.id !== taskId &&
              t.status === "in_progress" &&
              (t.total_duration_seconds || 0) >= (savedThresholds[t.id] ?? 3600)
          );
          if (otherOvertime) {
            const hoursCount = Math.max(
              1,
              Math.floor((otherOvertime.total_duration_seconds || 0) / 3600)
            );
            localStorage.setItem(
              "pcn_overtime_alert",
              JSON.stringify({
                taskId: otherOvertime.id,
                hours: hoursCount,
                emailSent: true,
                recipientEmail: parsed.recipientEmail || currentUser.email,
              })
            );
          } else {
            localStorage.removeItem("pcn_overtime_alert");
          }
        }
      }
    } catch { }
    setOvertimeAlert((prev) => (prev?.task.id === taskId ? null : prev));
  };

  const handleSilenceOvertimeAlert = () => {
    if (!overtimeAlert) return;
    const taskId = overtimeAlert.task.id;
    alertedHoursRef.current[taskId] = Number.MAX_SAFE_INTEGER;

    if (typeof window !== "undefined") {
      try {
        const rawSilenced = localStorage.getItem("pcn_silenced_overtime_tasks");
        const list: string[] = rawSilenced ? JSON.parse(rawSilenced) : [];
        if (!list.includes(taskId)) list.push(taskId);
        localStorage.setItem("pcn_silenced_overtime_tasks", JSON.stringify(list));

        const rawThresh = localStorage.getItem("pcn_overtime_thresholds");
        const threshMap: Record<string, number> = rawThresh ? JSON.parse(rawThresh) : {};
        threshMap[taskId] = Number.MAX_SAFE_INTEGER;
        localStorage.setItem("pcn_overtime_thresholds", JSON.stringify(threshMap));

        localStorage.removeItem("pcn_overtime_alert");
      } catch { }
    }

    setOvertimeAlert(null);
    setModalFeedback("Alerta de 1 hora silenciado: não voltará a aparecer para esta tarefa.");
    setTimeout(() => setModalFeedback(null), 3500);
  };

  const handleContinueOvertimeTask = () => {
    if (!overtimeAlert) return;
    const taskId = overtimeAlert.task.id;
    const liveTask = tasks.find((t) => t.id === taskId) || overtimeAlert.task;
    const currentSec = liveTask.total_duration_seconds || 3600;
    const nextThreshold = currentSec + 3600; // Reinicia contador de alerta para daqui a +1 hora (3600s)

    alertedHoursRef.current[taskId] = nextThreshold;

    if (typeof window !== "undefined") {
      try {
        const rawThresh = localStorage.getItem("pcn_overtime_thresholds");
        const threshMap: Record<string, number> = rawThresh ? JSON.parse(rawThresh) : {};
        threshMap[taskId] = nextThreshold;
        localStorage.setItem("pcn_overtime_thresholds", JSON.stringify(threshMap));
        localStorage.removeItem("pcn_overtime_alert");
      } catch { }
    }

    setOvertimeAlert(null);
    setModalFeedback("Contador do alerta reiniciado: novo aviso será emitido após mais 1 hora de execução.");
    setTimeout(() => setModalFeedback(null), 3500);
  };

  const formatSeconds = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const saveTaskMetaLocal = (taskId: string, patch: Record<string, any>) => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("pcn_v6_task_meta");
      const map = raw ? JSON.parse(raw) : {};
      map[taskId] = { ...(map[taskId] || {}), ...patch };
      localStorage.setItem("pcn_v6_task_meta", JSON.stringify(map));
    } catch { }
  };

  const saveClientMetaLocal = (clientId: string, patch: Record<string, any>) => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("pcn_v6_client_meta");
      const map = raw ? JSON.parse(raw) : {};
      map[clientId] = { ...(map[clientId] || {}), ...patch };
      localStorage.setItem("pcn_v6_client_meta", JSON.stringify(map));
    } catch { }
  };

  const handleUpdateTaskExpenses = (taskId: string, docExp: number, undocExp: number) => {
    saveTaskMetaLocal(taskId, {
      documented_expenses: docExp,
      undocumented_expenses: undocExp,
    });
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, documented_expenses: docExp, undocumented_expenses: undocExp }
          : t
      )
    );
  };

  const handleStartTimer = async (task: Task) => {
    if (!canWorkOn(task)) { setModalFeedback("Só pode trabalhar nas tarefas atribuídas a si."); setTimeout(() => setModalFeedback(null), 3500); return; }
    let serverDuration = task.total_duration_seconds || 0;
    const isDemoTask = task.id.startsWith("tsk_");
    if (authToken && apiConnected && !isDemoTask) {
      try {
        const updated = await startTimerApi(task.id, authToken);
        if (updated && typeof updated.total_duration_seconds === "number") {
          serverDuration = Math.max(serverDuration, updated.total_duration_seconds);
        }
      } catch (e) {
        console.warn("Aviso ao iniciar cronómetro na API:", e);
      }
    }
    let rawSilencedStart = "";
    if (typeof window !== "undefined") {
      try {
        rawSilencedStart = localStorage.getItem("pcn_silenced_overtime_tasks") || "";
      } catch { }
    }
    const silencedStartList: string[] = rawSilencedStart ? JSON.parse(rawSilencedStart) : [];
    const isSilencedStart = silencedStartList.includes(task.id);

    let nextThreshold: number;
    if (isSilencedStart) {
      nextThreshold = Number.MAX_SAFE_INTEGER;
    } else if (serverDuration < 3600) {
      nextThreshold = 3600;
    } else {
      let rawThresh = "";
      if (typeof window !== "undefined") {
        try {
          rawThresh = localStorage.getItem("pcn_overtime_thresholds") || "";
        } catch { }
      }
      const threshMap: Record<string, number> = rawThresh ? JSON.parse(rawThresh) : {};
      if (threshMap[task.id] && threshMap[task.id] > serverDuration && threshMap[task.id] < Number.MAX_SAFE_INTEGER) {
        nextThreshold = threshMap[task.id];
      } else {
        nextThreshold = (Math.floor(serverDuration / 3600) + 1) * 3600;
        setTimeout(() => {
          triggerOvertimeAlert(task, serverDuration, Math.max(1, Math.floor(serverDuration / 3600)));
        }, 100);
      }
    }

    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("pcn_running_timers");
        const map = raw ? JSON.parse(raw) : {};
        map[task.id] = { seconds: serverDuration, updatedAt: Date.now() };
        localStorage.setItem("pcn_running_timers", JSON.stringify(map));

        const rawThresh = localStorage.getItem("pcn_overtime_thresholds");
        const threshMap: Record<string, number> = rawThresh ? JSON.parse(rawThresh) : {};
        threshMap[task.id] = nextThreshold;
        localStorage.setItem("pcn_overtime_thresholds", JSON.stringify(threshMap));
      } catch { }
    }
    saveTaskMetaLocal(task.id, { v6_status: "Em curso" });
    alertedHoursRef.current[task.id] = nextThreshold;
    setActiveTaskId(task.id);
    setTimerSeconds(serverDuration);
    setIsTimerRunning(true);
    setTasks((prev) =>
      (prev.length > 0 ? prev : DEMO_TASKS).map((t) =>
        t.id === task.id
          ? { ...t, status: "in_progress", v6_status: "Em curso", total_duration_seconds: serverDuration }
          : t
      )
    );
    addAuditLog("Cronómetro iniciado", `${task.title} (${task.client_name})`);
  };

  const handlePauseTimer = async (taskToPause?: Task) => {
    if (taskToPause && !canWorkOn(taskToPause)) { setModalFeedback("Só pode trabalhar nas tarefas atribuídas a si."); setTimeout(() => setModalFeedback(null), 3500); return; }
    const targetId = taskToPause?.id || activeTaskId;
    if (!targetId) return;

    const currentTask = tasks.find((t) => t.id === targetId) || taskToPause;
    let finalSeconds = currentTask?.total_duration_seconds ?? timerSeconds;
    const isDemoTask = targetId.startsWith("tsk_");

    if (authToken && apiConnected && !isDemoTask) {
      try {
        const updated = await pauseTimerApi(targetId, authToken, finalSeconds);
        if (updated && typeof updated.total_duration_seconds === "number") {
          finalSeconds = Math.max(finalSeconds, updated.total_duration_seconds);
        }
      } catch (e) {
        console.warn("Aviso ao pausar cronómetro na API:", e);
      }
    }

    removeTaskFromLocalTimers(targetId);
    saveTaskMetaLocal(targetId, { v6_status: "Pausada" });

    const otherRunning = tasks.find((t) => t.id !== targetId && t.status === "in_progress");
    if (targetId === activeTaskId) {
      if (otherRunning) {
        setActiveTaskId(otherRunning.id);
        setTimerSeconds(otherRunning.total_duration_seconds);
        setIsTimerRunning(true);
      } else {
        setIsTimerRunning(false);
        setTimerSeconds(finalSeconds);
      }
    }

    setTasks((prev) =>
      (prev.length > 0 ? prev : DEMO_TASKS).map((t) =>
        t.id === targetId
          ? { ...t, status: "paused", v6_status: "Pausada", total_duration_seconds: finalSeconds }
          : t
      )
    );
    if (currentTask) {
      addAuditLog("Cronómetro pausado", `${currentTask.title} (${formatSeconds(finalSeconds)})`);
    }
  };

  const handleCompleteTask = async (task: Task) => {
    if (!canWorkOn(task)) { setModalFeedback("Só pode trabalhar nas tarefas atribuídas a si."); setTimeout(() => setModalFeedback(null), 3500); return; }
    const currentTask = tasks.find((t) => t.id === task.id) || task;
    let finalSeconds = currentTask.total_duration_seconds;
    const isDemoTask = task.id.startsWith("tsk_");
    if (authToken && apiConnected && !isDemoTask) {
      try {
        const updated = await completeTaskApi(task.id, authToken, finalSeconds);
        if (updated && typeof updated.total_duration_seconds === "number") {
          finalSeconds = Math.max(finalSeconds, updated.total_duration_seconds);
        }
      } catch (e) {
        console.warn("Aviso ao concluir tarefa na API:", e);
      }
    }
    removeTaskFromLocalTimers(task.id);
    saveTaskMetaLocal(task.id, { v6_status: "Concluída" });
    if (activeTaskId === task.id) {
      const otherRunning = tasks.find((t) => t.id !== task.id && t.status === "in_progress");
      if (otherRunning) {
        setActiveTaskId(otherRunning.id);
        setTimerSeconds(otherRunning.total_duration_seconds);
        setIsTimerRunning(true);
      } else {
        setIsTimerRunning(false);
        setActiveTaskId(null);
      }
    }
    setTasks((prev) =>
      (prev.length > 0 ? prev : DEMO_TASKS).map((t) =>
        t.id === task.id
          ? {
            ...t,
            status: "completed",
            v6_status: "Concluída",
            total_duration_seconds: finalSeconds,
          }
          : t
      )
    );
    addAuditLog("Tarefa concluída", `${task.title} (${task.client_name})`);
  };

  const handleClaimTask = async (task: Task) => {
    if (authToken && apiConnected && !task.id.startsWith("tsk_")) {
      try {
        await claimTaskApi(task.id, authToken);
      } catch (e) {
        console.warn(e);
      }
    }
    setTasks((prev) =>
      (prev.length > 0 ? prev : DEMO_TASKS).map((t) =>
        t.id === task.id
          ? {
            ...t,
            status: "assigned",
            assigned_to: currentUser.id,
            lawyer_name: currentUser.name,
          }
          : t
      )
    );
  };

  const handleArchiveTask = async (task: Task) => {
    if (!isAdmin) { setModalFeedback("Ação reservada à Direção do escritório."); setTimeout(() => setModalFeedback(null), 3500); return; }
    if (authToken && apiConnected && !task.id.startsWith("tsk_")) {
      try {
        await archiveTaskApi(task.id, authToken);
      } catch (e) {
        console.warn("Erro ao arquivar na API:", e);
      }
    }
    removeTaskFromLocalTimers(task.id);
    if (activeTaskId === task.id) {
      setIsTimerRunning(false);
      setActiveTaskId(null);
    }
    setTasks((prev) =>
      (prev.length > 0 ? prev : DEMO_TASKS).map((t) => (t.id === task.id ? { ...t, status: "archived" } : t))
    );
    setModalFeedback("Tarefa movida para o repositório de Tarefas Arquivadas.");
    setTimeout(() => setModalFeedback(null), 3500);
  };

  const handleRestoreTask = async (task: Task) => {
    if (!isAdmin) { setModalFeedback("Ação reservada à Direção do escritório."); setTimeout(() => setModalFeedback(null), 3500); return; }
    if (authToken && apiConnected && !task.id.startsWith("tsk_")) {
      try {
        await restoreTaskApi(task.id, authToken);
      } catch (e) {
        console.warn("Erro ao restaurar na API:", e);
      }
    }
    setTasks((prev) =>
      (prev.length > 0 ? prev : DEMO_TASKS).map((t) => (t.id === task.id ? { ...t, status: "completed" } : t))
    );
    setModalFeedback("Tarefa restaurada com sucesso para o Quadro de Tarefas!");
    setTimeout(() => setModalFeedback(null), 3500);
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    setIsDeletingTask(true);
    try {
      if (authToken && apiConnected && !taskToDelete.id.startsWith("tsk_")) {
        await deleteTaskApi(taskToDelete.id, authToken);
      }
      removeTaskFromLocalTimers(taskToDelete.id);
      if (activeTaskId === taskToDelete.id) {
        setIsTimerRunning(false);
        setActiveTaskId(null);
      }
      setTasks((prev) => (prev.length > 0 ? prev : DEMO_TASKS).filter((t) => t.id !== taskToDelete.id));
      if (selectedTaskForDetails?.id === taskToDelete.id) {
        setSelectedTaskForDetails(null);
      }
      setTaskToDelete(null);
      setModalFeedback("Tarefa eliminada permanentemente.");
      setTimeout(() => setModalFeedback(null), 3500);
    } catch (e: any) {
      alert("Erro ao eliminar tarefa: " + e.message);
    } finally {
      setIsDeletingTask(false);
    }
  };

  const getLawyerNameById = (userId?: string): string => {
    if (!userId || userId === "pool") return "—";
    const found = usersList.find((u) => u.id === userId);
    if (found) return found.name;
    const fallbackMap: Record<string, string> = {
      usr_patricia: "Dr.ª Patrícia",
      usr_ines: "Dr.ª Inês",
      usr_sofia: "Dr.ª Sofia",
    };
    return fallbackMap[userId] || "Advogada";
  };

  const handleAckRedistributionAlert = (alertItem: TaskRedistributionAlert) => {
    const nowIso = new Date().toISOString();
    if (authToken && apiConnected && !alertItem.id.startsWith("redist_")) {
      ackRedistributionNoticeApi(authToken, alertItem.id).catch(() => {});
    }
    setRedistributionAlerts((prev) => {
      const updated = prev.map((a) =>
        a.id === alertItem.id ? { ...a, acknowledgedAt: nowIso } : a
      );
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("pcn_redistribution_alerts", JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });

    addAuditLog(
      "ACK de Tarefa",
      `OK — ${currentUser.name} confirmou receção da informação de tarefa redistribuída: "${alertItem.taskTitle}" (${alertItem.clientName}) · De ${alertItem.fromUserName} para ${alertItem.toUserName}`,
      "Gestão de Tarefas"
    );
  };

  const handleSaveTaskDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskForDetails) return;
    setIsSubmittingDetails(true);
    try {
      const prevAssigneeId = resolveAssigneeValue(selectedTaskForDetails);
      const prevLawyerName =
        selectedTaskForDetails.lawyer_name && selectedTaskForDetails.lawyer_name !== "—"
          ? selectedTaskForDetails.lawyer_name
          : getLawyerNameById(prevAssigneeId);

      const isPool = detailsForm.assigned_to === "pool";
      const wasRedistributed =
        !isPool &&
        prevAssigneeId !== "pool" &&
        prevAssigneeId !== detailsForm.assigned_to;

      const effectiveV6Status: TaskV6Status =
        wasRedistributed && detailsForm.v6_status !== "Concluída"
          ? "Redistribuída"
          : detailsForm.v6_status;

      const mappedBackendStatus = mapV6StatusToBackend(effectiveV6Status);
      const finalStatus: Task["status"] = isPool ? "pool" : mappedBackendStatus;

      const manualDurationSeconds = Math.max(
        0,
        (Number(detailsForm.duration_hours) || 0) * 3600 +
          (Number(detailsForm.duration_minutes) || 0) * 60 +
          (Number(detailsForm.duration_seconds) || 0)
      );

      const waitingState = applyWaitingTransition({
        previousWaitingStartedAt: selectedTaskForDetails.waiting_started_at,
        previousWaitingTotalSeconds: detailsForm.waiting_total_seconds,
        previousWaitingPeriods: detailsForm.waiting_periods,
        previousV6Status: getTaskV6Status(selectedTaskForDetails),
        nextV6Status: effectiveV6Status,
        editedWaitingStartedAt: detailsForm.waiting_started_at,
      });

      const isCustomCat = detailsForm.task_type_id === "__custom__";
      const parsedCustomRate = Math.max(0, parseFloat(detailsForm.custom_rate) || 120);
      const selectedCat: ServiceCategory = isCustomCat
        ? {
            id: `cat_${Date.now()}`,
            name: detailsForm.custom_type_name.trim() || "Serviço Personalizado",
            hourly_rate: parsedCustomRate,
            default_billable: true,
            color: "#92006F",
          }
        : serviceCategories.find((c) => c.id === detailsForm.task_type_id) ||
          serviceCategories[0] || {
            id: selectedTaskForDetails.task_type_id || "tp_1",
            name: selectedTaskForDetails.task_type || "Geral",
            hourly_rate: 120,
            color: "#92006F",
          };

      const selectedClientObj = clients.find((c) => c.id === detailsForm.client_id);

      const metaPayload = {
        v6_status: effectiveV6Status,
        priority: detailsForm.priority,
        request_date: detailsForm.request_date || undefined,
        origin: detailsForm.origin,
        communication_ref: detailsForm.communication_ref.trim(),
        start_date: detailsForm.start_date || undefined,
        entity: detailsForm.entity.trim(),
        process_reference: detailsForm.process_reference.trim(),
        follow_up_date: detailsForm.follow_up_date || undefined,
        waiting_started_at: waitingState.waiting_started_at,
        waiting_total_seconds: waitingState.waiting_total_seconds,
        waiting_periods: waitingState.waiting_periods,
      };

      let updatedFromServer: any = null;
      const isDemoTask = selectedTaskForDetails.id.startsWith("tsk_");
      if (authToken && apiConnected && !isDemoTask) {
        if (isPool) {
          await assignTaskApi(selectedTaskForDetails.id, null, authToken);
        } else {
          await assignTaskApi(selectedTaskForDetails.id, detailsForm.assigned_to, authToken);
        }
        updatedFromServer = await updateTaskApi(selectedTaskForDetails.id, authToken, {
          title: detailsForm.title.trim(),
          description: detailsForm.description,
          client_id: detailsForm.client_id || selectedTaskForDetails.client_id,
          task_type_id: isCustomCat ? undefined : selectedCat.id,
          task_type_name: isCustomCat ? selectedCat.name : undefined,
          hourly_rate: isCustomCat ? selectedCat.hourly_rate : undefined,
          due_date: detailsForm.due_date ? `${detailsForm.due_date}T18:00:00Z` : null,
          is_urgent_deadline: detailsForm.priority === "Urgente",
          status: finalStatus,
          total_duration_seconds: manualDurationSeconds,
          meta: metaPayload,
        });
      }
      if (finalStatus !== "in_progress") {
        removeTaskFromLocalTimers(selectedTaskForDetails.id);
      } else if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("pcn_running_timers");
          const map = raw ? JSON.parse(raw) : {};
          map[selectedTaskForDetails.id] = {
            seconds: manualDurationSeconds,
            updatedAt: Date.now(),
          };
          localStorage.setItem("pcn_running_timers", JSON.stringify(map));
        } catch { }
      }
      if (activeTaskId === selectedTaskForDetails.id) {
        setTimerSeconds(manualDurationSeconds);
      }

      saveTaskMetaLocal(selectedTaskForDetails.id, metaPayload);

      const resolvedLawyerName = isPool
        ? undefined
        : updatedFromServer?.assignee?.name || getLawyerNameById(detailsForm.assigned_to);
      const resolvedClientName =
        updatedFromServer?.client?.name ||
        selectedClientObj?.name ||
        selectedTaskForDetails.client_name;
      const resolvedTaskTypeId = updatedFromServer?.task_type?.id || selectedCat.id;
      const resolvedTaskTypeName = updatedFromServer?.task_type?.name || selectedCat.name;

      setTasks((prev) =>
        (prev.length > 0 ? prev : DEMO_TASKS).map((t) =>
          t.id === selectedTaskForDetails.id
            ? {
                ...t,
                title: detailsForm.title.trim(),
                description: detailsForm.description,
                client_id: detailsForm.client_id || t.client_id,
                client_name: resolvedClientName,
                task_type_id: resolvedTaskTypeId,
                task_type: resolvedTaskTypeName,
                status: finalStatus,
                v6_status: effectiveV6Status,
                priority: detailsForm.priority,
                request_date: metaPayload.request_date,
                origin: metaPayload.origin,
                communication_ref: metaPayload.communication_ref,
                start_date: metaPayload.start_date,
                entity: metaPayload.entity,
                process_reference: metaPayload.process_reference,
                follow_up_date: metaPayload.follow_up_date,
                waiting_started_at: waitingState.waiting_started_at,
                waiting_total_seconds: waitingState.waiting_total_seconds,
                waiting_periods: waitingState.waiting_periods,
                assigned_to: isPool ? undefined : updatedFromServer?.assigned_to || detailsForm.assigned_to,
                lawyer_name: resolvedLawyerName,
                due_date: detailsForm.due_date || undefined,
                total_duration_seconds: manualDurationSeconds,
              }
            : t
        )
      );

      if (wasRedistributed && resolvedLawyerName) {
        if (authToken && apiConnected && !isDemoTask) {
          try {
            await createRedistributionNoticesApi(authToken, {
              task_id: selectedTaskForDetails.id,
              task_title: detailsForm.title,
              client_name: selectedTaskForDetails.client_name,
              from_user_id: prevAssigneeId,
              to_user_id: detailsForm.assigned_to,
            });
            const serverNotices = await getRedistributionNoticesApi(authToken);
            if (Array.isArray(serverNotices)) {
              const mapped = serverNotices.map(mapServerNoticeToAlert);
              setRedistributionAlerts((prev) => {
                const demoLocal = prev.filter((p) => p.id.startsWith("redist_demo_"));
                const next = [...mapped, ...demoLocal];
                if (typeof window !== "undefined") {
                  try {
                    localStorage.setItem("pcn_redistribution_alerts", JSON.stringify(next));
                  } catch {}
                }
                return next;
              });
            }
          } catch {}
        } else {
          const nowStr = new Date().toLocaleString("pt-PT", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          const alertForPrev: TaskRedistributionAlert = {
            id: `redist_demo_${Date.now()}_prev_${Math.random().toString(36).slice(2, 6)}`,
            taskId: selectedTaskForDetails.id,
            taskTitle: detailsForm.title,
            clientName: selectedTaskForDetails.client_name,
            fromUserId: prevAssigneeId,
            fromUserName: prevLawyerName,
            toUserId: detailsForm.assigned_to,
            toUserName: resolvedLawyerName,
            targetUserId: prevAssigneeId,
            targetUserName: prevLawyerName,
            roleInChange: "previous_owner",
            changedBy: currentUser.name,
            createdAt: nowStr,
          };
          const alertForNew: TaskRedistributionAlert = {
            id: `redist_demo_${Date.now()}_new_${Math.random().toString(36).slice(2, 6)}`,
            taskId: selectedTaskForDetails.id,
            taskTitle: detailsForm.title,
            clientName: selectedTaskForDetails.client_name,
            fromUserId: prevAssigneeId,
            fromUserName: prevLawyerName,
            toUserId: detailsForm.assigned_to,
            toUserName: resolvedLawyerName,
            targetUserId: detailsForm.assigned_to,
            targetUserName: resolvedLawyerName,
            roleInChange: "new_owner",
            changedBy: currentUser.name,
            createdAt: nowStr,
          };

          setRedistributionAlerts((prev) => {
            const updated = [alertForNew, alertForPrev, ...prev];
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem("pcn_redistribution_alerts", JSON.stringify(updated));
              } catch {}
            }
            return updated;
          });
        }

        addAuditLog(
          "Tarefa redistribuída",
          `${detailsForm.title} (${selectedTaskForDetails.client_name}) · Redistribuída de ${prevLawyerName} para ${resolvedLawyerName} · Estado: Redistribuída`,
          "Gestão de Tarefas"
        );
      } else {
        addAuditLog(
          "Tarefa atualizada",
          `${detailsForm.title} · Prioridade: ${detailsForm.priority} · Estado: ${effectiveV6Status}`
        );
      }
      setSelectedTaskForDetails(null);
      setModalFeedback(
        wasRedistributed
          ? `Tarefa redistribuída de ${prevLawyerName} para ${resolvedLawyerName}! Alerta enviado às advogadas.`
          : "Detalhes, prioridade, tempo e atribuição da tarefa guardados com sucesso!"
      );
      setTimeout(() => setModalFeedback(null), 4000);
    } catch (err: any) {
      alert("Erro ao atualizar tarefa: " + err.message);
    } finally {
      setIsSubmittingDetails(false);
    }
  };

  const handleExportToCalendar = (type: "google" | "outlook" | "ics") => {
    if (!calcResult) return;
    const title = "Termo de Prazo Processual - Art. 138.º CPC";
    const details = `Cálculo automático de prazo processual com suspensão de férias judiciais (Art. 138.º CPC).
Início / Notificação: ${calcStartDate}
Prazo: ${calcDays} dias
Data Limite sem Multa: ${calcResult.finalDate}
Dias Suspensos por Férias: ${calcResult.suspendedDays} dias
Prática com Multa (Art. 139.º CPC):
- 1.º dia: ${calcResult.penaltyDays[0]}
- 2.º dia: ${calcResult.penaltyDays[1]}
- 3.º dia: ${calcResult.penaltyDays[2]}
PCN Advogadas · Plataforma Forense`;

    let isoDate = "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(calcResult.finalDate)) {
      isoDate = calcResult.finalDate.replace(/-/g, "");
    } else {
      const parts = calcResult.finalDate.split("/");
      if (parts.length === 3) {
        isoDate = `${parts[2]}${parts[1].padStart(2, "0")}${parts[0].padStart(2, "0")}`;
      } else {
        isoDate = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      }
    }

    if (type === "google") {
      const gUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        title
      )}&dates=${isoDate}/${isoDate}&details=${encodeURIComponent(
        details
      )}&location=${encodeURIComponent("Tribunal / Plataforma PCN")}`;
      window.open(gUrl, "_blank");
      setShowCalendarMenu(false);
      return;
    }

    if (type === "outlook") {
      const outDate = `${isoDate.slice(0, 4)}-${isoDate.slice(4, 6)}-${isoDate.slice(6, 8)}`;
      const oUrl = `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${encodeURIComponent(
        title
      )}&startdt=${outDate}T09:00:00&enddt=${outDate}T18:00:00&body=${encodeURIComponent(
        details
      )}&location=${encodeURIComponent("Tribunal")}`;
      window.open(oUrl, "_blank");
      setShowCalendarMenu(false);
      return;
    }

    if (type === "ics") {
      const icsContent = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//PCN Advogadas//Plataforma Forense//PT",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        `UID:${Date.now()}@pcnadvogadas.pt`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
        `DTSTART;VALUE=DATE:${isoDate}`,
        `DTEND;VALUE=DATE:${isoDate}`,
        `SUMMARY:${title}`,
        `DESCRIPTION:${details.replace(/\n/g, "\\n")}`,
        "LOCATION:Tribunal",
        "STATUS:CONFIRMED",
        "BEGIN:VALARM",
        "TRIGGER:-P1D",
        "ACTION:DISPLAY",
        "DESCRIPTION:Lembrete de Prazo Judicial Amanhã - PCN Advogadas",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n");

      const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `prazo-judicial-${isoDate}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowCalendarMenu(false);
      setModalFeedback("Ficheiro .ics descarregado! Toque para adicionar à agenda do iPhone/Outlook.");
      setTimeout(() => setModalFeedback(null), 4000);
    }
  };

  const handleSmartExportToCalendar = () => {
    const p = platformInfo || detectPlatform();
    handleExportToCalendar(p.defaultCalendarType);
  };

  const handleCalculateDeadline = async () => {
    if (authToken && apiConnected) {
      try {
        const res = await calculateDeadlineApi(
          authToken,
          calcStartDate,
          calcDays,
          calcIsUrgent
        );
        setCalcResult({
          finalDate: res.final_deadline,
          suspendedDays: res.suspended_vacation_days,
          penaltyDays: [res.penalty_day_1, res.penalty_day_2, res.penalty_day_3],
        });
        return;
      } catch (e) {
        console.error(e);
      }
    }
    // Fallback display
    setCalcResult({
      finalDate: "07/09/2026",
      suspendedDays: calcIsUrgent ? 0 : 47,
      penaltyDays: ["08/09/2026", "09/09/2026", "10/09/2026"],
    });
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskForm.title.trim()) return;

    const effectiveClientId = newTaskForm.client_id || (clients.length > 0 ? clients[0].id : "");
    if (!effectiveClientId) {
      alert("Por favor, registe um cliente antes de criar tarefas.");
      return;
    }

    setIsSubmittingTask(true);
    try {
      const isCustomCat = newTaskForm.task_type_id === "__custom__";
      const parsedCustomRate = Math.max(0, parseFloat(newTaskForm.custom_rate) || 120);
      const predefinedCat =
        serviceCategories.find((c) => c.id === newTaskForm.task_type_id) ||
        serviceCategories[0] || {
          id: "tp_1",
          name: "Certidões e Registos",
          hourly_rate: 120,
          color: "#92006F",
        };
      const selectedCat: ServiceCategory = isCustomCat
        ? {
            id: `cat_${Date.now()}`,
            name: newTaskForm.custom_type_name.trim() || "Serviço Personalizado",
            hourly_rate: parsedCustomRate,
            default_billable: true,
            color: "#92006F",
          }
        : predefinedCat;

      const isPool = newTaskForm.assigned_to === "pool";
      const selectedClient = clients.find((c) => c.id === effectiveClientId);
      const resolvedLawyerName = isPool
        ? undefined
        : getLawyerNameById(newTaskForm.assigned_to);
      const initialDurationSec = Math.max(
        0,
        (Number(newTaskForm.duration_hours) || 0) * 3600 +
          (Number(newTaskForm.duration_minutes) || 0) * 60 +
          (Number(newTaskForm.duration_seconds) || 0)
      );
      const mappedBackendSt = isPool
        ? "pool"
        : mapV6StatusToBackend(newTaskForm.v6_status);

      const waitingState = applyWaitingTransition({
        previousWaitingStartedAt: null,
        previousWaitingTotalSeconds: newTaskForm.waiting_total_seconds,
        previousWaitingPeriods: newTaskForm.waiting_periods,
        nextV6Status: newTaskForm.v6_status,
        editedWaitingStartedAt: newTaskForm.waiting_started_at,
      });

      const metaPayload = {
        v6_status: newTaskForm.v6_status,
        priority: newTaskForm.priority,
        request_date: newTaskForm.request_date || undefined,
        origin: newTaskForm.origin,
        communication_ref: newTaskForm.communication_ref.trim(),
        start_date: newTaskForm.start_date || undefined,
        entity: newTaskForm.entity.trim(),
        process_reference: newTaskForm.process_reference.trim(),
        follow_up_date: newTaskForm.follow_up_date || undefined,
        waiting_started_at: waitingState.waiting_started_at,
        waiting_total_seconds: waitingState.waiting_total_seconds,
        waiting_periods: waitingState.waiting_periods,
      };

      if (authToken && apiConnected) {
        const created = await createTaskApi(authToken, {
          title: newTaskForm.title.trim(),
          description: newTaskForm.description.trim() || undefined,
          client_id: effectiveClientId,
          task_type_id: selectedCat.id,
          task_type_name: selectedCat.name,
          hourly_rate: selectedCat.hourly_rate,
          assigned_to: isPool ? null : newTaskForm.assigned_to,
          due_date: newTaskForm.due_date ? `${newTaskForm.due_date}T18:00:00Z` : null,
          is_urgent_deadline: newTaskForm.priority === "Urgente",
          publish_to_pool: isPool,
          meta: metaPayload,
        });

        if (created?.task_type?.id) {
          selectedCat.id = created.task_type.id;
          selectedCat.name = created.task_type.name || selectedCat.name;
          if (created.task_type.hourly_rate !== undefined && created.task_type.hourly_rate !== null) {
            selectedCat.hourly_rate = Number(created.task_type.hourly_rate);
          }
        }
        if (
          !serviceCategories.some(
            (c) =>
              c.id === selectedCat.id ||
              c.name.trim().toLowerCase() === selectedCat.name.trim().toLowerCase()
          )
        ) {
          persistCategoriesLocal([...serviceCategories, selectedCat]);
        }

        if (initialDurationSec > 0 || mappedBackendSt !== "assigned") {
          try {
            await updateTaskApi(created.id, authToken, {
              status: mappedBackendSt,
              total_duration_seconds: initialDurationSec,
              meta: metaPayload,
            });
          } catch { }
        }

        saveTaskMetaLocal(created.id, metaPayload);

        const newTask: Task = {
          id: created.id,
          title: created.title,
          description: created.description || "",
          client_id: created.client_id,
          client_name: selectedClient?.name || created.client?.name || "Cliente",
          task_type: selectedCat.name,
          task_type_id: selectedCat.id,
          status: mappedBackendSt,
          v6_status: newTaskForm.v6_status,
          priority: newTaskForm.priority,
          request_date: metaPayload.request_date,
          origin: metaPayload.origin,
          communication_ref: metaPayload.communication_ref,
          start_date: metaPayload.start_date,
          entity: metaPayload.entity,
          process_reference: metaPayload.process_reference,
          follow_up_date: metaPayload.follow_up_date,
          waiting_started_at: waitingState.waiting_started_at,
          waiting_total_seconds: waitingState.waiting_total_seconds,
          waiting_periods: waitingState.waiting_periods,
          assigned_to: isPool ? undefined : created.assigned_to || newTaskForm.assigned_to,
          lawyer_name: isPool ? undefined : created.assignee?.name || resolvedLawyerName,
          due_date: newTaskForm.due_date || undefined,
          total_duration_seconds: initialDurationSec,
        };

        setTasks((prev) => [newTask, ...prev]);
      } else {
        const newId = `tsk_${Date.now()}`;
        saveTaskMetaLocal(newId, metaPayload);
        const newTask: Task = {
          id: newId,
          title: newTaskForm.title.trim(),
          description: newTaskForm.description.trim(),
          client_id: effectiveClientId,
          client_name: selectedClient?.name || "Cliente",
          task_type: selectedCat.name,
          task_type_id: selectedCat.id,
          status: mappedBackendSt,
          v6_status: newTaskForm.v6_status,
          priority: newTaskForm.priority,
          request_date: metaPayload.request_date,
          origin: metaPayload.origin,
          communication_ref: metaPayload.communication_ref,
          start_date: metaPayload.start_date,
          entity: metaPayload.entity,
          process_reference: metaPayload.process_reference,
          follow_up_date: metaPayload.follow_up_date,
          waiting_started_at: waitingState.waiting_started_at,
          waiting_total_seconds: waitingState.waiting_total_seconds,
          waiting_periods: waitingState.waiting_periods,
          assigned_to: isPool ? undefined : newTaskForm.assigned_to,
          lawyer_name: resolvedLawyerName,
          due_date: newTaskForm.due_date || undefined,
          total_duration_seconds: initialDurationSec,
        };
        setTasks((prev) => [newTask, ...prev]);
      }

      addAuditLog(
        "Tarefa criada",
        `${newTaskForm.title.trim()} (${selectedClient?.name || "Cliente"}) · Prioridade: ${newTaskForm.priority}`
      );
      setModalFeedback(`Tarefa criada (${newTaskForm.priority} · ${selectedCat.name})!`);
      setTimeout(() => setModalFeedback(null), 3500);
      setIsNewTaskModalOpen(false);
      setNewTaskForm(buildEmptyTaskForm());
    } catch (err: any) {
      alert("Erro ao criar tarefa: " + err.message);
    } finally {
      setIsSubmittingTask(false);
    }
  };

  // ── CRUD de Categorias de Serviços & Valores (€/h) (Exclusivo Admin) ──
  const openCreateCategoryModal = () => {
    setEditingCategory(null);
    setCategoryForm({
      name: "",
      description: "",
      hourly_rate: 120,
      color: "#92006F",
    });
    setIsCategoryModalOpen(true);
  };

  const openEditCategoryModal = (cat: ServiceCategory) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name,
      description: cat.description || "",
      hourly_rate: cat.hourly_rate,
      color: cat.color || "#92006F",
    });
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = categoryForm.name.trim();
    if (!cleanName) return;
    const cleanRate = Math.max(0, Number(categoryForm.hourly_rate) || 0);
    setIsSubmittingCategory(true);

    try {
      if (editingCategory) {
        let updatedCat: ServiceCategory = {
          ...editingCategory,
          name: cleanName,
          description: categoryForm.description.trim(),
          hourly_rate: cleanRate,
          color: categoryForm.color || "#92006F",
        };
        if (authToken && apiConnected) {
          try {
            const fromApi = await updateTaskTypeApi(authToken, editingCategory.id, {
              name: cleanName,
              description: categoryForm.description.trim() || undefined,
              hourly_rate: cleanRate,
              color: categoryForm.color || "#92006F",
            });
            if (fromApi) {
              updatedCat = {
                ...updatedCat,
                id: fromApi.id || editingCategory.id,
                hourly_rate:
                  fromApi.hourly_rate !== undefined ? Number(fromApi.hourly_rate) : cleanRate,
              };
            }
          } catch (apiErr) {
            console.warn("Aviso ao sincronizar edição de categoria na API:", apiErr);
          }
        }
        const nextList = serviceCategories.map((c) =>
          c.id === editingCategory.id ? updatedCat : c
        );
        persistCategoriesLocal(nextList);

        // Atualiza o nome da categoria nas tarefas associadas caso tenha mudado
        if (editingCategory.name !== cleanName) {
          setTasks((prev) =>
            prev.map((t) =>
              t.task_type_id === editingCategory.id || t.task_type === editingCategory.name
                ? { ...t, task_type: cleanName, task_type_id: updatedCat.id }
                : t
            )
          );
        }
        setModalFeedback(`Serviço "${cleanName}" atualizado (${cleanRate.toFixed(2)} €/h)!`);
      } else {
        let createdCat: ServiceCategory = {
          id: `tp_${Date.now()}`,
          name: cleanName,
          description: categoryForm.description.trim(),
          hourly_rate: cleanRate,
          default_billable: true,
          color: categoryForm.color || "#92006F",
        };
        if (authToken && apiConnected) {
          try {
            const fromApi = await createTaskTypeApi(authToken, {
              name: cleanName,
              description: categoryForm.description.trim() || undefined,
              hourly_rate: cleanRate,
              default_billable: true,
              color: categoryForm.color || "#92006F",
            });
            if (fromApi && fromApi.id) {
              createdCat = {
                id: fromApi.id,
                name: fromApi.name || cleanName,
                description: fromApi.description || categoryForm.description.trim(),
                hourly_rate:
                  fromApi.hourly_rate !== undefined ? Number(fromApi.hourly_rate) : cleanRate,
                default_billable: true,
                color: fromApi.color || categoryForm.color || "#92006F",
              };
            }
          } catch (apiErr) {
            console.warn("Aviso ao criar categoria na API (guardada localmente):", apiErr);
          }
        }
        const nextList = [...serviceCategories, createdCat];
        persistCategoriesLocal(nextList);
        setModalFeedback(`Novo serviço "${cleanName}" (${cleanRate.toFixed(2)} €/h) adicionado!`);
      }
      setTimeout(() => setModalFeedback(null), 3500);
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
    } catch (err: any) {
      alert("Erro ao guardar serviço/categoria: " + err.message);
    } finally {
      setIsSubmittingCategory(false);
    }
  };

  const handleQuickUpdateCategoryRate = async (cat: ServiceCategory, newRate: number) => {
    const cleanRate = Math.max(0, isNaN(newRate) ? 0 : newRate);
    const nextList = serviceCategories.map((c) =>
      c.id === cat.id ? { ...c, hourly_rate: cleanRate } : c
    );
    persistCategoriesLocal(nextList);
    if (authToken && apiConnected) {
      updateTaskTypeApi(authToken, cat.id, { hourly_rate: cleanRate }).catch(() => { });
    }

    // Atualiza dinamicamente os honorários das tarefas associadas a esta categoria e guarda na base
    const nextPrices: Record<string, number> = { ...feeTaskPrices };
    const affectedClients = new Set<string>();
    for (const t of tasks) {
      if (
        t.task_type_id === cat.id ||
        t.task_type.trim().toLowerCase() === cat.name.trim().toLowerCase()
      ) {
        nextPrices[t.id] = calculateFeeFromSeconds(
          t.total_duration_seconds || 0,
          cleanRate,
          billingRoundingMinutes
        );
        if (t.client_id) affectedClients.add(t.client_id);
      }
    }
    setFeeTaskPrices(nextPrices);
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      for (const cId of affectedClients) {
        const useW = applyWithholdingByClient[cId] ?? true;
        saveFeeNoteToDb(cId, nextPrices, useW, true).catch(() => { });
      }
    }, 600);
  };

  const handleDeleteCategory = async (cat: ServiceCategory) => {
    const usedCount = tasks.filter(
      (t) =>
        t.task_type_id === cat.id ||
        t.task_type.trim().toLowerCase() === cat.name.trim().toLowerCase()
    ).length;
    if (usedCount > 0) {
      alert(
        `Não é possível eliminar a categoria "${cat.name}" porque existem ${usedCount} tarefa(s) associadas a este serviço. Pode editar o nome ou o valor (€/h).`
      );
      return;
    }
    if (serviceCategories.length <= 1) {
      alert("Deve existir pelo menos uma categoria de serviço ativa no sistema.");
      return;
    }
    const nextList = serviceCategories.filter((c) => c.id !== cat.id);
    persistCategoriesLocal(nextList);
    if (authToken && apiConnected) {
      deleteTaskTypeApi(authToken, cat.id).catch(() => { });
    }
    setModalFeedback(`Categoria de serviço "${cat.name}" removida com sucesso.`);
    setTimeout(() => setModalFeedback(null), 3500);
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientFormName.trim()) return;

    setIsSubmittingClient(true);
    try {
      const effectiveNum =
        clientFormNumber.trim() || `PCN ${String(clients.length + 1).padStart(4, "0")}`;
      const effectiveBday = clientFormBirthday.trim();

      if (editingClient) {
        saveClientMetaLocal(editingClient.id, {
          number: effectiveNum,
          birthday: effectiveBday,
        });
        setClients((prev) =>
          prev.map((c) =>
            c.id === editingClient.id
              ? {
                  ...c,
                  number: effectiveNum,
                  name: clientFormName.trim(),
                  nif: clientFormNif.trim(),
                  process_reference: clientFormProcess.trim(),
                  email: clientFormEmail.trim(),
                  phone: clientFormPhone.trim(),
                  birthday: effectiveBday,
                  notes: clientFormNotes.trim(),
                }
              : c
          )
        );
        addAuditLog("Cliente atualizado", `${effectiveNum} · ${clientFormName.trim()}`);
        setModalFeedback(`Ficha do cliente "${clientFormName.trim()}" atualizada!`);
      } else if (authToken && apiConnected) {
        const created = await createClientApi(authToken, {
          name: clientFormName.trim(),
          nif: clientFormNif.trim() || undefined,
          process_reference: clientFormProcess.trim() || undefined,
          email: clientFormEmail.trim() || undefined,
          phone: clientFormPhone.trim() || undefined,
          notes: clientFormNotes.trim() || undefined,
        });

        saveClientMetaLocal(created.id, {
          number: effectiveNum,
          birthday: effectiveBday,
        });

        const newClient: Client = {
          id: created.id,
          number: effectiveNum,
          name: created.name,
          nif: created.nif,
          process_reference: created.process_reference,
          email: created.email,
          phone: created.phone,
          birthday: effectiveBday,
          notes: clientFormNotes.trim(),
        };
        setClients((prev) => [...prev, newClient]);
        setNewTaskForm((prev) => (prev.client_id ? prev : { ...prev, client_id: newClient.id }));
        setSelectedFeeClient((prev) => prev || newClient.id);
        addAuditLog("Cliente criado", `${effectiveNum} · ${newClient.name}`);
        setModalFeedback("Novo cliente registado com sucesso!");
      } else {
        const newId = `cli_${Date.now()}`;
        saveClientMetaLocal(newId, {
          number: effectiveNum,
          birthday: effectiveBday,
        });
        const newClient: Client = {
          id: newId,
          number: effectiveNum,
          name: clientFormName.trim(),
          nif: clientFormNif.trim(),
          process_reference: clientFormProcess.trim(),
          email: clientFormEmail.trim(),
          phone: clientFormPhone.trim(),
          birthday: effectiveBday,
          notes: clientFormNotes.trim(),
        };
        setClients((prev) => [...prev, newClient]);
        setNewTaskForm((prev) => (prev.client_id ? prev : { ...prev, client_id: newClient.id }));
        setSelectedFeeClient((prev) => prev || newClient.id);
        addAuditLog("Cliente criado", `${effectiveNum} · ${newClient.name}`);
        setModalFeedback("Novo cliente registado com sucesso!");
      }

      setTimeout(() => setModalFeedback(null), 3500);
      setIsNewClientModalOpen(false);
      setEditingClient(null);
      setClientFormNumber("");
      setClientFormName("");
      setClientFormNif("");
      setClientFormProcess("");
      setClientFormEmail("");
      setClientFormPhone("");
      setClientFormBirthday("");
      setClientFormNotes("");
    } catch (err: any) {
      const errMsg =
        typeof err?.message === "string"
          ? err.message
          : typeof err?.detail === "string"
          ? err.detail
          : typeof err === "string"
          ? err
          : JSON.stringify(err);
      alert("Erro ao registar cliente: " + errMsg);
    } finally {
      setIsSubmittingClient(false);
    }
  };

  const saveInFlightRef = useRef<Promise<any> | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const saveFeeNoteToDb = async (
    clientId?: string,
    overridePrices?: Record<string, number>,
    overrideWithholding?: boolean,
    silent: boolean = false
  ) => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    const targetClientId = clientId || selectedFeeClient || (clients.length > 0 ? clients[0].id : "");
    if (!authToken || !targetClientId) return null;

    if (saveInFlightRef.current) {
      try {
        await saveInFlightRef.current;
      } catch { }
    }

    const pricesSource = overridePrices || feeTaskPrices;
    const useWithholding =
      overrideWithholding !== undefined
        ? overrideWithholding
        : (applyWithholdingByClient[targetClientId] ?? true);

    const clientTasks = tasks.filter((t) => t.client_id === targetClientId);
    const taskIds = clientTasks.map((t) => t.id);
    const taskPricesPayload: Record<string, number> = {};
    for (const t of clientTasks) {
      const val = pricesSource[t.id] ?? (t.fee_amount || 0);
      taskPricesPayload[t.id] = Number.isFinite(val) ? Math.round(val * 100) / 100 : 0;
    }

    setIsSavingFeeNote(true);
    const promise = (async () => {
      try {
        const savedNote = await createFeeNoteDraftApi(authToken, {
          client_id: targetClientId,
          task_ids: taskIds,
          task_prices: taskPricesPayload,
          vat_rate: 0.23,
          withholding_rate: useWithholding ? 0.23 : 0.0,
        });

        if (savedNote) {
          setFeeNotesByClient((prev) => ({
            ...prev,
            [targetClientId]: savedNote,
          }));
          setTasks((prev) =>
            prev.map((t) =>
              t.client_id === targetClientId && taskPricesPayload[t.id] !== undefined
                ? { ...t, fee_amount: taskPricesPayload[t.id] }
                : t
            )
          );
          if (!silent) {
            setModalFeedback(
              `Nota de Honorários (${savedNote.reference_code}) calculada e guardada no PostgreSQL!`
            );
            setTimeout(() => setModalFeedback(null), 3500);
          }
        }
        return savedNote;
      } catch (err: any) {
        if (!silent) {
          alert("Erro ao guardar Nota de Honorários na base de dados: " + err.message);
        } else {
          throw err;
        }
        return null;
      } finally {
        setIsSavingFeeNote(false);
        saveInFlightRef.current = null;
      }
    })();

    saveInFlightRef.current = promise;
    return promise;
  };

  const handleExportExcel = async (internal: boolean) => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    setIsExportingExcel(true);
    try {
      if (authToken) {
        const savedNote = await saveFeeNoteToDb(selectedFeeClient, undefined, undefined, true);
        const noteIdToExport =
          savedNote?.id ||
          feeNotesByClient[selectedFeeClient]?.id ||
          selectedFeeClient ||
          "NH-2026-0001";
        const refCode =
          savedNote?.reference_code ||
          feeNotesByClient[selectedFeeClient]?.reference_code ||
          "NH-2026-0001";
        await downloadFeeNoteExcelApi(authToken, noteIdToExport, internal, refCode);
        setModalFeedback(
          internal
            ? `Excel interno (${refCode}) guardado e descarregado com sucesso!`
            : `Nota de Honorários Excel (${refCode}) guardada e descarregada com sucesso!`
        );
        setTimeout(() => setModalFeedback(null), 3500);
      } else {
        window.open(getExcelExportUrl("NH-2026-0001", internal), "_blank");
      }
    } catch (err: any) {
      alert("Erro ao transferir Excel: " + err.message);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportOfficialPdf = () => {
    if (typeof window === "undefined") return;
    const clientObj = clients.find((c) => c.id === selectedFeeClient);
    const clientTasks = tasks.filter((t) => t.client_id === selectedFeeClient);
    if (!clientObj || clientTasks.length === 0) {
      alert("Selecione um cliente com tarefas registadas para emitir a Nota de Honorários em PDF.");
      return;
    }

    const savedClientNote = feeNotesByClient[selectedFeeClient];
    const refCode = savedClientNote?.reference_code || "NH-2026-0001";
    const issueDate = formatIsoToEuropean(getTodayDateString());
    const useWithholding = applyWithholdingByClient[selectedFeeClient] ?? true;

    let subtotal = 0;
    let totalSeconds = 0;

    const rowsHtml = clientTasks
      .map((t, idx) => {
        const cat = getCategoryForTask(t);
        const catRate = Number(cat.hourly_rate) || 120;
        const suggestedVal = calculateTaskFeeByCategory(t, billingRoundingMinutes);
        const rawPrice =
          feeTaskPrices[t.id] !== undefined ? feeTaskPrices[t.id] : (t.fee_amount ?? suggestedVal);
        const finalPrice = Number.isFinite(rawPrice) ? rawPrice : 0;
        subtotal += finalPrice;
        totalSeconds += t.total_duration_seconds || 0;
        const dateStr = formatIsoToEuropean(t.due_date || getTodayDateString());

        return `
          <tr>
            <td style="padding:10px 12px; border-bottom:1px solid #E6E0D5; color:#444; font-size:11px;">${String(idx + 1).padStart(2, "0")}</td>
            <td style="padding:10px 12px; border-bottom:1px solid #E6E0D5; color:#333; font-size:11px; white-space:nowrap;">${dateStr}</td>
            <td style="padding:10px 12px; border-bottom:1px solid #E6E0D5; font-size:11px;">
              <div style="font-weight:700; color:#141414;">${t.title}</div>
              ${t.description ? `<div style="color:#666; font-size:10px; margin-top:2px;">${t.description}</div>` : ""}
            </td>
            <td style="padding:10px 12px; border-bottom:1px solid #E6E0D5; font-size:11px; color:#92006F; font-weight:600;">${cat.name}</td>
            <td style="padding:10px 12px; border-bottom:1px solid #E6E0D5; font-family:monospace; font-size:11px; text-align:center; color:#222;">${formatSeconds(t.total_duration_seconds || 0)}</td>
            <td style="padding:10px 12px; border-bottom:1px solid #E6E0D5; font-size:11px; text-align:right; color:#555;">${catRate.toFixed(2).replace(".", ",")} €/h</td>
            <td style="padding:10px 12px; border-bottom:1px solid #E6E0D5; font-size:12px; font-weight:700; text-align:right; color:#141414;">${finalPrice.toFixed(2).replace(".", ",")} €</td>
          </tr>
        `;
      })
      .join("");

    const vatAmount = Math.round(subtotal * 0.23 * 100) / 100;
    const withholdingAmount = useWithholding ? Math.round(subtotal * 0.23 * 100) / 100 : 0;
    const totalToPay = Math.round((subtotal + vatAmount - withholdingAmount) * 100) / 100;
    const logoUrl = `${window.location.origin}/logo_pcn.svg`;

    const htmlDoc = `<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8" />
  <title>Nota_Honorarios_${refCode}_${clientObj.name.replace(/\s+/g, "_")}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 16mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      background: #E8E3DA;
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      color: #141414;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 50;
      background: #18181C;
      color: #fff;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 12px rgba(0,0,0,0.18);
    }
    .toolbar-btn {
      background: #92006F;
      color: #fff;
      border: 1px solid #D4AF37;
      padding: 8px 18px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .toolbar-btn-close {
      background: transparent;
      color: #DDD;
      border: 1px solid #555;
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      margin-left: 8px;
    }
    .a4-sheet {
      width: 210mm;
      min-height: 297mm;
      margin: 24px auto;
      background: #FFFFFF;
      padding: 18mm 18mm 16mm 18mm;
      box-shadow: 0 12px 36px rgba(0,0,0,0.14);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    @media print {
      body {
        background: #FFFFFF;
      }
      .toolbar {
        display: none !important;
      }
      .a4-sheet {
        width: 100%;
        min-height: auto;
        margin: 0;
        padding: 0;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div>
      <strong style="font-size:13px; color:#D4AF37;">PCN ADVOGADAS · Documento Oficial A4</strong>
      <span style="font-size:12px; color:#BBB; margin-left:12px;">Ref.ª ${refCode} — ${clientObj.name}</span>
    </div>
    <div>
      <button class="toolbar-btn" onclick="window.print()">Guardar como PDF / Imprimir A4</button>
      <button class="toolbar-btn-close" onclick="window.close()">Fechar</button>
    </div>
  </div>

  <div class="a4-sheet">
    <div>
      <!-- Cabeçalho Institucional -->
      <div style="display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:16px; border-bottom:2px solid #92006F;">
        <div>
          <img src="${logoUrl}" alt="PCN Advogadas" style="height:54px; object-fit:contain;" />
          <div style="font-size:10px; font-weight:700; letter-spacing:1.5px; color:#8C7D6B; text-transform:uppercase; margin-top:4px;">
            Sociedade de Advogadas · Direito Civil, Societário & Forense
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:16px; font-weight:800; color:#92006F; letter-spacing:0.5px;">
            NOTA DE HONORÁRIOS
          </div>
          <div style="font-size:11px; color:#444; margin-top:4px;">
            <strong>Referência:</strong> ${refCode}
          </div>
          <div style="font-size:11px; color:#444;">
            <strong>Data de Emissão:</strong> ${issueDate}
          </div>
        </div>
      </div>

      <!-- Quadro de Identificação do Constituinte / Cliente -->
      <div style="margin-top:20px; background:#FAF8F5; border:1px solid #E2DAD0; border-left:4px solid #D4AF37; border-radius:6px; padding:14px 16px; display:flex; justify-content:space-between; gap:20px;">
        <div>
          <div style="font-size:9px; font-weight:700; text-transform:uppercase; color:#8C7D6B; letter-spacing:1px;">
            Exmo.(a) Constituinte / Cliente
          </div>
          <div style="font-size:14px; font-weight:700; color:#141414; margin-top:3px;">
            ${clientObj.name}
          </div>
          <div style="font-size:11px; color:#555; margin-top:3px;">
            NIF: <strong>${clientObj.nif || "—"}</strong> &nbsp;|&nbsp; Email: ${clientObj.email || "—"}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:9px; font-weight:700; text-transform:uppercase; color:#8C7D6B; letter-spacing:1px;">
            Processo / Dossiê Forense
          </div>
          <div style="font-size:12px; font-weight:700; color:#92006F; margin-top:3px;">
            ${clientObj.process_reference || "Assessoria Jurídica Geral"}
          </div>
          <div style="font-size:11px; color:#555; margin-top:3px;">
            Tempo Total Dedicado: <strong>${formatSeconds(totalSeconds)}</strong>
          </div>
        </div>
      </div>

      <!-- Tabela Discriminada de Serviços Jurídicos -->
      <div style="margin-top:22px;">
        <div style="font-size:10px; font-weight:700; text-transform:uppercase; color:#665F54; letter-spacing:1px; margin-bottom:8px;">
          Discriminação de Atos, Diligências e Serviços Jurídicos Prestados
        </div>
        <table style="width:100%; border-collapse:collapse; border:1px solid #E2DAD0;">
          <thead>
            <tr style="background:#92006F; color:#FFFFFF;">
              <th style="padding:9px 12px; font-size:10px; text-transform:uppercase; text-align:left; width:36px;">#</th>
              <th style="padding:9px 12px; font-size:10px; text-transform:uppercase; text-align:left; width:82px;">Data</th>
              <th style="padding:9px 12px; font-size:10px; text-transform:uppercase; text-align:left;">Ato / Serviço Forense</th>
              <th style="padding:9px 12px; font-size:10px; text-transform:uppercase; text-align:left; width:135px;">Categoria</th>
              <th style="padding:9px 12px; font-size:10px; text-transform:uppercase; text-align:center; width:78px;">Duração</th>
              <th style="padding:9px 12px; font-size:10px; text-transform:uppercase; text-align:right; width:82px;">Tarifa</th>
              <th style="padding:9px 12px; font-size:10px; text-transform:uppercase; text-align:right; width:95px;">Valor (€)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <!-- Quadro de Totais Fiscais -->
      <div style="margin-top:22px; display:flex; justify-content:space-between; align-items:flex-start; gap:24px;">
        <div style="flex:1; font-size:10px; color:#666; line-height:1.5; background:#FAF8F5; border:1px solid #ECE6DB; padding:12px 14px; border-radius:6px;">
          <strong style="color:#333; display:block; margin-bottom:4px;">Notas Fiscais e Condições Forenses:</strong>
          • Valores calculados de acordo com a Tabela de Serviços e Categorias Forenses da sociedade.<br/>
          • IVA aplicável à taxa legal em vigor de 23% (CIVA).<br/>
          ${useWithholding
        ? "• Sujeito a Retenção na Fonte de IRS à taxa de 23%, nos termos do Art. 101.º, n.º 1, alínea b) do CIRS."
        : "• Sem retenção na fonte de IRS (entidade sem contabilidade organizada ou dispensa legal aplicável)."
      }
        </div>

        <div style="width:270px; border:1px solid #D9D1C5; border-radius:6px; overflow:hidden;">
          <div style="padding:8px 14px; display:flex; justify-content:space-between; font-size:11px; border-bottom:1px solid #EFE9DE;">
            <span style="color:#555;">Subtotal de Honorários:</span>
            <strong style="color:#141414;">${subtotal.toFixed(2).replace(".", ",")} €</strong>
          </div>
          <div style="padding:8px 14px; display:flex; justify-content:space-between; font-size:11px; border-bottom:1px solid #EFE9DE;">
            <span style="color:#555;">IVA (23%):</span>
            <strong style="color:#141414;">+${vatAmount.toFixed(2).replace(".", ",")} €</strong>
          </div>
          <div style="padding:8px 14px; display:flex; justify-content:space-between; font-size:11px; border-bottom:1px solid #EFE9DE;">
            <span style="color:#555;">Retenção IRS (${useWithholding ? "23%" : "0%"}):</span>
            <strong style="color:#B91C1C;">-${withholdingAmount.toFixed(2).replace(".", ",")} €</strong>
          </div>
          <div style="padding:11px 14px; background:#FDF2F8; display:flex; justify-content:space-between; font-size:13px; font-weight:800; color:#92006F;">
            <span>TOTAL A PAGAR:</span>
            <span>${totalToPay.toFixed(2).replace(".", ",")} €</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Rodapé Institucional e Assinatura -->
    <div style="margin-top:36px; padding-top:16px; border-top:1px solid #D9D1C5; display:flex; justify-content:space-between; align-items:flex-end; font-size:10px; color:#777;">
      <div>
        <strong style="color:#333;">PCN ADVOGADAS — Sociedade de Advogadas</strong><br/>
        Documento processado pelo Sistema de Gestão Forense PCN · Ref.ª ${refCode}
      </div>
      <div style="text-align:center; width:210px;">
        <div style="border-bottom:1px solid #888; height:28px; margin-bottom:5px;"></div>
        <strong style="color:#333;">A Direção · Dr.ª Patrícia da Costa Neto</strong><br/>
        <span>PCN Advogadas</span>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 350);
    };
  </script>
</body>
</html>`;

    const printWin = window.open("", "_blank");
    if (!printWin) {
      alert("Por favor, permita a abertura de janelas pop-up no seu navegador para gerar o PDF A4 oficial.");
      return;
    }
    printWin.document.open();
    printWin.document.write(htmlDoc);
    printWin.document.close();
  };

  // Sistema Semáforo de Prazos (Verde: >= 6/7 dias | Amarelo: 4 a 5 dias | Vermelho: <= 3 dias ou ultrapassado)
  const getDeadlineInfo = (dueDate?: string) => {
    if (!dueDate) return null;
    const raw = dueDate.split("T")[0];
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
      return null;
    }
    const dueMidnight = new Date(year, month - 1, day);
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round(
      (dueMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24)
    );
    const formattedDate = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;

    if (diffDays < 0) {
      const overdueDays = Math.abs(diffDays);
      return {
        diffDays,
        formattedDate,
        level: "red" as const,
        isOverdue: true,
        badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
        dotClass: "bg-rose-600 animate-pulse",
        label: `Prazo ultrapassado há ${overdueDays} ${overdueDays === 1 ? "dia" : "dias"}`,
      };
    }
    if (diffDays === 0) {
      return {
        diffDays,
        formattedDate,
        level: "red" as const,
        isOverdue: false,
        badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
        dotClass: "bg-rose-600 animate-pulse",
        label: "Vence hoje (Urgente)",
      };
    }
    if (diffDays <= 5) {
      return {
        diffDays,
        formattedDate,
        level: "yellow" as const,
        isOverdue: false,
        badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
        dotClass: "bg-amber-500",
        label: `A vencer em ${diffDays} ${diffDays === 1 ? "dia" : "dias"}`,
      };
    }
    return {
      diffDays,
      formattedDate,
      level: "green" as const,
      isOverdue: false,
      badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
      dotClass: "bg-emerald-500",
      label: `A vencer em ${diffDays} dias`,
    };
  };

  // Metrics calculations (Real-time from tasks & clients)
  const activeTasks = tasks.filter((t) => t.status !== "completed" && t.status !== "archived");
  const archivedTasksCount = tasks.filter((t) => t.status === "archived").length;
  const openTasksCount = activeTasks.length;
  const completedTasksCount = tasks.filter((t) => t.status === "completed").length;
  const poolTasksCount = tasks.filter((t) => t.status === "pool").length;
  const pausedTasksCount = tasks.filter((t) => t.status === "paused").length;

  const activeTasksWithDeadline = activeTasks
    .map((t) => ({ task: t, deadline: getDeadlineInfo(t.due_date) }))
    .filter((item) => item.deadline !== null) as {
      task: Task;
      deadline: NonNullable<ReturnType<typeof getDeadlineInfo>>;
    }[];

  const overdueTasksCount = activeTasksWithDeadline.filter((x) => x.deadline.isOverdue).length;
  const redDeadlineCount = activeTasksWithDeadline.filter((x) => x.deadline.level === "red").length;
  const yellowDeadlineCount = activeTasksWithDeadline.filter((x) => x.deadline.level === "yellow").length;
  const greenDeadlineCount = activeTasksWithDeadline.filter((x) => x.deadline.level === "green").length;

  const activeClientIds = new Set(activeTasks.map((t) => t.client_id).filter(Boolean));
  const unbilledCompletedCount = tasks.filter(
    (t) => t.status === "completed" && (!t.fee_amount || t.fee_amount <= 0)
  ).length;
  const overtimeRunningTasks = tasks.filter(
    (t) => t.status === "in_progress" && (t.total_duration_seconds || 0) >= 3600
  );

  // ── SE NÃO ESTIVER AUTENTICADO: ECRÃ DEDICADO DE LOGIN (BLOQUEIO TOTAL) ──
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col justify-between select-none relative overflow-hidden font-sans">
        {/* Subtle Luxury Glows */}
        <div className="absolute top-0 right-0 w-[550px] h-[550px] bg-[#92006F]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[550px] h-[550px] bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />

        {/* Marca d'água elegante da logo PCN no fundo */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 select-none overflow-hidden">
          <div className="relative w-[550px] sm:w-[850px] md:w-[1100px] lg:w-[1350px] h-[320px] sm:h-[480px] md:h-[620px] opacity-[0.07] transform scale-105">
            <Image
              src="/logo_pcn.svg"
              alt="Marca d'água PCN"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Top Header */}
        <header className="px-6 py-4 sm:px-8 sm:py-5 flex items-center justify-between z-10 border-b border-[#ECE6DB] bg-white/80 backdrop-blur-sm">
          <div className="relative w-40 sm:w-48 h-12">
            <Image src="/logo_pcn.svg" alt="PCN Advogadas" fill className="object-contain" priority />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[11px] font-bold text-[#8C7D6B] tracking-wider uppercase bg-[#FAF8F5] border border-[#ECE6DB] px-3 py-1 rounded-full shadow-2xs">
              Portal Forense Reservado
            </span>
          </div>
        </header>

        {/* Login Form Container */}
        <main className="flex-1 flex items-center justify-center p-4 sm:p-8 z-10">
          <div className="bg-white border border-[#D9D1C5] rounded-2xl shadow-xl max-w-md w-full p-6 sm:p-8 space-y-6 relative">
            <div className="gold-divider-ribbon absolute top-0 left-6 right-6" />

            {/* ── FORMULÁRIO DE LOGIN DIRETO (UTILIZADOR E PALAVRA-PASSE) ── */}
            <div className="text-center pt-2">
              <h1 className="text-xl sm:text-2xl font-bold text-[#141414] tracking-tight">
                PCN Advogadas
              </h1>
              <p className="text-xs text-[#666] mt-1">
                Introduza o seu utilizador (ou e-mail) e palavra-passe para entrar.
              </p>
            </div>

            {sessionNotice && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2.5 shadow-2xs animate-in fade-in">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{sessionNotice}</span>
              </div>
            )}

            {loginError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5 shadow-2xs animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold">Acesso não autorizado</p>
                  <p className="text-[11px] mt-0.5">{loginError}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#444] mb-1.5">
                  Utilizador / E-mail:
                </label>
                <input
                  type="text"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  placeholder="patricia@pcnadvogadas.pt"
                  autoComplete="username"
                  className="w-full text-xs sm:text-sm bg-[#FAF8F5] border border-[#D9D1C5] rounded-xl px-3.5 py-2.5 text-[#141414] focus:outline-none focus:ring-2 focus:ring-[#92006F]/30 focus:border-[#92006F] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#444] mb-1.5">
                  Palavra-passe:
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    className="w-full text-xs sm:text-sm bg-[#FAF8F5] border border-[#D9D1C5] rounded-xl pl-3.5 pr-10 py-2.5 text-[#141414] focus:outline-none focus:ring-2 focus:ring-[#92006F]/30 focus:border-[#92006F] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    tabIndex={-1}
                    title={showLoginPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                    aria-label={showLoginPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}
                    className="absolute right-3 text-[#736B5E] hover:text-[#92006F] transition-colors cursor-pointer p-1"
                  >
                    {showLoginPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-[#92006F] hover:bg-[#7E0060] text-white font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoggingIn ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>A validar credenciais...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Entrar na Plataforma</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </main>

        {/* Footer */}
        <footer className="p-4 sm:p-5 text-center text-xs text-[#888] border-t border-[#ECE6DB] bg-white/60">
          <p className="font-semibold text-[#666]">PCN ADVOGADAS · Sociedade de Advogadas</p>
          <p className="text-[11px] text-[#999] mt-0.5">
            Sistema Integrado de Gestão Jurídica, Prazos e Controlo de Honorários
          </p>
        </footer>
      </div>
    );
  }

  const v6TabMeta: Record<string, { title: string; sub: string }> = {
    dashboard: {
      title: "Painel de Direção",
      sub: "Visão global do escritório · indicadores operacionais, distribuição de trabalho e prazos.",
    },
    work: {
      title: "A Minha Área de Trabalho",
      sub: `Operação diária de ${currentUser.name} · execução de tarefas, cronómetro e agenda.`,
    },
    tasks: {
      title: "Gestão de Tarefas",
      sub: "Registo centralizado em linhas com prioridade, tempo acumulado, estado e responsável.",
    },
    clients: {
      title: "Clientes PCN",
      sub: "Base de clientes do escritório com N.º PCN, processos, contactos e data de aniversário.",
    },
    calendar: {
      title: "Agendas e Prazos",
      sub: "Google Calendar integrado, Aniversários PCN, registos de agenda e calculadora CPC.",
    },
    feenotes: {
      title: "Notas de Honorários",
      sub: "Modelo Editorial V3 · discriminação de tarefas, despesas, IVA 23%, provisões e saldo final.",
    },
    reports: {
      title: "Relatório PCN",
      sub: "Análise de produtividade, distribuição de estados, clientes mais trabalhados e tempo dedicado.",
    },
    attendance: {
      title: "Gestão de Assiduidade",
      sub: "Mapa de Assiduidade das Colaboradoras PCN · resumo individual, resumo geral e exportação.",
    },
    history: {
      title: "Histórico PCN",
      sub: "Registo cronológico de ações, alterações de tarefas, clientes, agenda e assiduidade.",
    },
    services: {
      title: "Tabela de Serviços (€/h)",
      sub: "Configuração administrativa de categorias forenses e tarifas horárias.",
    },
    archived: {
      title: "Tarefas Arquivadas",
      sub: "Repositório de processos e diligências concluídas e arquivadas.",
    },
    users: {
      title: "Utilizadoras & Acessos",
      sub: "Gestão administrativa de contas forenses, níveis de acesso e segurança.",
    },
  };

  const currentMeta = v6TabMeta[activeTab] || v6TabMeta.dashboard;

  // Visível a todas as utilizadoras (do Painel de Direção até Agendas e Prazos)
  const publicNavItems: Array<{
    id: typeof activeTab;
    icon: React.ReactNode;
    label: string;
    badge?: number;
  }> = [
    { id: "dashboard", icon: <Home className="w-[18px] h-[18px]" strokeWidth={1.6} />, label: "Painel de Direção" },
    { id: "work", icon: <Briefcase className="w-[18px] h-[18px]" strokeWidth={1.6} />, label: "A Minha Área de Trabalho" },
    { id: "tasks", icon: <ClipboardCheck className="w-[18px] h-[18px]" strokeWidth={1.6} />, label: "Gestão de Tarefas" },
    { id: "clients", icon: <Users className="w-[18px] h-[18px]" strokeWidth={1.6} />, label: "Clientes PCN" },
    { id: "calendar", icon: <CalendarDays className="w-[18px] h-[18px]" strokeWidth={1.6} />, label: "Agendas e Prazos" },
  ];

  // Grupo exclusivo "Gestão PCN" (visível apenas a Direção / Admin)
  const gestaoPcnNavItems: Array<{
    id: typeof activeTab;
    icon: React.ReactNode;
    label: string;
    badge?: number;
  }> = [
    { id: "feenotes", icon: <FileText className="w-[18px] h-[18px]" strokeWidth={1.6} />, label: "Notas de Honorários" },
    { id: "reports", icon: <BarChart3 className="w-[18px] h-[18px]" strokeWidth={1.6} />, label: "Relatório PCN" },
    { id: "attendance", icon: <ClipboardList className="w-[18px] h-[18px]" strokeWidth={1.6} />, label: "Gestão de Assiduidade" },
    { id: "services", icon: <Settings className="w-[18px] h-[18px]" strokeWidth={1.6} />, label: "Tabela de Serviços (€/h)" },
    { id: "archived", icon: <Archive className="w-[18px] h-[18px]" strokeWidth={1.6} />, label: "Tarefas Arquivadas", badge: archivedTasksCount },
    { id: "users", icon: <UserCog className="w-[18px] h-[18px]" strokeWidth={1.6} />, label: "Utilizadoras & Acessos" },
    { id: "history", icon: <History className="w-[18px] h-[18px]" strokeWidth={1.6} />, label: "Histórico PCN" },
  ];

  const isGestaoChildActive = gestaoPcnNavItems.some((item) => item.id === activeTab);

  const renderSidebarNavContent = () => (
    <>
      {publicNavItems.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => switchTab(item.id)}
          className={activeTab === item.id ? "active" : ""}
        >
          <span className="ico">{item.icon}</span>
          <span className="flex-1 text-left">{item.label}</span>
          {item.badge !== undefined && item.badge > 0 && (
            <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">
              {item.badge}
            </span>
          )}
        </button>
      ))}

      {isAdmin && (
        <div className="mt-2 pt-2 border-t border-white/15">
          <button
            type="button"
            onClick={() => setIsGestaoPcnOpen((prev) => !prev)}
            className={isGestaoChildActive && !isGestaoPcnOpen ? "active" : ""}
          >
            <span className="ico"><Landmark className="w-[18px] h-[18px]" strokeWidth={1.6} /></span>
            <span className="flex-1 text-left font-semibold">Gestão PCN</span>
            <ChevronDown
              className={`w-4 h-4 text-[#f6dc9b] transition-transform ${
                isGestaoPcnOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {isGestaoPcnOpen && (
            <div className="v6-nav-group-sub mt-0.5">
              {gestaoPcnNavItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => switchTab(item.id)}
                  className={activeTab === item.id ? "active" : ""}
                >
                  <span className="ico">{item.icon}</span>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );

  const effectiveClients = clients;
  const effectiveTasks = tasks;
  const effectiveUsers = usersList && usersList.length > 0 ? usersList : INITIAL_USERS;
  const unifiedEvents = buildUnifiedEvents(events, effectiveTasks, effectiveClients);

  const filteredClientsList = effectiveClients.filter((c) => {
    const q = (globalQuery || clientSearchQuery).trim().toLowerCase();
    if (!q) return true;
    return (
      (c.number || "").toLowerCase().includes(q) ||
      (c.name || "").toLowerCase().includes(q) ||
      (c.nif || "").toLowerCase().includes(q) ||
      (c.process_reference || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.phone || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="v6-app">
      {/* ── GAVETA LATERAL MOBILE (DRAWER V6) ── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside className="v6-side v6-side-drawer relative z-10 w-72 max-w-[85vw] h-full overflow-y-auto">
            <div className="v6-brand relative">
              <img src="/logo_pcn_transparent.png" alt="PCN Advogadas" />
              <div className="v6-sub">GESTÃO DO ESCRITÓRIO</div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="absolute top-2 right-2 text-[#640943] hover:text-black p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="v6-nav">{renderSidebarNavContent()}</nav>
            <div className="v6-side-foot">
              <div className="label">Sessão ativa</div>
              <div className="font-bold text-sm text-white">{currentUser.name}</div>
              <div className="text-[11px] text-white/75 mb-2.5">
                {ROLE_LABELS[currentUser.role] || "Advogada"}
              </div>
              <div className="flex flex-col gap-1.5">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      openEditUserModal(currentUser);
                    }}
                    className="w-full py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <span>⚙ Meu Perfil</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleLogout()}
                  className="w-full py-2 px-3 rounded-lg bg-white/12 hover:bg-white/20 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Terminar Sessão</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── SIDEBAR DESKTOP V6.0 ── */}
      <aside className="v6-side v6-side-desktop hidden lg:flex">
        <div className="v6-brand">
          <img src="/logo_pcn_transparent.png" alt="PCN Advogadas" />
          <div className="v6-sub">GESTÃO DO ESCRITÓRIO</div>
        </div>

        <nav className="v6-nav">{renderSidebarNavContent()}</nav>

        <div className="v6-side-foot">
          <div className="label">Sessão ativa</div>
          <div className="font-bold text-sm text-white">{currentUser.name}</div>
          <div className="text-[11px] text-white/75 mb-2.5">
            {ROLE_LABELS[currentUser.role] || "Advogada"} · {currentUser.email}
          </div>
          <div className="flex flex-col gap-1.5">
            {isAdmin && (
              <button
                type="button"
                onClick={() => openEditUserModal(currentUser)}
                className="w-full py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <span>⚙ Meu Perfil</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleLogout()}
              className="w-full py-2 px-3 rounded-lg bg-white/12 hover:bg-white/20 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Terminar Sessão</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── ÁREA PRINCIPAL V6.0 ── */}
      <main className="v6-main flex-1 min-w-0">
        {/* TOP HEADER V6.0 */}
        <header className="v6-top">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-[#e3d9d5] bg-white text-[#59083e] cursor-pointer mt-0.5"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1>{currentMeta.title}</h1>
              <p>{currentMeta.sub}</p>
            </div>
          </div>

          <div className="v6-top-right">
            <div className="v6-search">
              <span>🔎</span>
              <input
                type="text"
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
                placeholder="Pesquisar clientes, tarefas, processos, compromissos, colaboradores..."
              />
              {globalQuery && (
                <button
                  type="button"
                  onClick={() => setGlobalQuery("")}
                  className="text-xs text-[#736872] hover:text-[#28202a] cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sininho de Notificações de Tarefas Redistribuídas (🔔) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotifDropdownOpen((prev) => !prev)}
                className="v6-btn relative py-2 px-2.5"
                title="Notificações de Tarefas Redistribuídas"
              >
                <Bell className="w-4 h-4 text-[#59083e]" />
                {myPendingRedistAlerts.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#9b2226] text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                    {myPendingRedistAlerts.length}
                  </span>
                )}
              </button>

              {isNotifDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white border border-[#e5d8d0] shadow-xl z-50 p-3 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-[#f0eae6] pb-2">
                    <strong className="text-xs text-[#59083e] uppercase tracking-wider">
                      🔔 Notificações de Tarefas ({myRecentRedistAlerts.length})
                    </strong>
                    <button
                      type="button"
                      onClick={() => setIsNotifDropdownOpen(false)}
                      className="text-xs text-[#776f73] hover:text-[#28202a] cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {myRecentRedistAlerts.length === 0 ? (
                    <p className="text-xs text-[#776f73] py-4 text-center">
                      Sem alertas de redistribuição registados para {currentUser.name}.
                    </p>
                  ) : (
                    <div className="max-h-72 overflow-y-auto divide-y divide-[#f0eae6] text-xs">
                      {myRecentRedistAlerts.map((al) => (
                        <div key={al.id} className="py-2.5 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="v6-badge redist text-[10px]! py-0.5! px-2!">
                              Tarefa Redistribuída
                            </span>
                            <span className="text-[10px] text-[#776f73]">
                              {al.createdAt}
                            </span>
                          </div>
                          <div className="font-semibold text-[#28202a]">
                            {al.taskTitle} ({al.clientName})
                          </div>
                          <div className="text-[11px] text-[#6d5d66]">
                            De <strong>{al.fromUserName}</strong> para{" "}
                            <strong>{al.toUserName}</strong>
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            {al.acknowledgedAt ? (
                              <span className="text-[10.5px] text-[#326421] font-semibold">
                                ✓ Confirmado (ACK OK)
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAckRedistributionAlert(al)}
                                className="v6-btn primary sm"
                              >
                                OK
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setIsNotifDropdownOpen(false);
                                switchTab("tasks");
                              }}
                              className="text-[11px] text-[#92006f] font-semibold hover:underline cursor-pointer"
                            >
                              Ver tarefa ›
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {isAdmin && (
              <button type="button" className="v6-btn ghost" onClick={openNewClientModal}>
                + Cliente
              </button>
            )}
            <button
              type="button"
              className="v6-btn primary"
              onClick={() => openNewTaskModal()}
            >
              + Nova tarefa
            </button>
          </div>
        </header>

        {/* CONTEÚDO DA ABA ATIVA */}
        <section className="v6-view">
          {/* 1, 2 & 3: PAINEL DE DIREÇÃO / A MINHA ÁREA DE TRABALHO / GESTÃO DE TAREFAS */}
          {(activeTab === "dashboard" || activeTab === "work" || activeTab === "tasks") && (
            <WorkspaceV6Tab
              mode={activeTab}
              currentUser={currentUser}
              isAdmin={isAdmin}
              tasks={effectiveTasks.filter((t) => t.status !== "archived")}
              clients={effectiveClients}
              usersList={effectiveUsers}
              events={unifiedEvents}
              auditLogs={auditLogs}
              globalQuery={globalQuery}
              formatSeconds={formatSeconds}
              canWorkOn={canWorkOn}
              onStartTimer={handleStartTimer}
              onPauseTimer={handlePauseTimer}
              onCompleteTask={handleCompleteTask}
              onOpenTaskDetails={openTaskDetails}
              onDeleteTask={confirmDeleteTask}
              onOpenNewTaskModal={() => openNewTaskModal()}
              onOpenNewTaskForClient={(cid) => openNewTaskModal(cid)}
              onOpenNewClientModal={openNewClientModal}
              onOpenNewEventModal={(type) => openQuickEventModal(type)}
              onEditEvent={openEditEventFromAnyTab}
              onDeleteEvent={handleDeleteEventFromAnyTab}
              onSwitchTab={(tab) => switchTab(tab as any)}
              archivedCount={archivedTasksCount}
            />
          )}

          {/* 4: CLIENTES PCN */}
          {activeTab === "clients" && (
            <div className="v6-card">
              <div className="v6-section-head">
                <div>
                  <h3>Clientes PCN</h3>
                  <p>
                    Registo cadastral de clientes com N.º PCN, NIF, contactos, data de aniversário e
                    estado das tarefas associadas.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                    placeholder="Filtrar por nome, N.º PCN ou NIF..."
                    className="px-3 py-2 rounded-[10px] border border-[#ddd1cc] bg-white text-xs w-full sm:w-60"
                  />
                  <button
                    type="button"
                    className="v6-btn primary"
                    onClick={openNewClientModal}
                  >
                    + Novo cliente
                  </button>
                </div>
              </div>

              <div className="v6-table-wrap">
                <table className="v6-table">
                  <thead>
                    <tr>
                      <th>N.º PCN</th>
                      <th>Nome / Designação</th>
                      <th>NIF</th>
                      <th>Contacto</th>
                      <th>Aniversário</th>
                      <th>Tarefas</th>
                      <th className="text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClientsList.length === 0 ? (
                      <tr>
                        <td colSpan={7}>
                          <div className="v6-empty">Nenhum cliente encontrado.</div>
                        </td>
                      </tr>
                    ) : (
                      filteredClientsList.map((c, idx) => {
                        const cTasks = effectiveTasks.filter(
                          (t) => t.client_id === c.id && t.status !== "archived"
                        );
                        const breakdown = getClientTaskStatusBreakdown(cTasks);
                        const totalSec = cTasks.reduce(
                          (acc, t) => acc + (t.total_duration_seconds || 0),
                          0
                        );
                        const h = Math.floor(totalSec / 3600);
                        const m = Math.floor((totalSec % 3600) / 60);
                        return (
                          <tr key={c.id}>
                            <td>
                              <span className="v6-badge wait">
                                {c.number || `PCN ${String(idx + 1).padStart(4, "0")}`}
                              </span>
                            </td>
                            <td>
                              <strong className="text-[#28202a]">{c.name}</strong>
                              {c.notes && (
                                <div className="v6-muted text-xs mt-0.5">{c.notes}</div>
                              )}
                            </td>
                            <td className="font-mono text-xs">{c.nif || "—"}</td>
                            <td>
                              <div className="text-xs">{c.email || "—"}</div>
                              <div className="v6-muted text-xs">{c.phone || ""}</div>
                            </td>
                            <td>
                              {c.birthday ? (
                                <span className="v6-badge bday">
                                  🎂 {c.birthday.split("-").reverse().join("/")}
                                </span>
                              ) : (
                                <span className="v6-muted text-xs">—</span>
                              )}
                            </td>
                            <td>
                              {cTasks.length === 0 ? (
                                <span className="v6-muted text-xs">Sem tarefas registadas</span>
                              ) : (
                                <>
                                  <div className="text-xs font-semibold text-[#28202a]">
                                    {breakdown.parts.join(" / ")}
                                  </div>
                                  <div className="v6-muted text-[11px] mt-0.5">
                                    Total: {cTasks.length} tarefa(s) · {h}h {String(m).padStart(2, "0")}m
                                  </div>
                                </>
                              )}
                            </td>
                            <td className="text-right">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  className="v6-btn sm primary"
                                  onClick={() => openNewTaskModal(c.id)}
                                  title="Criar nova tarefa associada a este cliente"
                                >
                                  + Tarefa
                                </button>
                                <button
                                  type="button"
                                  className="v6-btn sm"
                                  onClick={() => openEditClientModal(c)}
                                >
                                  Editar
                                </button>
                                {isAdmin && (
                                  <button
                                    type="button"
                                    className="v6-btn sm gold"
                                    onClick={() => {
                                      setSelectedFeeClient(c.id);
                                      switchTab("feenotes");
                                    }}
                                  >
                                    Nota Honorários
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5: AGENDAS E PRAZOS (COM GOOGLE CALENDAR EMBED + ANIVERSÁRIOS PCN) */}
          {activeTab === "calendar" && (
            <CalendarV6Tab
              events={unifiedEvents}
              clients={effectiveClients}
              usersList={effectiveUsers}
              globalQuery={globalQuery}
              onSaveEvent={async (evt, isEdit) => {
                const cleanEvt: CalendarEvent = {
                  ...evt,
                  type: normalizeEventType(evt.type),
                };
                if (cleanEvt.id.startsWith("task_deadline_")) {
                  const taskId = cleanEvt.id.replace("task_deadline_", "");
                  const cleanTitle = cleanEvt.title.replace(/^Prazo\s*[—-]\s*/i, "").trim();
                  const matchedOwner = effectiveUsers.find(
                    (u) =>
                      u.id === cleanEvt.owner ||
                      u.name.toLowerCase() === (cleanEvt.owner || "").toLowerCase()
                  );
                  setTasks((prev) =>
                    (prev.length > 0 ? prev : DEMO_TASKS).map((t) =>
                      t.id === taskId
                        ? {
                            ...t,
                            title: cleanTitle || t.title,
                            due_date: cleanEvt.date,
                            assigned_to: matchedOwner ? matchedOwner.id : t.assigned_to,
                            lawyer_name: matchedOwner ? matchedOwner.name : t.lawyer_name,
                          }
                        : t
                    )
                  );
                  if (authToken && apiConnected && !taskId.startsWith("tsk_")) {
                    updateTaskApi(taskId, authToken, {
                      title: cleanTitle || undefined,
                      due_date: `${cleanEvt.date}T18:00:00`,
                    }).catch(() => {});
                  }
                } else {
                  let savedEvt = cleanEvt;
                  if (authToken && apiConnected) {
                    const isLocalId = cleanEvt.id.startsWith("ev_") || cleanEvt.id.startsWith("evt_");
                    try {
                      if (isEdit && !isLocalId) {
                        const updatedEv = await updateEventApi(authToken, cleanEvt.id, {
                          title: cleanEvt.title,
                          description: cleanEvt.subtitle || "",
                          starts_at: `${cleanEvt.date}T${cleanEvt.time || "10:00"}:00Z`,
                          owner_id: cleanEvt.owner,
                          location: cleanEvt.type,
                          is_deadline: cleanEvt.type === "Prazo",
                        });
                        if (updatedEv?.id) savedEvt = mapApiEventToCalendarEvent(updatedEv);
                      } else {
                        const createdEv = await createEventApi(authToken, {
                          title: cleanEvt.title,
                          description: cleanEvt.subtitle || undefined,
                          starts_at: `${cleanEvt.date}T${cleanEvt.time || "10:00"}:00Z`,
                          owner_id: cleanEvt.owner,
                          location: cleanEvt.type,
                          is_deadline: cleanEvt.type === "Prazo",
                        });
                        if (createdEv?.id) savedEvt = { ...cleanEvt, id: createdEv.id };
                      }
                    } catch (err) {
                      console.warn("Aviso ao guardar evento da agenda na API:", err);
                    }
                  }
                  const exists = events.some((x) => x.id === cleanEvt.id);
                  const next =
                    isEdit && exists
                      ? events.map((x) => (x.id === cleanEvt.id ? savedEvt : x))
                      : [savedEvt, ...events];
                  updateEvents(next);
                }
                setGoogleCalendarPromptEvent(cleanEvt);
                addAuditLog(
                  isEdit ? "Agenda editada" : "Agenda criada",
                  `${cleanEvt.type}: ${cleanEvt.title} (${cleanEvt.date})`,
                  "Agendas e Prazos"
                );
              }}
              onDeleteEvent={handleDeleteEventFromAnyTab}
              onEditClientBirthday={(c) => openEditClientModal(c)}
              onOpenNewEventModal={(type) => openQuickEventModal(type)}
              onEditEvent={(evt) => openEditEventFromAnyTab(evt)}
            />
          )}

          {/* 6: NOTAS DE HONORÁRIOS (MODELO EDITORIAL V3-3 PDF + EXCEL) */}
          {activeTab === "feenotes" && isAdmin && (
            <FeeNotesV6Tab
              clients={effectiveClients}
              tasks={effectiveTasks.filter((t) => t.status !== "archived")}
              serviceCategories={serviceCategories}
              selectedFeeClient={selectedFeeClient || effectiveClients[0]?.id || ""}
              setSelectedFeeClient={setSelectedFeeClient}
              feeTaskPrices={feeTaskPrices}
              setFeeTaskPrices={setFeeTaskPrices}
              feeNotesByClient={feeNotesByClient}
              calculateTaskFeeByCategory={calculateTaskFeeByCategory}
              billingRoundingMinutes={billingRoundingMinutes}
              updateBillingRounding={updateBillingRounding}
              saveFeeNoteToDb={saveFeeNoteToDb}
              handleExportExcel={handleExportExcel}
              isExportingExcel={isExportingExcel}
              onSwitchTab={(tab) => switchTab(tab as any)}
              onAudit={(action, area, detail) => addAuditLog(action, detail, area)}
              onFeedback={(msg) => {
                setModalFeedback(msg);
                setTimeout(() => setModalFeedback(null), 3500);
              }}
            />
          )}

          {/* 7: RELATÓRIO PCN (ADMIN / DIREÇÃO) */}
          {activeTab === "reports" && isAdmin && (
            <div>
              <div className="v6-grid-4">
                <div className="v6-card v6-metric">
                  <div>
                    <div className="label">Clientes registados</div>
                    <div className="num">{effectiveClients.length}</div>
                    <div className="foot">Base total de clientes</div>
                  </div>
                  <div className="v6-circle">◈</div>
                </div>
                <div className="v6-card v6-metric">
                  <div>
                    <div className="label">Tarefas totais</div>
                    <div className="num">{effectiveTasks.filter((t) => t.status !== "archived").length}</div>
                    <div className="foot">Registos operacionais</div>
                  </div>
                  <div className="v6-circle">✓</div>
                </div>
                <div className="v6-card v6-metric">
                  <div>
                    <div className="label">Concluídas</div>
                    <div className="num">
                      {
                        effectiveTasks.filter(
                          (t) => t.status !== "archived" && getTaskV6Status(t) === "Concluída"
                        ).length
                      }
                    </div>
                    <div className="foot">Trabalho fechado</div>
                  </div>
                  <div className="v6-circle">★</div>
                </div>
                <div className="v6-card v6-metric">
                  <div>
                    <div className="label">Tempo registado</div>
                    <div className="num text-[24px]!">
                      {(() => {
                        const sec = effectiveTasks.reduce(
                          (acc, t) => acc + (t.total_duration_seconds || 0),
                          0
                        );
                        return `${Math.floor(sec / 3600)}h ${String(
                          Math.floor((sec % 3600) / 60)
                        ).padStart(2, "0")}m`;
                      })()}
                    </div>
                    <div className="foot">Soma de todas as tarefas</div>
                  </div>
                  <div className="v6-circle">⏱</div>
                </div>
              </div>

              <div className="v6-grid-2">
                <div className="v6-card">
                  <div className="v6-section-head">
                    <div>
                      <h3>Produtividade por membro</h3>
                      <p>Total de tarefas, estados e tempo acumulado por colaboradora</p>
                    </div>
                  </div>
                  <div className="v6-table-wrap">
                    <table className="v6-table">
                      <thead>
                        <tr>
                          <th>Membro</th>
                          <th>Total</th>
                          <th>Em curso</th>
                          <th>Concluídas</th>
                          <th>Horas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {effectiveUsers.map((u) => {
                          const list = effectiveTasks.filter(
                            (t) =>
                              t.status !== "archived" &&
                              (t.assigned_to === u.id ||
                                (t.lawyer_name &&
                                  u.name.toLowerCase().includes(t.lawyer_name.toLowerCase())))
                          );
                          const sec = list.reduce(
                            (acc, t) => acc + (t.total_duration_seconds || 0),
                            0
                          );
                          return (
                            <tr key={u.id}>
                              <td>
                                <strong>{u.name}</strong>
                                <div className="v6-muted text-xs">
                                  {ROLE_LABELS[u.role] || "Advogada"}
                                </div>
                              </td>
                              <td>{list.length}</td>
                              <td>
                                {list.filter((t) => getTaskV6Status(t) === "Em curso").length}
                              </td>
                              <td>
                                {list.filter((t) => getTaskV6Status(t) === "Concluída").length}
                              </td>
                              <td className="font-mono font-bold">
                                {Math.floor(sec / 3600)}h{" "}
                                {String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}m
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="v6-card">
                  <div className="v6-section-head">
                    <div>
                      <h3>Distribuição por estado</h3>
                      <p>Estado atual do fluxo de trabalho</p>
                    </div>
                  </div>
                  <div className="v6-list">
                    {V6_STATUS_LIST.map((st) => {
                      const count = effectiveTasks.filter(
                        (t) => t.status !== "archived" && getTaskV6Status(t) === st
                      ).length;
                      return (
                        <div
                          key={st}
                          className="v6-item flex justify-between items-center"
                        >
                          <strong>{st}</strong>
                          <span className={getV6BadgeClass(st)}>{count} tarefa(s)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="v6-card">
                <div className="v6-section-head">
                  <div>
                    <h3>Clientes mais trabalhados</h3>
                    <p>Ordenação por tempo acumulado nas tarefas associadas</p>
                  </div>
                </div>
                <div className="v6-table-wrap">
                  <table className="v6-table">
                    <thead>
                      <tr>
                        <th>N.º PCN</th>
                        <th>Cliente</th>
                        <th>Tarefas</th>
                        <th>Horas dedicadas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {effectiveClients
                        .map((c, idx) => {
                          const list = effectiveTasks.filter(
                            (t) => t.client_id === c.id && t.status !== "archived"
                          );
                          const sec = list.reduce(
                            (acc, t) => acc + (t.total_duration_seconds || 0),
                            0
                          );
                          return {
                            c,
                            idx,
                            tasksCount: list.length,
                            sec,
                          };
                        })
                        .sort((a, b) => b.sec - a.sec)
                        .map(({ c, idx, tasksCount, sec }) => (
                          <tr key={c.id}>
                            <td>
                              <span className="v6-badge wait">
                                {c.number || `PCN ${String(idx + 1).padStart(4, "0")}`}
                              </span>
                            </td>
                            <td>
                              <strong>{c.name}</strong>
                            </td>
                            <td>{tasksCount}</td>
                            <td className="font-mono font-bold text-[#59083e]">
                              {Math.floor(sec / 3600)}h{" "}
                              {String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}m
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 8: GESTÃO DE ASSIDUIDADE (MAPA EXCEL COLABORADORAS PCN) */}
          {activeTab === "attendance" && isAdmin && (
            <AttendanceTab
              records={attendanceRecords}
              usersList={effectiveUsers}
              onSaveRecord={(rec, isEdit) => {
                const next = isEdit
                  ? attendanceRecords.map((r) => (r.id === rec.id ? rec : r))
                  : [rec, ...attendanceRecords];
                updateAttendanceRecords(next);
                addAuditLog(
                  isEdit ? "Assiduidade editada" : "Assiduidade registada",
                  `${rec.collaborator_name} · ${rec.absence_type} (${rec.start_date} a ${rec.end_date})`,
                  "Assiduidade"
                );
              }}
              onDeleteRecord={(id) => {
                const target = attendanceRecords.find((r) => r.id === id);
                updateAttendanceRecords(attendanceRecords.filter((r) => r.id !== id));
                if (target) {
                  addAuditLog(
                    "Assiduidade removida",
                    `${target.collaborator_name} · ${target.absence_type}`,
                    "Assiduidade"
                  );
                }
              }}
            />
          )}

          {/* 9: HISTÓRICO PCN (VISÃO GERAL E VISÃO DETALHADA POR UTILIZADORA) */}
          {activeTab === "history" && isAdmin && (
            <HistoryTab
              auditLogs={auditLogs}
              usersList={effectiveUsers}
            />
          )}

          {/* 10: TABELA DE SERVIÇOS (€/h) (ADMIN) */}
          {activeTab === "services" && isAdmin && (
            <div className="v6-card">
              <div className="v6-section-head">
                <div>
                  <h3>Tabela de Serviços & Tarifas Horárias (€/h)</h3>
                  <p>
                    Configure as categorias de serviços jurídicos utilizadas no cálculo automático de
                    honorários.
                  </p>
                </div>
                <button
                  type="button"
                  className="v6-btn primary"
                  onClick={openCreateCategoryModal}
                >
                  + Nova Categoria de Serviço
                </button>
              </div>
              <div className="v6-table-wrap">
                <table className="v6-table">
                  <thead>
                    <tr>
                      <th>Serviço / Categoria Forense</th>
                      <th>Descrição</th>
                      <th>Valor Hora (€/h)</th>
                      <th>Tarefas Associadas</th>
                      <th className="text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceCategories.map((cat) => {
                      const count = effectiveTasks.filter(
                        (t) =>
                          t.task_type_id === cat.id ||
                          (t.task_type || "").toLowerCase() === cat.name.toLowerCase()
                      ).length;
                      return (
                        <tr key={cat.id}>
                          <td>
                            <strong>{cat.name}</strong>
                          </td>
                          <td className="v6-muted text-xs">{cat.description || "—"}</td>
                          <td>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={0}
                                step="5"
                                value={cat.hourly_rate}
                                onChange={(e) =>
                                  handleQuickUpdateCategoryRate(
                                    cat,
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-24 px-2.5 py-1.5 rounded-lg border border-[#ddd1cc] font-bold text-xs text-right"
                              />
                              <span className="text-xs font-bold text-[#736872]">€/h</span>
                            </div>
                          </td>
                          <td>{count} tarefa(s)</td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                className="v6-btn sm"
                                onClick={() => openEditCategoryModal(cat)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="v6-btn sm danger"
                                onClick={() => handleDeleteCategory(cat)}
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 11: TAREFAS ARQUIVADAS */}
          {activeTab === "archived" && isAdmin && (
            <div className="v6-card">
              <div className="v6-section-head">
                <div>
                  <h3>Tarefas Arquivadas ({archivedTasksCount})</h3>
                  <p>Histórico de diligências e processos arquivados.</p>
                </div>
              </div>
              <div className="v6-table-wrap">
                <table className="v6-table">
                  <thead>
                    <tr>
                      <th>Tarefa</th>
                      <th>Cliente</th>
                      <th>Responsável</th>
                      <th>Tempo Total</th>
                      <th>Prazo</th>
                      <th className="text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.filter((t) => t.status === "archived").length === 0 ? (
                      <tr>
                        <td colSpan={6}>
                          <div className="v6-empty">Nenhuma tarefa arquivada no momento.</div>
                        </td>
                      </tr>
                    ) : (
                      tasks
                        .filter((t) => t.status === "archived")
                        .map((t) => (
                          <tr key={t.id}>
                            <td>
                              <strong>{t.title}</strong>
                              <div className="v6-muted text-xs">{t.description || ""}</div>
                            </td>
                            <td>{t.client_name}</td>
                            <td>{t.lawyer_name || "—"}</td>
                            <td className="font-mono font-bold">
                              {formatSeconds(t.total_duration_seconds || 0)}
                            </td>
                            <td>{formatIsoDatePt(t.due_date)}</td>
                            <td className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isAdmin && (
                                  <>
                                    <button
                                      type="button"
                                      className="v6-btn sm"
                                      onClick={() => handleRestoreTask(t)}
                                    >
                                      Restaurar
                                    </button>
                                    <button
                                      type="button"
                                      className="v6-btn sm danger"
                                      onClick={() => confirmDeleteTask(t)}
                                    >
                                      Eliminar
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 12: GESTÃO DE UTILIZADORAS & ACESSOS (ADMIN) */}
          {activeTab === "users" && isAdmin && (
            <div className="v6-card">
              <div className="v6-section-head">
                <div>
                  <h3>Utilizadoras & Acessos PCN</h3>
                  <p>Gestão de contas forenses, perfis de acesso e credenciais.</p>
                </div>
                <button
                  type="button"
                  className="v6-btn primary"
                  onClick={() => setIsNewUserModalOpen(true)}
                >
                  + Nova Utilizadora
                </button>
              </div>
              <div className="v6-table-wrap">
                <table className="v6-table">
                  <thead>
                    <tr>
                      <th>Nome da Advogada</th>
                      <th>Correio Eletrónico</th>
                      <th>Nível de Acesso</th>
                      <th>Estado</th>
                      <th className="text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {effectiveUsers.map((u: any) => (
                      <tr key={u.id}>
                        <td>
                          <strong>{u.name}</strong>
                        </td>
                        <td className="font-mono text-xs">{u.email}</td>
                        <td>
                          <select
                            value={u.role}
                            disabled={!canManageUser(u)}
                            onChange={async (e) => {
                              const newRole = e.target.value;
                              if (!authToken) return;
                              await runUserAction(
                                () => updateUserApi(authToken, u.id, { role: newRole }),
                                `Nível de acesso de ${u.name} atualizado para ${ROLE_LABELS[newRole]}.`
                              );
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-[#ddd1cc] text-xs font-bold bg-white"
                          >
                            {(isMaster || u.role === "master") && (
                              <option value="master">Master (TI)</option>
                            )}
                            <option value="admin_lawyer">Direção / Administradora</option>
                            <option value="lawyer">Advogada Associada</option>
                          </select>
                        </td>
                        <td>
                          {u.is_active === false ? (
                            <span className="v6-badge cancel">Suspensa</span>
                          ) : isUserLocked(u) ? (
                            <span className="v6-badge urgent">Bloqueada</span>
                          ) : (
                            <span className="v6-badge done">Ativa</span>
                          )}
                        </td>
                        <td className="text-right">
                          {canManageUser(u) ? (
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {isUserLocked(u) && (
                                <button
                                  type="button"
                                  className="v6-btn sm"
                                  onClick={() => handleUnlockUser(u)}
                                >
                                  Desbloquear
                                </button>
                              )}
                              <button
                                type="button"
                                className="v6-btn sm"
                                onClick={() => openEditUserModal(u)}
                              >
                                Alterar
                              </button>
                              <button
                                type="button"
                                className="v6-btn sm"
                                onClick={() => handleToggleUserActive(u)}
                              >
                                {u.is_active === false ? "Reativar" : "Suspender"}
                              </button>
                              <button
                                type="button"
                                className="v6-btn sm danger"
                                onClick={() => setUserToDelete(u)}
                              >
                                Remover
                              </button>
                            </div>
                          ) : u.id === currentUser.id ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="v6-muted text-xs mr-1">Sessão atual</span>
                              <button
                                type="button"
                                className="v6-btn sm"
                                onClick={() => openEditUserModal(u)}
                              >
                                Alterar Meu Perfil
                              </button>
                            </div>
                          ) : (
                            <span className="v6-muted text-xs">Protegida</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* MARCA DE ÁGUA V6.0 */}
        <div className="v6-watermark">PCN — COMPETÊNCIA · CONFIANÇA · RESULTADOS</div>

        {/* BARRA DE NAVEGAÇÃO MOBILE NO RODAPÉ (< 1024px) */}
        <nav className="v6-bottom-nav" aria-label="Navegação rápida mobile">
          <button
            type="button"
            onClick={() => switchTab("work")}
            className={`v6-bottom-nav-item ${activeTab === "work" ? "active" : ""}`}
          >
            <span className="ico">◉</span>
            <span>Área</span>
          </button>

          <button
            type="button"
            onClick={() => switchTab("tasks")}
            className={`v6-bottom-nav-item ${activeTab === "tasks" ? "active" : ""}`}
          >
            <span className="ico">✓</span>
            <span>Tarefas</span>
          </button>

          <button
            type="button"
            onClick={() => switchTab("calendar")}
            className={`v6-bottom-nav-item ${activeTab === "calendar" ? "active" : ""}`}
          >
            <span className="ico">🗓</span>
            <span>Agenda</span>
          </button>

          {isAdmin ? (
            <button
              type="button"
              onClick={() => switchTab("clients")}
              className={`v6-bottom-nav-item ${activeTab === "clients" ? "active" : ""}`}
            >
              <span className="ico">◈</span>
              <span>Clientes</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openNewTaskModal()}
              className="v6-bottom-nav-item"
            >
              <span className="ico">＋</span>
              <span>Nova</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className={`v6-bottom-nav-item ${
              isMobileMenuOpen ||
              ["dashboard", "feenotes", "reports", "attendance", "services", "archived", "users", "history"].includes(
                activeTab
              )
                ? "active"
                : ""
            }`}
          >
            <span className="ico">☰</span>
            <span>Menu</span>
          </button>
        </nav>

        {/* TOAST DE FEEDBACK */}
        {modalFeedback && (
          <div className="fixed bottom-24 lg:bottom-6 right-4 lg:right-6 z-50 bg-[#59083e] text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-[#c5a467]/50 text-xs font-bold">
            <Check className="w-4 h-4 text-[#e9c885]" />
            <span>{modalFeedback}</span>
          </div>
        )}

        {/* ── MODAL V6: NOVA TAREFA (UNIFICADO COM EDITAR TAREFA + TEMPOS + ESPERA) ── */}
        {isNewTaskModalOpen && (
          <div
            className="v6-modal-backdrop"
            onClick={() => setIsNewTaskModalOpen(false)}
          >
            <div className="v6-modal" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3 pb-3.5 mb-4 border-b border-[#efe6e0]">
                <div>
                  <h3 className="m-0! p-0! border-0! text-[20px]">Nova Tarefa PCN</h3>
                  <p className="text-xs text-[#736872] mt-1">
                    Preencha os dados da diligência, prazos, estado e acompanhamento.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewTaskModalOpen(false)}
                  className="p-1.5 rounded-lg border border-[#e5d8d0] text-[#59083e] hover:bg-[#faf5f1] cursor-pointer transition-colors shrink-0"
                  title="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleCreateTask}>
                <TaskFormFields
                  form={newTaskForm}
                  onChange={setNewTaskForm}
                  clients={effectiveClients}
                  users={effectiveUsers}
                  serviceCategories={serviceCategories}
                  formatSeconds={formatSeconds}
                />

                <div className="v6-modal-actions">
                  <button
                    type="button"
                    className="v6-btn"
                    onClick={() => setIsNewTaskModalOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTask}
                    className="v6-btn primary"
                  >
                    {isSubmittingTask ? "A guardar..." : "Guardar Tarefa"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL V6: EDITAR / DETALHES DE TAREFA (UNIFICADO COM NOVA TAREFA + TEMPOS + ESPERA) ── */}
        {selectedTaskForDetails && (
          <div
            className="v6-modal-backdrop"
            onClick={() => setSelectedTaskForDetails(null)}
          >
            <div className="v6-modal" onClick={(e) => e.stopPropagation()}>
              {/* Cabeçalho Executivo da Tarefa */}
              <div className="flex items-start justify-between gap-3 pb-3.5 mb-4 border-b border-[#efe6e0]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="m-0! p-0! border-0! text-[20px]">Editar Tarefa</h3>
                    <span className="v6-badge wait">
                      ◈{" "}
                      {effectiveClients.find((c) => c.id === detailsForm.client_id)?.name ||
                        selectedTaskForDetails.client_name}
                    </span>
                    {(() => {
                      const pStyle = getPriorityBadgeStyle(detailsForm.priority);
                      return (
                        <span
                          className="v6-badge"
                          style={{
                            background: pStyle.bg,
                            color: pStyle.text,
                            border: `1px solid ${pStyle.border}`,
                          }}
                        >
                          {pStyle.label}
                        </span>
                      );
                    })()}
                    <span className={getV6BadgeClass(detailsForm.v6_status)}>
                      {detailsForm.v6_status}
                    </span>
                  </div>
                  <p className="text-xs text-[#736872] mt-1">
                    Atualize os dados operacionais, responsável, espera externa, prazo e tempo dedicado à tarefa.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTaskForDetails(null)}
                  className="p-1.5 rounded-lg border border-[#e5d8d0] text-[#59083e] hover:bg-[#faf5f1] cursor-pointer transition-colors shrink-0"
                  title="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveTaskDetails}>
                <TaskFormFields
                  form={detailsForm}
                  onChange={setDetailsForm}
                  clients={effectiveClients}
                  users={effectiveUsers}
                  serviceCategories={serviceCategories}
                  formatSeconds={formatSeconds}
                  existingTask={selectedTaskForDetails}
                />

                <div className="v6-modal-actions justify-between!">
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          className="v6-btn sm"
                          onClick={() => {
                            const t = selectedTaskForDetails;
                            setSelectedTaskForDetails(null);
                            handleArchiveTask(t);
                          }}
                        >
                          <Archive className="w-3.5 h-3.5" />
                          Arquivar
                        </button>
                        <button
                          type="button"
                          className="v6-btn sm danger"
                          onClick={() => {
                            const t = selectedTaskForDetails;
                            setSelectedTaskForDetails(null);
                            confirmDeleteTask(t);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Eliminar
                        </button>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="v6-btn"
                      onClick={() => setSelectedTaskForDetails(null)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingDetails}
                      className="v6-btn primary"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {isSubmittingDetails ? "A guardar..." : "Guardar Alterações"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL V6: NOVO / EDITAR CLIENTE (COM N.º PCN E ANIVERSÁRIO MM-DD) ── */}
        {isNewClientModalOpen && (
          <div
            className="v6-modal-backdrop"
            onClick={() => setIsNewClientModalOpen(false)}
          >
            <div className="v6-modal" onClick={(e) => e.stopPropagation()}>
              <h3>{editingClient ? "Editar Cliente PCN" : "Novo Cliente PCN"}</h3>
              <form onSubmit={handleCreateClient}>
                <div className="v6-form-grid">
                  <div className="v6-field">
                    <label>N.º PCN</label>
                    <input
                      type="text"
                      placeholder="Ex.: PCN 0045"
                      value={clientFormNumber}
                      onChange={(e) => setClientFormNumber(e.target.value)}
                    />
                  </div>
                  <div className="v6-field">
                    <label>NIF</label>
                    <input
                      type="text"
                      maxLength={100}
                      placeholder="Ex.: 509112300"
                      value={clientFormNif}
                      onChange={(e) => setClientFormNif(e.target.value)}
                    />
                  </div>
                  <div className="v6-field full">
                    <label>Nome / Designação *</label>
                    <input
                      type="text"
                      required
                      maxLength={500}
                      placeholder="Nome completo ou firma coletiva"
                      value={clientFormName}
                      onChange={(e) => setClientFormName(e.target.value)}
                    />
                  </div>
                  <div className="v6-field">
                    <label>E-mail</label>
                    <input
                      type="email"
                      placeholder="cliente@dominio.pt"
                      value={clientFormEmail}
                      onChange={(e) => setClientFormEmail(e.target.value)}
                    />
                  </div>
                  <div className="v6-field">
                    <label>Telefone</label>
                    <input
                      type="text"
                      maxLength={100}
                      placeholder="912 345 678 / +351 ..."
                      value={clientFormPhone}
                      onChange={(e) => setClientFormPhone(e.target.value)}
                    />
                  </div>
                  <div className="v6-field full">
                    <label>Data de Aniversário</label>
                    <input
                      type="date"
                      value={
                        clientFormBirthday
                          ? clientFormBirthday.length === 5
                            ? `2000-${clientFormBirthday}`
                            : clientFormBirthday
                          : ""
                      }
                      onChange={(e) => setClientFormBirthday(e.target.value)}
                    />
                  </div>
                  <div className="v6-field full">
                    <label>Notas</label>
                    <textarea
                      value={clientFormNotes}
                      onChange={(e) => setClientFormNotes(e.target.value)}
                    />
                  </div>
                </div>
                <div className="v6-modal-actions">
                  <button
                    type="button"
                    className="v6-btn"
                    onClick={() => setIsNewClientModalOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingClient}
                    className="v6-btn primary"
                  >
                    {isSubmittingClient ? "A guardar..." : "Guardar Cliente"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL V6: NOVO / EDITAR COMPROMISSO / PRAZO RÁPIDO ── */}
        {isQuickEventModalOpen && (
          <div
            className="v6-modal-backdrop"
            onClick={() => {
              setIsQuickEventModalOpen(false);
              setEditingQuickEventId(null);
            }}
          >
            <div className="v6-modal" onClick={(e) => e.stopPropagation()}>
              <h3>
                {editingQuickEventId
                  ? `Editar Registo na Agenda (${quickEventForm.type})`
                  : `Novo Registo na Agenda (${quickEventForm.type})`}
              </h3>
              <form onSubmit={handleSaveQuickEvent}>
                <div className="v6-form-grid">
                  <div className="v6-field full">
                    <label>Título *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex.: Audiência prévia / Termo de prazo de contestação..."
                      value={quickEventForm.title}
                      onChange={(e) =>
                        setQuickEventForm({ ...quickEventForm, title: e.target.value })
                      }
                    />
                  </div>
                  <div className="v6-field">
                    <label>Data *</label>
                    <input
                      type="date"
                      required
                      value={quickEventForm.date}
                      onChange={(e) =>
                        setQuickEventForm({ ...quickEventForm, date: e.target.value })
                      }
                    />
                  </div>
                  <div className="v6-field">
                    <label>Hora</label>
                    <input
                      type="time"
                      value={quickEventForm.time}
                      onChange={(e) =>
                        setQuickEventForm({ ...quickEventForm, time: e.target.value })
                      }
                    />
                  </div>
                  <div className="v6-field">
                    <label>Tipo</label>
                    <select
                      value={normalizeEventType(quickEventForm.type)}
                      onChange={(e) =>
                        setQuickEventForm({
                          ...quickEventForm,
                          type: e.target.value as CalendarEvent["type"],
                        })
                      }
                    >
                      <option value="Compromisso">Compromisso</option>
                      <option value="Diligência">Diligência</option>
                      <option value="Prazo">Prazo</option>
                      <option value="Prazo de tarefa">Prazo de tarefa</option>
                      <option value="Férias / Ausência">Férias / Ausência</option>
                    </select>
                  </div>
                  <div className="v6-field">
                    <label>Responsável</label>
                    <select
                      value={quickEventForm.ownerId}
                      onChange={(e) =>
                        setQuickEventForm({ ...quickEventForm, ownerId: e.target.value })
                      }
                    >
                      {effectiveUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="v6-field full">
                    <label>Cliente (opcional)</label>
                    <select
                      value={quickEventForm.clientId}
                      onChange={(e) =>
                        setQuickEventForm({ ...quickEventForm, clientId: e.target.value })
                      }
                    >
                      <option value="">Sem cliente associado</option>
                      {effectiveClients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="v6-field full">
                    <label>Observações / Subtítulo</label>
                    <textarea
                      value={quickEventForm.notes}
                      onChange={(e) =>
                        setQuickEventForm({ ...quickEventForm, notes: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="v6-modal-actions justify-between!">
                  <div>
                    {editingQuickEventId && (
                      <button
                        type="button"
                        className="v6-btn danger"
                        onClick={() => {
                          handleDeleteEventFromAnyTab(editingQuickEventId);
                          setIsQuickEventModalOpen(false);
                          setEditingQuickEventId(null);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Eliminar</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="v6-btn"
                      onClick={() => {
                        setIsQuickEventModalOpen(false);
                        setEditingQuickEventId(null);
                      }}
                    >
                      Cancelar
                    </button>
                    <button type="submit" className="v6-btn primary">
                      Guardar na Agenda
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL POPUP: PERGUNTAR SE DESEJA SALVAR NO GOOGLE CALENDAR ── */}
        {googleCalendarPromptEvent && (
          <div
            className="v6-modal-backdrop"
            onClick={() => setGoogleCalendarPromptEvent(null)}
          >
            <div className="v6-modal max-w-md!" onClick={(e) => e.stopPropagation()}>
              <h3>📅 Sincronizar com Google Calendar?</h3>
              <p className="text-xs text-[#50454b] mb-3">
                O registo <strong>"{googleCalendarPromptEvent.title}"</strong> ({googleCalendarPromptEvent.type}) foi guardado no sistema PCN. Deseja adicionar também à sua conta pessoal / partilhada do Google Calendar?
              </p>
              <div className="v6-item mb-3 text-xs bg-[#faf7f4]">
                <div className="flex justify-between py-0.5">
                  <span className="text-[#736872]">Data & Hora:</span>
                  <strong className="text-[#59083e]">
                    {formatIsoDatePt(googleCalendarPromptEvent.date)} às {googleCalendarPromptEvent.time}
                  </strong>
                </div>
                {googleCalendarPromptEvent.subtitle && (
                  <div className="flex justify-between py-0.5 border-t border-[#f0eae6] mt-1 pt-1">
                    <span className="text-[#736872]">Detalhes:</span>
                    <span className="text-[#28202a] font-medium truncate max-w-[200px]">
                      {googleCalendarPromptEvent.subtitle}
                    </span>
                  </div>
                )}
              </div>
              <div className="v6-modal-actions">
                <button
                  type="button"
                  className="v6-btn"
                  onClick={() => setGoogleCalendarPromptEvent(null)}
                >
                  Agora não
                </button>
                <button
                  type="button"
                  className="v6-btn primary"
                  onClick={() => {
                    const evt = googleCalendarPromptEvent;
                    const iso = evt.date.replace(/-/g, "");
                    const gUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
                      evt.title
                    )}&dates=${iso}/${iso}&details=${encodeURIComponent(
                      evt.subtitle || evt.type
                    )}`;
                    window.open(gUrl, "_blank");
                    setGoogleCalendarPromptEvent(null);
                  }}
                >
                  <span>Sim, Adicionar ao Google</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: CATEGORIA DE SERVIÇO (€/h) ── */}
        {isCategoryModalOpen && (
          <div
            className="v6-modal-backdrop"
            onClick={() => setIsCategoryModalOpen(false)}
          >
            <div className="v6-modal max-w-lg!" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-3 pb-3.5 mb-4 border-b border-[#efe6e0]">
                <div>
                  <h3 className="m-0! p-0! border-0! text-[20px]">
                    {editingCategory
                      ? "Editar Categoria de Serviço"
                      : "Nova Categoria de Serviço"}
                  </h3>
                  <p className="text-xs text-[#736872] mt-1">
                    Defina o nome da categoria forense, a tarifa horária (€/h) e a descrição para cálculo de honorários.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="p-1.5 rounded-lg border border-[#e5d8d0] text-[#59083e] hover:bg-[#faf5f1] cursor-pointer transition-colors shrink-0"
                  title="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveCategory}>
                <div className="v6-form-grid">
                  <div className="v6-field full">
                    <label>Nome do Serviço / Categoria Forense *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex.: Contencioso Cível, Registos e Notariado, Assessoria..."
                      value={categoryForm.name}
                      onChange={(e) =>
                        setCategoryForm({ ...categoryForm, name: e.target.value })
                      }
                    />
                  </div>

                  <div className="v6-field full">
                    <label>Valor Hora (€/h) *</label>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative flex-1 min-w-[160px]">
                        <input
                          type="number"
                          min={0}
                          step="5"
                          required
                          placeholder="120"
                          value={categoryForm.hourly_rate}
                          onChange={(e) =>
                            setCategoryForm({
                              ...categoryForm,
                              hourly_rate: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="pr-12 font-mono font-bold"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#736872] pointer-events-none">
                          €/h
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {[80, 100, 120, 150].map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={() =>
                              setCategoryForm({ ...categoryForm, hourly_rate: rate })
                            }
                            className={`v6-btn sm ${
                              Number(categoryForm.hourly_rate) === rate ? "gold" : ""
                            }`}
                          >
                            {rate} €/h
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="v6-field full">
                    <label>Descrição / Âmbito do Serviço</label>
                    <textarea
                      placeholder="Ex.: Elaboração de articulados, requerimentos, recursos e acompanhamento em juízo..."
                      value={categoryForm.description}
                      onChange={(e) =>
                        setCategoryForm({ ...categoryForm, description: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="v6-modal-actions">
                  <button
                    type="button"
                    className="v6-btn"
                    onClick={() => setIsCategoryModalOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingCategory}
                    className="v6-btn primary"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {isSubmittingCategory ? "A guardar..." : "Guardar Serviço"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL: NOVA UTILIZADORA ── */}
        {isNewUserModalOpen && (
          <div
            className="v6-modal-backdrop"
            onClick={() => setIsNewUserModalOpen(false)}
          >
            <div className="v6-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Adicionar Nova Utilizadora</h3>
              <form onSubmit={handleCreateUserSubmit}>
                <div className="v6-form-grid">
                  <div className="v6-field full">
                    <label>Nome Completo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex.: Dr.ª Carolina"
                      value={newUserForm.name}
                      onChange={(e) =>
                        setNewUserForm({ ...newUserForm, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="v6-field">
                    <label>E-mail *</label>
                    <input
                      type="email"
                      required
                      placeholder="carolina@pcnadvogadas.pt"
                      value={newUserForm.email}
                      onChange={(e) =>
                        setNewUserForm({ ...newUserForm, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="v6-field">
                    <label>Perfil / Nível de Acesso</label>
                    <select
                      value={newUserForm.role}
                      onChange={(e) =>
                        setNewUserForm({
                          ...newUserForm,
                          role: e.target.value as "master" | "admin_lawyer" | "lawyer",
                        })
                      }
                    >
                      <option value="lawyer">Advogada Associada</option>
                      <option value="admin_lawyer">Direção / Administradora</option>
                      {isMaster && <option value="master">Master (TI)</option>}
                    </select>
                  </div>
                  <div className="v6-field full">
                    <label>Palavra-passe *</label>
                    <div className="relative flex items-center">
                      <input
                        type={showNewUserPassword ? "text" : "password"}
                        required
                        value={newUserForm.password}
                        onChange={(e) =>
                          setNewUserForm({ ...newUserForm, password: e.target.value })
                        }
                        className="w-full pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewUserPassword((p) => !p)}
                        className="absolute right-3 text-[#736872] hover:text-[#59083e] cursor-pointer"
                        title={showNewUserPassword ? "Ocultar" : "Mostrar"}
                      >
                        {showNewUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="v6-modal-actions">
                  <button
                    type="button"
                    className="v6-btn"
                    onClick={() => setIsNewUserModalOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingUser}
                    className="v6-btn primary"
                  >
                    {isSubmittingUser ? "A criar..." : "Adicionar Utilizadora"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL: ALTERAR UTILIZADORA / MEU PERFIL ── */}
        {editingUser && (
          <div
            className="v6-modal-backdrop"
            onClick={() => setEditingUser(null)}
          >
            <div className="v6-modal" onClick={(e) => e.stopPropagation()}>
              <h3>
                {editingUser.id === currentUser.id
                  ? "Meu Perfil · Alterar Dados"
                  : `Alterar Utilizadora: ${editingUser.name}`}
              </h3>
              <form onSubmit={handleSaveEditUser}>
                <div className="v6-form-grid">
                  <div className="v6-field full">
                    <label>Nome Completo *</label>
                    <input
                      type="text"
                      required
                      value={editUserForm.name}
                      onChange={(e) =>
                        setEditUserForm({ ...editUserForm, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="v6-field">
                    <label>E-mail *</label>
                    <input
                      type="email"
                      required
                      value={editUserForm.email}
                      onChange={(e) =>
                        setEditUserForm({ ...editUserForm, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="v6-field">
                    <label>Perfil / Nível de Acesso</label>
                    <select
                      value={editUserForm.role}
                      disabled={!isAdmin || (!isMaster && editingUser.role === "master")}
                      onChange={(e) =>
                        setEditUserForm({
                          ...editUserForm,
                          role: e.target.value as "master" | "admin_lawyer" | "lawyer",
                        })
                      }
                    >
                      <option value="lawyer">Advogada Associada</option>
                      <option value="admin_lawyer">Direção / Administradora</option>
                      {(isMaster || editingUser.role === "master") && (
                        <option value="master">Master (TI)</option>
                      )}
                    </select>
                  </div>
                  <div className="v6-field full">
                    <label>Nova Palavra-passe (deixe em branco para manter a atual)</label>
                    <div className="relative flex items-center">
                      <input
                        type={showEditUserPassword ? "text" : "password"}
                        placeholder="Preencha apenas se desejar alterar a palavra-passe"
                        value={editUserForm.password}
                        onChange={(e) =>
                          setEditUserForm({ ...editUserForm, password: e.target.value })
                        }
                        className="w-full pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditUserPassword((p) => !p)}
                        className="absolute right-3 text-[#736872] hover:text-[#59083e] cursor-pointer"
                        title={showEditUserPassword ? "Ocultar" : "Mostrar"}
                      >
                        {showEditUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="v6-modal-actions">
                  <button
                    type="button"
                    className="v6-btn"
                    onClick={() => setEditingUser(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingUser}
                    className="v6-btn primary"
                  >
                    {isSubmittingUser ? "A guardar..." : "Guardar Alterações"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL: CONFIRMAR REMOÇÃO DE UTILIZADORA ── */}
        {userToDelete && (
          <div className="v6-modal-backdrop" onClick={() => setUserToDelete(null)}>
            <div className="v6-modal max-w-md!" onClick={(e) => e.stopPropagation()}>
              <h3>Remover Utilizadora</h3>
              <p className="text-sm text-[#28202a] mb-2">
                Tem a certeza de que deseja remover a utilizadora{" "}
                <strong>"{userToDelete.name}"</strong> ({userToDelete.email})?
              </p>
              <p className="text-xs text-rose-700 font-bold">
                Esta ação remove o acesso da utilizadora ao sistema.
              </p>
              <div className="v6-modal-actions">
                <button
                  type="button"
                  className="v6-btn"
                  onClick={() => setUserToDelete(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeletingUser}
                  className="v6-btn danger"
                  onClick={handleConfirmDeleteUser}
                >
                  {isDeletingUser ? "A remover..." : "Remover Definitivamente"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: CONFIRMAR ELIMINAÇÃO DE TAREFA ── */}
        {taskToDelete && (
          <div className="v6-modal-backdrop" onClick={() => setTaskToDelete(null)}>
            <div className="v6-modal max-w-md!" onClick={(e) => e.stopPropagation()}>
              <h3>Confirmar Eliminação da Tarefa</h3>
              <p className="text-sm text-[#28202a] mb-2">
                Tem a certeza de que deseja eliminar permanentemente a tarefa{" "}
                <strong>"{taskToDelete.title}"</strong> ({taskToDelete.client_name})?
              </p>
              <p className="text-xs text-rose-700 font-bold">
                Esta ação não poderá ser revertida.
              </p>
              <div className="v6-modal-actions">
                <button
                  type="button"
                  className="v6-btn"
                  onClick={() => setTaskToDelete(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeletingTask}
                  className="v6-btn danger"
                  onClick={handleDeleteTask}
                >
                  {isDeletingTask ? "A eliminar..." : "Eliminar Definitivamente"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL POPUP: ALERTA DE 1 HORA DE TAREFA EM ANDAMENTO ── */}
        {overtimeAlert && (
          <div className="v6-modal-backdrop">
            <div className="v6-modal max-w-md!">
              <h3>⏰ Alerta de Execução · {overtimeAlert.hours}h em Andamento</h3>
              <p className="text-xs text-[#736872] mb-3">
                A tarefa <strong>{overtimeAlert.task.title}</strong> ({overtimeAlert.task.client_name})
                atingiu {overtimeAlert.hours} hora(s) em execução contínua.
              </p>
              <div className="v6-item mb-3">
                <div className="flex justify-between text-xs">
                  <span>Tempo Acumulado:</span>
                  <strong className="font-mono text-[#59083e]">
                    {formatSeconds(
                      tasks.find((t) => t.id === overtimeAlert.task.id)
                        ?.total_duration_seconds ??
                        overtimeAlert.task.total_duration_seconds
                    )}
                  </strong>
                </div>
              </div>
              <div className="v6-modal-actions justify-between! flex-wrap gap-2">
                <button
                  type="button"
                  className="v6-btn text-xs text-[#59083e] border-[#e2d0b1] bg-[#fdfaf5] hover:bg-[#f6ead7] flex items-center gap-1.5 cursor-pointer"
                  onClick={handleSilenceOvertimeAlert}
                  title="Dispensar futuros alertas de 1 em 1 hora nesta tarefa"
                >
                  <BellOff className="w-3.5 h-3.5" />
                  <span>Dispensar alerta nesta tarefa</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="v6-btn"
                    onClick={() => {
                      const target =
                        tasks.find((t) => t.id === overtimeAlert.task.id) ||
                        overtimeAlert.task;
                      setOvertimeAlert(null);
                      handlePauseTimer(target);
                    }}
                  >
                    Pausar
                  </button>
                  <button
                    type="button"
                    className="v6-btn gold"
                    onClick={() => {
                      const target =
                        tasks.find((t) => t.id === overtimeAlert.task.id) ||
                        overtimeAlert.task;
                      setOvertimeAlert(null);
                      handleCompleteTask(target);
                    }}
                  >
                    Concluir
                  </button>
                  <button
                    type="button"
                    className="v6-btn primary"
                    onClick={handleContinueOvertimeTask}
                  >
                    Continuar (+1h)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL POPUP: ALERTA DE TAREFA REDISTRIBUÍDA (ACK COM BOTÃO OK + LOG) ── */}
        {myPendingRedistAlerts.length > 0 && (() => {
          const activeRedistAlert = myPendingRedistAlerts[0];
          const isNewOwner = activeRedistAlert.roleInChange === "new_owner";
          return (
            <div className="v6-modal-backdrop">
              <div className="v6-modal max-w-md!">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="m-0!">🔔 Alerta de Tarefa Redistribuída</h3>
                  <span className="v6-badge redist">Redistribuída</span>
                </div>

                <p className="text-xs text-[#50454b] mb-3 leading-relaxed">
                  {isNewOwner ? (
                    <>
                      A tarefa <strong>{activeRedistAlert.taskTitle}</strong> (
                      {activeRedistAlert.clientName}) foi{" "}
                      <strong>redistribuída para a sua responsabilidade</strong>.
                    </>
                  ) : (
                    <>
                      A tarefa <strong>{activeRedistAlert.taskTitle}</strong> (
                      {activeRedistAlert.clientName}), que estava atribuída a si, foi{" "}
                      <strong>redistribuída para {activeRedistAlert.toUserName}</strong>.
                    </>
                  )}
                </p>

                <div className="v6-item mb-4 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#736872]">Tarefa:</span>
                    <strong className="text-[#28202a] text-right">
                      {activeRedistAlert.taskTitle}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#736872]">Cliente:</span>
                    <span className="font-semibold text-[#59083e]">
                      {activeRedistAlert.clientName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#736872]">Advogada anterior:</span>
                    <span>{activeRedistAlert.fromUserName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#736872]">Nova responsável:</span>
                    <strong className="text-[#6a1b9a]">
                      {activeRedistAlert.toUserName}
                    </strong>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-[#eee5e1] text-[11px] text-[#776f73]">
                    <span>Alterado por {activeRedistAlert.changedBy}</span>
                    <span>{activeRedistAlert.createdAt}</span>
                  </div>
                </div>

                <div className="v6-modal-actions justify-end!">
                  <button
                    type="button"
                    className="v6-btn primary px-6! font-bold"
                    onClick={() => handleAckRedistributionAlert(activeRedistAlert)}
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </main>
    </div>
  );
}
