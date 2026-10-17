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
  SlidersHorizontal,
  Database,
  LogIn,
  LogOut,
  ShieldCheck,
  UserPlus,
  ShieldAlert,
  KeyRound,
} from "lucide-react";
import {
  INITIAL_USERS,
  INITIAL_CLIENTS,
  INITIAL_TASKS,
  INITIAL_SERVICE_CATEGORIES,
} from "@/lib/mockData";
import { Task, Client, UserProfile, ServiceCategory } from "@/lib/types";
import { detectPlatform, PlatformInfo } from "@/lib/platform";
import {
  loginApi,
  changePasswordApi,
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
      } catch {}
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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [sessionExpiry, setSessionExpiry] = useState<number | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "tasks"
    | "archived"
    | "clients"
    | "calendar"
    | "feenotes"
    | "services"
    | "reports"
    | "users"
  >("dashboard");

  // User Management State (Portal Admin & Seletores de Tarefas)
  const [usersList, setUsersList] = useState<any[]>(INITIAL_USERS);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState<boolean>(false);
  const [newUserForm, setNewUserForm] = useState<{
    name: string;
    email: string;
    role: "admin_lawyer" | "lawyer";
    password: string;
  }>({
    name: "",
    email: "",
    role: "lawyer",
    password: "",
  });
  const [isSubmittingUser, setIsSubmittingUser] = useState<boolean>(false);

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
    } catch {}
  }, []);

  const persistCategoriesLocal = (cats: ServiceCategory[]) => {
    setServiceCategories(cats);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("pcn_service_categories", JSON.stringify(cats));
      } catch {}
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
        } catch {}
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
        } catch {}
      }
      return next;
    });
  };

  const updateBillingRounding = (mins: 0 | 6 | 15) => {
    setBillingRoundingMinutes(mins);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("pcn_billing_rounding", String(mins));
      } catch {}
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
  const [modalFeedback, setModalFeedback] = useState<string | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);

  // PWA Standalone & Responsiveness State
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Quick Filters for Task Board (Pool, Abertas, Em Andamento, Pausadas, Concluídas)
  const [taskStatusFilter, setTaskStatusFilter] = useState<
    "all" | "pool" | "assigned" | "in_progress" | "paused" | "completed"
  >("all");

  // Task Details & Reassign Modal State (inclui edição manual de tempo)
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState<Task | null>(null);
  const [detailsForm, setDetailsForm] = useState<{
    title: string;
    description: string;
    assigned_to: string;
    due_date: string;
    status: Task["status"];
    duration_hours: number;
    duration_minutes: number;
    duration_seconds: number;
  }>({
    title: "",
    description: "",
    assigned_to: "pool",
    due_date: "",
    status: "assigned",
    duration_hours: 0,
    duration_minutes: 0,
    duration_seconds: 0,
  });
  const [isSubmittingDetails, setIsSubmittingDetails] = useState<boolean>(false);

  // Task Delete Confirmation Dialog State
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState<boolean>(false);

  // Calendar Export Menu State
  const [showCalendarMenu, setShowCalendarMenu] = useState<boolean>(false);
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo | null>(null);

  // Navigation with native mobile back gesture/popstate support
  const switchTab = (
    tab:
      | "dashboard"
      | "tasks"
      | "archived"
      | "clients"
      | "calendar"
      | "feenotes"
      | "services"
      | "reports"
      | "users"
  ) => {
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
    setSelectedTaskForDetails(liveTask);
    setDetailsForm({
      title: liveTask.title,
      description: liveTask.description || "",
      assigned_to: resolveAssigneeValue(liveTask),
      due_date: liveTask.due_date || getTodayDateString(),
      status: liveTask.status,
      duration_hours: Math.floor(totalSec / 3600),
      duration_minutes: Math.floor((totalSec % 3600) / 60),
      duration_seconds: totalSec % 60,
    });
  };

  const confirmDeleteTask = (task: Task) => {
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
        setActiveTab(e.state.tab);
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
    } catch {}

    const beforeInstallHandler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", beforeInstallHandler);

    return () => {
      try {
        mq.removeEventListener("change", handler);
      } catch {}
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

  // New Task Form
  const [taskFormTitle, setTaskFormTitle] = useState("");
  const [taskFormDescription, setTaskFormDescription] = useState("");
  const [taskFormClientId, setTaskFormClientId] = useState("");
  const [taskFormTypeId, setTaskFormTypeId] = useState("tp_2");
  const [taskFormAssignee, setTaskFormAssignee] = useState("usr_patricia");
  const [taskFormDueDate, setTaskFormDueDate] = useState("");
  const [taskFormIsUrgent, setTaskFormIsUrgent] = useState(false);
  const [taskFormPublishToPool, setTaskFormPublishToPool] = useState(false);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  // Define a data atual no cliente após o mount (evita erro de prerender estático no Next.js 16)
  useEffect(() => {
    const today = getTodayDateString();
    setTaskFormDueDate((prev) => prev || today);
    setCalcStartDate((prev) => prev || today);
  }, []);

  useEffect(() => {
    if (isNewTaskModalOpen) {
      setTaskFormDueDate(getTodayDateString());
    }
  }, [isNewTaskModalOpen]);

  // New Client Form
  const [clientFormName, setClientFormName] = useState("");
  const [clientFormNif, setClientFormNif] = useState("");
  const [clientFormProcess, setClientFormProcess] = useState("");
  const [clientFormEmail, setClientFormEmail] = useState("");
  const [clientFormPhone, setClientFormPhone] = useState("");
  const [clientFormNotes, setClientFormNotes] = useState("");
  const [isSubmittingClient, setIsSubmittingClient] = useState(false);

  // Garante que o cliente selecionado para novas tarefas ou notas é sempre válido
  useEffect(() => {
    if (clients.length > 0) {
      setTaskFormClientId((prev) => {
        const exists = clients.some((c) => c.id === prev);
        return exists && prev ? prev : clients[0].id;
      });
      setSelectedFeeClient((prev) => {
        const exists = clients.some((c) => c.id === prev);
        return exists && prev ? prev : clients[0].id;
      });
    }
  }, [clients]);

  // ── AUTENTICAÇÃO E SESSÃO SEGURA (30 MINUTOS) ──
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Redefinição obrigatória de palavra-passe no primeiro login
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [currentPasswordForReset, setCurrentPasswordForReset] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [pendingUserProfile, setPendingUserProfile] = useState<UserProfile | null>(null);

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
          if (typeof window !== "undefined") {
            try {
              const raw = localStorage.getItem("pcn_running_timers");
              if (raw) localTimers = JSON.parse(raw);
            } catch {}
          }

          const toSyncWithServer: Array<{ task_id: string; total_duration_seconds: number }> = [];
          const nowMs = Date.now();

          let savedThresholds: Record<string, number> = {};
          if (typeof window !== "undefined") {
            try {
              const rawThresh = localStorage.getItem("pcn_overtime_thresholds");
              if (rawThresh) savedThresholds = JSON.parse(rawThresh);
            } catch {}
          }

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
            const persistedThreshold = savedThresholds[t.id] ?? 3600;
            alertedHoursRef.current[t.id] =
              dur >= persistedThreshold ? dur + 3600 : persistedThreshold;
            return {
              id: t.id,
              title: t.title,
              description: t.description,
              client_id: t.client_id,
              client_name: t.client?.name || "Cliente",
              task_type: t.task_type?.name || "Geral",
              task_type_id: t.task_type_id || t.task_type?.id,
              status: t.status,
              assigned_to: t.assigned_to,
              lawyer_name: t.assignee?.name || "—",
              due_date: t.due_date ? t.due_date.split("T")[0] : undefined,
              total_duration_seconds: dur,
              fee_amount: parsedFee,
            };
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
            syncTimersApi(token, toSyncWithServer).catch(() => {});
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
            } catch {}
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
          // Preserve any local-only custom categories not yet in apiTypes
          for (const lc of localCats) {
            const existsInApi = mergedCats.some(
              (mc) =>
                mc.id === lc.id ||
                mc.name.trim().toLowerCase() === lc.name.trim().toLowerCase()
            );
            if (!existsInApi) {
              mergedCats.push(lc);
            }
          }
          persistCategoriesLocal(mergedCats);
        }
      } catch (e) {
        console.warn("Aviso ao carregar categorias de serviço:", e);
      }

      // 2. Clientes
      try {
        const apiClients = await getClientsApi(token);
        if (apiClients) {
          setClients(apiClients);
          if (apiClients.length > 0) {
            setTaskFormClientId((prev) => {
              const exists = apiClients.some((c: any) => c.id === prev);
              return exists ? prev : apiClients[0].id;
            });
            setSelectedFeeClient((prev) => {
              const exists = apiClients.some((c: any) => c.id === prev);
              return exists ? prev : apiClients[0].id;
            });
          }
        }
      } catch (e) {
        console.warn("Aviso ao carregar clientes:", e);
      }

      // 3. Utilizadores (disponível para todos os seletores de atribuição/reatribuição)
      try {
        setIsLoadingUsers(true);
        const apiUsers = await getUsersApi(token);
        if (apiUsers && apiUsers.length > 0) {
          loadedUsers = apiUsers;
          setUsersList(apiUsers);
          setTaskFormAssignee((prev) => {
            const exists = apiUsers.some((u: any) => u.id === prev);
            return exists ? prev : apiUsers[0].id;
          });
        }
      } catch (e) {
        console.warn("Aviso ao carregar utilizadoras:", e);
      } finally {
        setIsLoadingUsers(false);
      }

      // 3.b Restaurar Popup de Alerta de 1h+ se existir tarefa em andamento que atingiu o limite atual sem ter sido reiniciada em "Continuar"
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

        const overtimeCandidates = loadedTasks.filter((t) => {
          if (t.status !== "in_progress") return false;
          const dur = t.total_duration_seconds || 0;
          const nextThreshold = savedThresholds[t.id] ?? 3600;
          return (
            dur >= nextThreshold ||
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
            (targetTask.total_duration_seconds || 0) + 3600;

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
      } catch {}

      // 4. Notas de Honorários (se Direção / Admin)
      const roleToCheck = userRole || currentUser?.role;
      if (roleToCheck === "admin_lawyer") {
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
      } catch {}
    }
    if (effectiveToken && running.length > 0) {
      const payload = running.map((t) => ({
        task_id: t.id,
        total_duration_seconds: t.total_duration_seconds || 0,
      }));
      syncTimersApi(effectiveToken, payload, true).catch(() => {});
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

  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    setSessionNotice(null);
    try {
      const loginRes = await loginApi(loginEmail, loginPassword);
      if (loginRes.access_token) {
        const expiry = Date.now() + 30 * 60 * 1000; // 30 minutos exatos
        const matched = INITIAL_USERS.find(
          (u) => u.email.toLowerCase() === loginEmail.toLowerCase()
        );
        const userProfile: UserProfile = {
          id: loginRes.user_id,
          name:
            loginRes.name ||
            matched?.name ||
            (loginRes.role === "admin_lawyer" ? "Dr.ª Patrícia" : "Advogada Associada"),
          role: loginRes.role === "admin_lawyer" ? "admin_lawyer" : "lawyer",
          email: loginEmail,
        };

        setAuthToken(loginRes.access_token);

        // Se for o primeiro login e exigir alteração de senha obrigatória:
        if (loginRes.must_change_password) {
          setCurrentPasswordForReset(loginPassword);
          setPendingUserProfile(userProfile);
          setMustChangePassword(true);
          setPasswordChangeError(null);
          setNewPassword("");
          setConfirmPassword("");
          return;
        }

        if (typeof window !== "undefined") {
          localStorage.setItem("pcn_session_token", loginRes.access_token);
          localStorage.setItem("pcn_session_expiry", expiry.toString());
          localStorage.setItem("pcn_session_user", JSON.stringify(userProfile));
        }

        setSessionExpiry(expiry);
        setCurrentUser(userProfile);
        setIsAuthenticated(true);
        setApiConnected(true);

        loadAllData(loginRes.access_token, userProfile.role);
      } else {
        setLoginError("Resposta inesperada do servidor de autenticação.");
      }
    } catch (err: any) {
      setLoginError(err.message || "Credenciais inválidas ou erro de ligação à base de dados.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError(null);

    if (!authToken) {
      setPasswordChangeError("Sessão inválida. Por favor, autentique-se novamente.");
      setMustChangePassword(false);
      return;
    }

    if (newPassword.length < 12) {
      setPasswordChangeError("A nova palavra-passe deve ter no mínimo 12 caracteres.");
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword)) {
      setPasswordChangeError("A nova palavra-passe deve conter letras maiúsculas e minúsculas.");
      return;
    }
    if (!/\d/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      setPasswordChangeError("A nova palavra-passe deve conter pelo menos um algarismo e um símbolo especial.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordChangeError("A confirmação da palavra-passe não coincide com a nova palavra-passe.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await changePasswordApi(authToken, currentPasswordForReset, newPassword);
      const effectiveToken = res.access_token || authToken;
      const expiry = Date.now() + 30 * 60 * 1000;
      const userProfile = pendingUserProfile || currentUser;

      if (typeof window !== "undefined") {
        localStorage.setItem("pcn_session_token", effectiveToken);
        localStorage.setItem("pcn_session_expiry", expiry.toString());
        localStorage.setItem("pcn_session_user", JSON.stringify(userProfile));
      }

      setAuthToken(effectiveToken);
      setSessionExpiry(expiry);
      setCurrentUser(userProfile);
      setMustChangePassword(false);
      setIsAuthenticated(true);
      setApiConnected(true);

      setModalFeedback("Palavra-passe pessoal definida com sucesso! Bem-vinda à plataforma.");
      setTimeout(() => setModalFeedback(null), 4000);

      loadAllData(effectiveToken, userProfile.role);
    } catch (err: any) {
      setPasswordChangeError(err.message || "Erro ao definir nova palavra-passe.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Restauração de Sessão no Mount (se ainda dentro dos 30 minutos)
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
          setSessionExpiry(expiryTime);
          setCurrentUser(profile);
          setIsAuthenticated(true);
          setApiConnected(true);
          loadAllData(savedToken, profile.role);
        } else {
          localStorage.removeItem("pcn_session_token");
          localStorage.removeItem("pcn_session_expiry");
          localStorage.removeItem("pcn_session_user");
          setSessionNotice(
            "A sua sessão anterior expirou após 30 minutos por motivos de segurança forense. Por favor, autentique-se novamente."
          );
        }
      }
    } catch {}
  }, []);

  // Monitorização em tempo real do limite de 30 minutos e 401s
  useEffect(() => {
    const handleExpiredEvent = (e: any) => {
      handleLogout(e.detail || "Sessão expirada. Por favor, autentique-se novamente.");
    };
    if (typeof window !== "undefined") {
      window.addEventListener("pcn_session_expired", handleExpiredEvent);
    }

    if (!isAuthenticated || !sessionExpiry) {
      return () => {
        if (typeof window !== "undefined") {
          window.removeEventListener("pcn_session_expired", handleExpiredEvent);
        }
      };
    }

    const interval = setInterval(() => {
      if (Date.now() >= sessionExpiry) {
        handleLogout(
          "A sua sessão expirou após 30 minutos de inatividade por motivos de segurança forense. Por favor, inicie sessão novamente."
        );
      }
    }, 5000);

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("pcn_session_expired", handleExpiredEvent);
      }
      clearInterval(interval);
    };
  }, [isAuthenticated, sessionExpiry]);

  // Criação de Nova Utilizadora (Portal Admin)
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authToken) return;
    setIsSubmittingUser(true);
    try {
      await createUserApi(authToken, newUserForm);
      setModalFeedback("Nova utilizadora criada com sucesso no PostgreSQL!");
      setIsNewUserModalOpen(false);
      setNewUserForm({
        name: "",
        email: "",
        role: "lawyer",
        password: "",
      });
      const updated = await getUsersApi(authToken);
      if (updated) setUsersList(updated);
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
      } catch {}

      // 2. Notificação Nativa do Browser (se autorizada)
      try {
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(`⏰ Tarefa em andamento há ${hoursCount}h — PCN Advogadas`, {
            body: `${task.title} (${task.client_name}) atingiu ${formatSeconds(durationSeconds)} em execução.`,
          });
        } else if ("Notification" in window && Notification.permission === "default") {
          Notification.requestPermission();
        }
      } catch {}
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
      } catch {}
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
          } catch {}
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
        } catch {}
      }

      setTasks((prev) => {
        const nextList = prev.map((t) => {
          if (t.status !== "in_progress") return t;
          const nextSec = (t.total_duration_seconds || 0) + 1;
          localMap[t.id] = { seconds: nextSec, updatedAt: nowMs };
          const nextThreshold = alertedHoursRef.current[t.id] || 3600;
          if (nextSec >= nextThreshold) {
            alertedHoursRef.current[t.id] = nextSec + 3600;
            const currentHours = Math.max(1, Math.floor(nextSec / 3600));
            setTimeout(() => {
              triggerOvertimeAlert(t, nextSec, currentHours);
            }, 0);
          }
          return { ...t, total_duration_seconds: nextSec };
        });

        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("pcn_running_timers", JSON.stringify(localMap));
          } catch {}
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
    } catch {}
    try {
      const rawAlert = localStorage.getItem("pcn_overtime_alert");
      if (rawAlert) {
        const parsed = JSON.parse(rawAlert);
        if (parsed?.taskId === taskId) {
          let savedThresholds: Record<string, number> = {};
          try {
            const rawThresh = localStorage.getItem("pcn_overtime_thresholds");
            if (rawThresh) savedThresholds = JSON.parse(rawThresh);
          } catch {}
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
    } catch {}
    setOvertimeAlert((prev) => (prev?.task.id === taskId ? null : prev));
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
      } catch {}
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

  const handleStartTimer = async (task: Task) => {
    let serverDuration = task.total_duration_seconds || 0;
    if (authToken && apiConnected) {
      try {
        const updated = await startTimerApi(task.id, authToken);
        if (updated && typeof updated.total_duration_seconds === "number") {
          serverDuration = Math.max(serverDuration, updated.total_duration_seconds);
        }
      } catch (e) {
        console.error(e);
      }
    }
    const nextThreshold = (serverDuration || 0) + 3600;
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
      } catch {}
    }
    alertedHoursRef.current[task.id] = nextThreshold;
    setActiveTaskId(task.id);
    setTimerSeconds(serverDuration);
    setIsTimerRunning(true);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, status: "in_progress", total_duration_seconds: serverDuration }
          : t
      )
    );
  };

  const handlePauseTimer = async (taskToPause?: Task) => {
    const targetId = taskToPause?.id || activeTaskId;
    if (!targetId) return;

    const currentTask = tasks.find((t) => t.id === targetId) || taskToPause;
    let finalSeconds = currentTask?.total_duration_seconds ?? timerSeconds;

    if (authToken && apiConnected) {
      try {
        const updated = await pauseTimerApi(targetId, authToken, finalSeconds);
        if (updated && typeof updated.total_duration_seconds === "number") {
          finalSeconds = Math.max(finalSeconds, updated.total_duration_seconds);
        }
      } catch (e) {
        console.error(e);
      }
    }

    removeTaskFromLocalTimers(targetId);

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
      prev.map((t) =>
        t.id === targetId
          ? { ...t, status: "paused", total_duration_seconds: finalSeconds }
          : t
      )
    );
  };

  const handleCompleteTask = async (task: Task) => {
    const currentTask = tasks.find((t) => t.id === task.id) || task;
    let finalSeconds = currentTask.total_duration_seconds;
    if (authToken && apiConnected) {
      try {
        const updated = await completeTaskApi(task.id, authToken, finalSeconds);
        if (updated && typeof updated.total_duration_seconds === "number") {
          finalSeconds = Math.max(finalSeconds, updated.total_duration_seconds);
        }
      } catch (e) {
        console.error(e);
      }
    }
    removeTaskFromLocalTimers(task.id);
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
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: "completed",
              total_duration_seconds: finalSeconds,
            }
          : t
      )
    );
  };

  const handleClaimTask = async (task: Task) => {
    if (authToken && apiConnected) {
      try {
        await claimTaskApi(task.id, authToken);
      } catch (e) {
        console.error(e);
      }
    }
    setTasks((prev) =>
      prev.map((t) =>
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
    if (authToken && apiConnected) {
      try {
        await archiveTaskApi(task.id, authToken);
      } catch (e) {
        console.error("Erro ao arquivar na API:", e);
      }
    }
    removeTaskFromLocalTimers(task.id);
    if (activeTaskId === task.id) {
      setIsTimerRunning(false);
      setActiveTaskId(null);
    }
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: "archived" } : t))
    );
    setModalFeedback("Tarefa movida para o repositório de Tarefas Arquivadas.");
    setTimeout(() => setModalFeedback(null), 3500);
  };

  const handleRestoreTask = async (task: Task) => {
    if (authToken && apiConnected) {
      try {
        await restoreTaskApi(task.id, authToken);
      } catch (e) {
        console.error("Erro ao restaurar na API:", e);
      }
    }
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: "completed" } : t))
    );
    setModalFeedback("Tarefa restaurada com sucesso para o Quadro de Tarefas!");
    setTimeout(() => setModalFeedback(null), 3500);
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    setIsDeletingTask(true);
    try {
      if (authToken && apiConnected) {
        await deleteTaskApi(taskToDelete.id, authToken);
      }
      removeTaskFromLocalTimers(taskToDelete.id);
      if (activeTaskId === taskToDelete.id) {
        setIsTimerRunning(false);
        setActiveTaskId(null);
      }
      setTasks((prev) => prev.filter((t) => t.id !== taskToDelete.id));
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

  const handleSaveTaskDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskForDetails) return;
    setIsSubmittingDetails(true);
    try {
      const isPool = detailsForm.assigned_to === "pool";

      const finalStatus: Task["status"] = isPool
        ? "pool"
        : detailsForm.status === "pool"
        ? "assigned"
        : detailsForm.status;

      const manualDurationSeconds = Math.max(
        0,
        (Number(detailsForm.duration_hours) || 0) * 3600 +
          (Number(detailsForm.duration_minutes) || 0) * 60 +
          (Number(detailsForm.duration_seconds) || 0)
      );

      let updatedFromServer: any = null;
      if (authToken && apiConnected) {
        if (isPool) {
          await assignTaskApi(selectedTaskForDetails.id, null, authToken);
          updatedFromServer = await updateTaskApi(selectedTaskForDetails.id, authToken, {
            title: detailsForm.title,
            description: detailsForm.description,
            due_date: detailsForm.due_date ? `${detailsForm.due_date}T18:00:00` : null,
            status: finalStatus,
            total_duration_seconds: manualDurationSeconds,
          });
        } else {
          await assignTaskApi(selectedTaskForDetails.id, detailsForm.assigned_to, authToken);
          updatedFromServer = await updateTaskApi(selectedTaskForDetails.id, authToken, {
            title: detailsForm.title,
            description: detailsForm.description,
            due_date: detailsForm.due_date ? `${detailsForm.due_date}T18:00:00` : null,
            status: finalStatus,
            total_duration_seconds: manualDurationSeconds,
          });
        }
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
        } catch {}
      }
      if (activeTaskId === selectedTaskForDetails.id) {
        setTimerSeconds(manualDurationSeconds);
      }

      const resolvedLawyerName = isPool
        ? undefined
        : updatedFromServer?.assignee?.name || getLawyerNameById(detailsForm.assigned_to);

      setTasks((prev) =>
        prev.map((t) =>
          t.id === selectedTaskForDetails.id
            ? {
                ...t,
                title: detailsForm.title,
                description: detailsForm.description,
                status: finalStatus,
                assigned_to: isPool ? undefined : updatedFromServer?.assigned_to || detailsForm.assigned_to,
                lawyer_name: resolvedLawyerName,
                due_date: detailsForm.due_date || undefined,
                total_duration_seconds: manualDurationSeconds,
              }
            : t
        )
      );

      setSelectedTaskForDetails(null);
      setModalFeedback("Detalhes, tempo e atribuição da tarefa guardados com sucesso!");
      setTimeout(() => setModalFeedback(null), 3500);
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
    if (!taskFormTitle.trim()) return;

    const effectiveClientId = taskFormClientId || (clients.length > 0 ? clients[0].id : "");
    if (!effectiveClientId) {
      alert("Por favor, registe um cliente antes de criar tarefas.");
      return;
    }

    setIsSubmittingTask(true);
    try {
      const selectedCat =
        serviceCategories.find((c) => c.id === taskFormTypeId) ||
        serviceCategories[0] || {
          id: "tp_1",
          name: "Certidões e Registos",
          hourly_rate: 90,
          color: "#92006F",
        };
      const selectedClient = clients.find((c) => c.id === effectiveClientId);
      const resolvedLawyerName = taskFormPublishToPool
        ? undefined
        : getLawyerNameById(taskFormAssignee);

      if (authToken && apiConnected) {
        const created = await createTaskApi(authToken, {
          title: taskFormTitle.trim(),
          description: taskFormDescription.trim() || undefined,
          client_id: effectiveClientId,
          task_type_id: selectedCat.id,
          assigned_to: taskFormPublishToPool ? null : taskFormAssignee,
          due_date: taskFormDueDate ? `${taskFormDueDate}T18:00:00` : null,
          is_urgent_deadline: taskFormIsUrgent,
          publish_to_pool: taskFormPublishToPool,
        });

        const newTask: Task = {
          id: created.id,
          title: created.title,
          description: created.description || "",
          client_id: created.client_id,
          client_name: selectedClient?.name || created.client?.name || "Cliente",
          task_type: selectedCat.name,
          task_type_id: selectedCat.id,
          status: taskFormPublishToPool ? "pool" : "assigned",
          assigned_to: taskFormPublishToPool ? undefined : created.assigned_to || taskFormAssignee,
          lawyer_name: taskFormPublishToPool ? undefined : created.assignee?.name || resolvedLawyerName,
          due_date: taskFormDueDate,
          total_duration_seconds: 0,
        };

        setTasks((prev) => [newTask, ...prev]);
      } else {
        const newTask: Task = {
          id: `tsk_${Date.now()}`,
          title: taskFormTitle.trim(),
          description: taskFormDescription.trim(),
          client_id: effectiveClientId,
          client_name: selectedClient?.name || "Cliente",
          task_type: selectedCat.name,
          task_type_id: selectedCat.id,
          status: taskFormPublishToPool ? "pool" : "assigned",
          assigned_to: taskFormPublishToPool ? undefined : taskFormAssignee,
          lawyer_name: resolvedLawyerName,
          due_date: taskFormDueDate,
          total_duration_seconds: 0,
        };
        setTasks((prev) => [newTask, ...prev]);
      }

      setModalFeedback(`Tarefa criada na categoria "${selectedCat.name}" (${selectedCat.hourly_rate.toFixed(2)} €/h)!`);
      setTimeout(() => setModalFeedback(null), 3500);
      setIsNewTaskModalOpen(false);
      setTaskFormTitle("");
      setTaskFormDescription("");
      setTaskFormDueDate(getTodayDateString());
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
      updateTaskTypeApi(authToken, cat.id, { hourly_rate: cleanRate }).catch(() => {});
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
        saveFeeNoteToDb(cId, nextPrices, useW, true).catch(() => {});
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
      deleteTaskTypeApi(authToken, cat.id).catch(() => {});
    }
    setModalFeedback(`Categoria de serviço "${cat.name}" removida com sucesso.`);
    setTimeout(() => setModalFeedback(null), 3500);
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientFormName.trim()) return;

    setIsSubmittingClient(true);
    try {
      if (authToken && apiConnected) {
        const created = await createClientApi(authToken, {
          name: clientFormName.trim(),
          nif: clientFormNif.trim() || undefined,
          process_reference: clientFormProcess.trim() || undefined,
          email: clientFormEmail.trim() || undefined,
          phone: clientFormPhone.trim() || undefined,
          notes: clientFormNotes.trim() || undefined,
        });

        const newClient: Client = {
          id: created.id,
          name: created.name,
          nif: created.nif,
          process_reference: created.process_reference,
          email: created.email,
          phone: created.phone,
        };
        setClients((prev) => [...prev, newClient]);
        setTaskFormClientId((prev) => prev || newClient.id);
        setSelectedFeeClient((prev) => prev || newClient.id);
      } else {
        const newClient: Client = {
          id: `cli_${Date.now()}`,
          name: clientFormName.trim(),
          nif: clientFormNif.trim(),
          process_reference: clientFormProcess.trim(),
          email: clientFormEmail.trim(),
          phone: clientFormPhone.trim(),
        };
        setClients((prev) => [...prev, newClient]);
        setTaskFormClientId((prev) => prev || newClient.id);
        setSelectedFeeClient((prev) => prev || newClient.id);
      }

      setModalFeedback("Novo cliente registado com sucesso!");
      setTimeout(() => setModalFeedback(null), 3500);
      setIsNewClientModalOpen(false);
      setClientFormName("");
      setClientFormNif("");
      setClientFormProcess("");
      setClientFormEmail("");
      setClientFormPhone("");
      setClientFormNotes("");
    } catch (err: any) {
      alert("Erro ao registar cliente: " + err.message);
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
      } catch {}
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
          ${
            useWithholding
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
        <strong style="color:#333;">A Direção · Dr.ª Patrícia</strong><br/>
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
    if (diffDays <= 3) {
      return {
        diffDays,
        formattedDate,
        level: "red" as const,
        isOverdue: false,
        badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
        dotClass: "bg-rose-500",
        label: `A vencer em ${diffDays} ${diffDays === 1 ? "dia" : "dias"}`,
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
        label: `A vencer em ${diffDays} dias`,
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

            {mustChangePassword ? (
              // ── ECRÃ DE REDEFINIÇÃO OBRIGATÓRIA NO PRIMEIRO LOGIN ──
              <div className="space-y-5">
                <div className="text-center pt-2">
                  <div className="w-12 h-12 rounded-full bg-[#92006F]/10 text-[#92006F] flex items-center justify-center mx-auto mb-2.5">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[#141414] tracking-tight">
                    Definir Palavra-passe
                  </h1>
                  <p className="text-xs text-[#666] mt-1.5 leading-relaxed">
                    Primeiro acesso detetado. Por rigor deontológico e segurança, é obrigatório definir a sua palavra-passe pessoal.
                  </p>
                </div>

                {passwordChangeError && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5 shadow-2xs animate-in fade-in">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{passwordChangeError}</span>
                  </div>
                )}

                <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#444] mb-1.5">
                      Nova Palavra-passe Pessoal:
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="Mínimo 12 caracteres (maiúsculas, números e símbolos)"
                      autoComplete="new-password"
                      className="w-full text-xs sm:text-sm bg-[#FAF8F5] border border-[#D9D1C5] rounded-xl px-3.5 py-2.5 text-[#141414] focus:outline-none focus:ring-2 focus:ring-[#92006F]/30 focus:border-[#92006F] transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#444] mb-1.5">
                      Confirmar Nova Palavra-passe:
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Repita a nova palavra-passe"
                      autoComplete="new-password"
                      className="w-full text-xs sm:text-sm bg-[#FAF8F5] border border-[#D9D1C5] rounded-xl px-3.5 py-2.5 text-[#141414] focus:outline-none focus:ring-2 focus:ring-[#92006F]/30 focus:border-[#92006F] transition-all"
                    />
                  </div>

                  {/* Checklist visual de requisitos */}
                  <div className="p-3 bg-[#FAF8F5] border border-[#ECE6DB] rounded-xl text-[11px] text-[#666] space-y-1">
                    <p className="font-semibold text-[#333] mb-1">Requisitos de segurança:</p>
                    <p className={`flex items-center gap-1.5 ${newPassword.length >= 12 ? "text-emerald-700 font-semibold" : ""}`}>
                      <span className="text-xs">{newPassword.length >= 12 ? "✓" : "•"}</span> Mínimo de 12 caracteres
                    </p>
                    <p className={`flex items-center gap-1.5 ${/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) ? "text-emerald-700 font-semibold" : ""}`}>
                      <span className="text-xs">{/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) ? "✓" : "•"}</span> Letras maiúsculas e minúsculas
                    </p>
                    <p className={`flex items-center gap-1.5 ${/\d/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword) ? "text-emerald-700 font-semibold" : ""}`}>
                      <span className="text-xs">{/\d/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword) ? "✓" : "•"}</span> Pelo menos um algarismo e um símbolo
                    </p>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMustChangePassword(false);
                        setAuthToken(null);
                        setLoginPassword("");
                      }}
                      className="px-4 py-2.5 rounded-xl border border-[#D9D1C5] text-xs font-semibold text-[#666] hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isChangingPassword}
                      className="flex-1 bg-[#92006F] hover:bg-[#7E0060] text-white font-bold text-sm py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isChangingPassword ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>A guardar...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Guardar e Entrar</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              // ── FORMULÁRIO DE LOGIN NORMAL ──
              <>
                <div className="text-center pt-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-[#141414] tracking-tight">
                    PCN Advogadas
                  </h1>
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
                      Usuario:
                    </label>
                    <input
                      type="text"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      placeholder="utilizador@pcnadvogadas.pt"
                      autoComplete="username"
                      className="w-full text-xs sm:text-sm bg-[#FAF8F5] border border-[#D9D1C5] rounded-xl px-3.5 py-2.5 text-[#141414] focus:outline-none focus:ring-2 focus:ring-[#92006F]/30 focus:border-[#92006F] transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#444] mb-1.5">
                      Palavra-passe:
                    </label>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      placeholder="••••••••••••"
                      autoComplete="current-password"
                      className="w-full text-xs sm:text-sm bg-[#FAF8F5] border border-[#D9D1C5] rounded-xl px-3.5 py-2.5 text-[#141414] focus:outline-none focus:ring-2 focus:ring-[#92006F]/30 focus:border-[#92006F] transition-all"
                    />
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
              </>
            )}
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

  return (
    <div className="flex min-h-screen bg-[#F3EFE8]">
      {/* ── GAVETA LATERAL MOBILE / TABLET / PWA (DRAWER) ── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Fundo escuro com blur */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Gaveta do menu */}
          <aside className="relative w-72 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-250 select-none">
            <div>
              {/* Brand Header Mobile com botão Fechar */}
              <div className="p-5 pb-3 flex items-center justify-between border-b border-[#F4EFE6]">
                <div className="flex flex-col items-start">
                  <div className="relative w-36 h-12">
                    <Image
                      src="/logo_pcn.svg"
                      alt="PCN Advogadas"
                      fill
                      className="object-contain"
                      priority
                    />
                  </div>
                  <span className="text-[9px] font-bold tracking-[0.2em] text-[#8C7D6B] uppercase mt-1">
                    Gestão do Escritório
                  </span>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-[#777] hover:bg-[#FAF8F5] hover:text-[#111] transition-colors"
                  aria-label="Fechar menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Links Mobile */}
              <nav className="p-3 space-y-1 mt-1">
                <button
                  onClick={() => switchTab("dashboard")}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === "dashboard"
                      ? "bg-[#FDF2F8] text-[#92006F] font-semibold border border-[#FBCFE8]"
                      : "text-[#555] hover:bg-[#F9F6F0]"
                  }`}
                >
                  <span className="text-[#92006F] text-base">✦</span>
                  <span>Painel de Direção</span>
                </button>

                <button
                  onClick={() => switchTab("tasks")}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === "tasks"
                      ? "bg-[#FDF2F8] text-[#92006F] font-semibold border border-[#FBCFE8]"
                      : "text-[#555] hover:bg-[#F9F6F0]"
                  }`}
                >
                  <Kanban className="w-4 h-4 text-[#888]" />
                  <span>Gestão de Tarefas</span>
                </button>

                <button
                  onClick={() => switchTab("archived")}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === "archived"
                      ? "bg-[#FDF2F8] text-[#92006F] font-semibold border border-[#FBCFE8]"
                      : "text-[#555] hover:bg-[#F9F6F0]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Archive className="w-4 h-4 text-[#888]" />
                    <span>Tarefas Arquivadas</span>
                  </div>
                  {archivedTasksCount > 0 && (
                    <span className="text-[10px] bg-[#92006F]/10 text-[#92006F] font-bold px-2 py-0.5 rounded-full">
                      {archivedTasksCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => switchTab("clients")}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === "clients"
                      ? "bg-[#FDF2F8] text-[#92006F] font-semibold border border-[#FBCFE8]"
                      : "text-[#555] hover:bg-[#F9F6F0]"
                  }`}
                >
                  <Users className="w-4 h-4 text-[#888]" />
                  <span>Clientes PCN</span>
                </button>

                <button
                  onClick={() => switchTab("calendar")}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === "calendar"
                      ? "bg-[#FDF2F8] text-[#92006F] font-semibold border border-[#FBCFE8]"
                      : "text-[#555] hover:bg-[#F9F6F0]"
                  }`}
                >
                  <Scale className="w-4 h-4 text-[#888]" />
                  <span>Agendas e Prazos</span>
                </button>

                <button
                  onClick={() => switchTab("feenotes")}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === "feenotes"
                      ? "bg-[#FDF2F8] text-[#92006F] font-semibold border border-[#FBCFE8]"
                      : "text-[#555] hover:bg-[#F9F6F0]"
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-[#888]" />
                  <span>Notas de Honorários</span>
                </button>

                <button
                  onClick={() => switchTab("reports")}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === "reports"
                      ? "bg-[#FDF2F8] text-[#92006F] font-semibold border border-[#FBCFE8]"
                      : "text-[#555] hover:bg-[#F9F6F0]"
                  }`}
                >
                  <Clock className="w-4 h-4 text-[#888]" />
                  <span>Relatório PCN</span>
                </button>

                {currentUser.role === "admin_lawyer" && (
                  <>
                    <button
                      onClick={() => switchTab("services")}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        activeTab === "services"
                          ? "bg-[#FDF2F8] text-[#92006F] font-semibold border border-[#FBCFE8]"
                          : "text-[#555] hover:bg-[#F9F6F0]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <SlidersHorizontal className="w-4 h-4 text-[#92006F]" />
                        <span>Tabela de Serviços (€/h)</span>
                      </div>
                      <span className="text-[10px] bg-[#92006F] text-white font-bold px-1.5 py-0.5 rounded">
                        Admin
                      </span>
                    </button>

                    <button
                      onClick={() => switchTab("users")}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        activeTab === "users"
                          ? "bg-[#FDF2F8] text-[#92006F] font-semibold border border-[#FBCFE8]"
                          : "text-[#555] hover:bg-[#F9F6F0]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="w-4 h-4 text-[#92006F]" />
                        <span>Gestão de Utilizadoras</span>
                      </div>
                      <span className="text-[10px] bg-[#92006F] text-white font-bold px-1.5 py-0.5 rounded">
                        Admin
                      </span>
                    </button>
                  </>
                )}
              </nav>
            </div>

            {/* Rodapé da Gaveta Mobile */}
            <div className="p-4 space-y-2.5 border-t border-[#F4EFE6] bg-[#FAF8F5]/50">
              {deferredPrompt && (
                <button
                  onClick={handleInstallPwa}
                  className="w-full flex items-center justify-center gap-2 bg-[#92006F] text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-xs hover:bg-[#7E0060] transition-colors cursor-pointer"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Instalar Aplicação PWA</span>
                </button>
              )}

              <div className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-[#555] bg-[#FAF8F5] border border-[#ECE6DB] rounded-md text-left">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold text-[11px] text-emerald-800">
                    Base Conectada · PostgreSQL
                  </span>
                </div>
                <Database className="w-3.5 h-3.5 text-emerald-700" />
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="w-6 h-6 rounded-full bg-[#92006F] text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                    {currentUser.name.replace("Dr.ª ", "").charAt(0)}
                  </div>
                  <div className="truncate text-left leading-tight">
                    <p className="text-[11px] font-bold text-[#141414] truncate">{currentUser.name}</p>
                    <p className="text-[9px] text-[#777] truncate">
                      {currentUser.role === "admin_lawyer" ? "Direção (Admin)" : "Advogada Associada"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleLogout()}
                  className="p-1.5 rounded-md text-rose-700 hover:bg-rose-50 flex items-center gap-1 text-[11px] font-semibold cursor-pointer shrink-0"
                  title="Terminar Sessão"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sair</span>
                </button>
              </div>
              <div className="pt-1 text-[10px] text-[#888] leading-tight">
                <p className="font-bold text-[#666]">PCN ADVOGADAS · PWA</p>
                <p>Plataforma Forense Interna v1.0</p>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── BARRA LATERAL ESQUERDA DESKTOP (SIDEBAR) ── */}
      <aside
        className={`${
          isStandalone || isSidebarCollapsed ? "hidden" : "hidden lg:flex"
        } w-64 bg-white border-r border-[#ECE6DB] flex-col justify-between select-none shadow-[1px_0_10px_rgba(0,0,0,0.02)] shrink-0 transition-all`}
      >
        <div>
          {/* Brand Header */}
          <div className="p-5 pb-3 flex items-center justify-between border-b border-[#F4EFE6]">
            <div className="flex flex-col items-center flex-1">
              <div className="relative w-40 h-14">
                <Image
                  src="/logo_pcn.svg"
                  alt="PCN Advogadas"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <span className="text-[9px] font-bold tracking-[0.2em] text-[#8C7D6B] uppercase mt-1">
                Gestão do Escritório
              </span>
            </div>
            <button
              onClick={() => setIsSidebarCollapsed(true)}
              className="p-1 rounded text-[#888] hover:text-[#111] hover:bg-[#FAF8F5] transition-colors"
              title="Recolher menu lateral"
              aria-label="Recolher menu lateral"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Links Desktop */}
          <nav className="p-3 space-y-1.5 mt-2">
            <button
              onClick={() => switchTab("dashboard")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "dashboard"
                  ? "bg-[#FDF2F8] text-[#92006F] font-semibold shadow-xs border border-[#FBCFE8]"
                  : "text-[#555] hover:bg-[#F9F6F0] hover:text-[#111]"
              }`}
            >
              <span className="text-[#92006F] text-base">✦</span>
              <span>Painel de Direção</span>
            </button>

            <button
              onClick={() => switchTab("tasks")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "tasks"
                  ? "bg-[#FDF2F8] text-[#92006F] font-semibold shadow-xs border border-[#FBCFE8]"
                  : "text-[#555] hover:bg-[#F9F6F0] hover:text-[#111]"
              }`}
            >
              <Kanban className="w-4 h-4 text-[#888]" />
              <span>Gestão de Tarefas</span>
            </button>

            <button
              onClick={() => switchTab("archived")}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "archived"
                  ? "bg-[#FDF2F8] text-[#92006F] font-semibold shadow-xs border border-[#FBCFE8]"
                  : "text-[#555] hover:bg-[#F9F6F0] hover:text-[#111]"
              }`}
            >
              <div className="flex items-center gap-3">
                <Archive className="w-4 h-4 text-[#888]" />
                <span>Tarefas Arquivadas</span>
              </div>
              {archivedTasksCount > 0 && (
                <span className="text-[10px] bg-[#92006F]/10 text-[#92006F] font-bold px-2 py-0.5 rounded-full">
                  {archivedTasksCount}
                </span>
              )}
            </button>

            <button
              onClick={() => switchTab("clients")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "clients"
                  ? "bg-[#FDF2F8] text-[#92006F] font-semibold shadow-xs border border-[#FBCFE8]"
                  : "text-[#555] hover:bg-[#F9F6F0] hover:text-[#111]"
              }`}
            >
              <Users className="w-4 h-4 text-[#888]" />
              <span>Clientes PCN</span>
            </button>

            <button
              onClick={() => switchTab("calendar")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "calendar"
                  ? "bg-[#FDF2F8] text-[#92006F] font-semibold shadow-xs border border-[#FBCFE8]"
                  : "text-[#555] hover:bg-[#F9F6F0] hover:text-[#111]"
              }`}
            >
              <Scale className="w-4 h-4 text-[#888]" />
              <span>Agendas e Prazos</span>
            </button>

            <button
              onClick={() => switchTab("feenotes")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "feenotes"
                  ? "bg-[#FDF2F8] text-[#92006F] font-semibold shadow-xs border border-[#FBCFE8]"
                  : "text-[#555] hover:bg-[#F9F6F0] hover:text-[#111]"
              }`}
            >
              <CreditCard className="w-4 h-4 text-[#888]" />
              <span>Notas de Honorários</span>
            </button>

            <button
              onClick={() => switchTab("reports")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "reports"
                  ? "bg-[#FDF2F8] text-[#92006F] font-semibold shadow-xs border border-[#FBCFE8]"
                  : "text-[#555] hover:bg-[#F9F6F0] hover:text-[#111]"
              }`}
            >
              <Clock className="w-4 h-4 text-[#888]" />
              <span>Relatório PCN</span>
            </button>

            {currentUser.role === "admin_lawyer" && (
              <>
                <button
                  onClick={() => switchTab("services")}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === "services"
                      ? "bg-[#FDF2F8] text-[#92006F] font-semibold shadow-xs border border-[#FBCFE8]"
                      : "text-[#555] hover:bg-[#F9F6F0] hover:text-[#111]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <SlidersHorizontal className="w-4 h-4 text-[#92006F]" />
                    <span>Tabela de Serviços (€/h)</span>
                  </div>
                  <span className="text-[10px] bg-[#92006F] text-white font-bold px-1.5 py-0.5 rounded">
                    Admin
                  </span>
                </button>

                <button
                  onClick={() => switchTab("users")}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === "users"
                      ? "bg-[#FDF2F8] text-[#92006F] font-semibold shadow-xs border border-[#FBCFE8]"
                      : "text-[#555] hover:bg-[#F9F6F0] hover:text-[#111]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-[#92006F]" />
                    <span>Gestão de Utilizadoras</span>
                  </div>
                  <span className="text-[10px] bg-[#92006F] text-white font-bold px-1.5 py-0.5 rounded">
                    Admin
                  </span>
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Sidebar Footer Desktop */}
        <div className="p-4 space-y-2 border-t border-[#F4EFE6]">
          {deferredPrompt && (
            <button
              onClick={handleInstallPwa}
              className="w-full mb-2 flex items-center justify-center gap-2 bg-[#92006F] text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs hover:bg-[#7E0060] transition-colors cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Instalar PCN App</span>
            </button>
          )}

          <div className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-[#555] bg-[#FAF8F5] border border-[#ECE6DB] rounded-md text-left shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-[11px] text-emerald-800">
                Base Conectada · PostgreSQL
              </span>
            </div>
            <Database className="w-3.5 h-3.5 text-emerald-700" />
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-6 h-6 rounded-full bg-[#92006F] text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                {currentUser.name.replace("Dr.ª ", "").charAt(0)}
              </div>
              <div className="truncate text-left leading-tight">
                <p className="text-[11px] font-bold text-[#141414] truncate">{currentUser.name}</p>
                <p className="text-[9px] text-[#777] truncate">
                  {currentUser.role === "admin_lawyer" ? "Direção (Admin)" : "Advogada Associada"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleLogout()}
              className="p-1 rounded text-rose-700 hover:bg-rose-50 cursor-pointer shrink-0"
              title="Terminar Sessão"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="pt-2 text-[10px] text-[#999] leading-tight">
            <p className="font-semibold text-[#666]">PCN ADVOGADAS</p>
            <p>Plataforma Forense {isStandalone ? "· PWA Ativa" : "1.0"}</p>
          </div>
        </div>
      </aside>

      {/* ── ÁREA PRINCIPAL DE CONTEÚDO ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto pb-16 lg:pb-0">
        {/* Barra Superior Mobile / Tablet / PWA com Botão Hamburguer */}
        <div
          className={`${
            isStandalone || isSidebarCollapsed ? "flex" : "flex lg:hidden"
          } bg-white border-b border-[#ECE6DB] px-3 sm:px-4 py-2.5 items-center justify-between sticky top-0 z-30 shadow-xs`}
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 -ml-1 text-[#92006F] hover:bg-[#FAF8F5] rounded-lg transition-colors cursor-pointer"
              aria-label="Abrir menu de navegação"
              title="Abrir menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="relative w-28 sm:w-32 h-7 sm:h-8">
              <Image
                src="/logo_pcn.svg"
                alt="PCN Advogadas"
                fill
                className="object-contain"
                priority
              />
            </div>
            {isStandalone ? (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-[#AA820A] bg-[#FCF8EE] border border-[#F1E5C7] px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3 text-[#AA820A]" />
                PWA Forense
              </span>
            ) : isSidebarCollapsed ? (
              <button
                onClick={() => setIsSidebarCollapsed(false)}
                className="hidden lg:flex items-center gap-1 text-xs text-[#777] hover:text-[#92006F] px-2 py-1 rounded hover:bg-[#FAF8F5]"
                title="Expandir barra lateral"
              >
                <PanelLeftOpen className="w-3.5 h-3.5" />
                <span className="text-[11px]">Fixar Menu</span>
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {deferredPrompt && (
              <button
                onClick={handleInstallPwa}
                className="flex items-center gap-1 bg-[#92006F] text-white text-[11px] font-semibold px-2.5 py-1 rounded-md shadow-xs hover:bg-[#7E0060] transition-colors cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Instalar App</span>
              </button>
            )}

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-[#141414] bg-[#FAF8F5] border border-[#D9D1C5] rounded px-2 py-1">
                {currentUser.name.replace("Dr.ª ", "")}
              </span>
              <button
                type="button"
                onClick={() => handleLogout()}
                className="p-1 rounded text-rose-700 hover:bg-rose-50"
                title="Terminar Sessão"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Cabeçalho Superior com Friso Dourado */}
        <header className="bg-white border-b border-[#ECE6DB] px-4 sm:px-8 pt-4 sm:pt-6 pb-3 sm:pb-4 relative shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold tracking-[0.2em] text-[#8C7D6B] uppercase mb-0.5">
                PCN ADVOGADAS · PLATAFORMA INTERNA
              </p>
              <h1 className="text-xl sm:text-2xl font-bold text-[#141414] tracking-tight">
                {activeTab === "dashboard" && "Painel de Direção"}
                {activeTab === "tasks" && "Gestão de Tarefas & Cronómetro"}
                {activeTab === "archived" && "Tarefas Arquivadas"}
                {activeTab === "clients" && "Clientes PCN"}
                {activeTab === "calendar" && "Agendas e Prazos Processuais"}
                {activeTab === "feenotes" && "Notas de Honorários"}
                {activeTab === "services" && "Tabela de Serviços & Categorias (€/h)"}
                {activeTab === "reports" && "Relatório PCN"}
                {activeTab === "users" && "Gestão de Utilizadoras & Níveis de Acesso"}
              </h1>
              <p className="text-xs text-[#736B5E] mt-0.5 hidden sm:block">
                Rigor jurídico, gestão integrada e identidade PCN.
              </p>
            </div>

            {/* Utilizador Autenticado no Desktop */}
            <div className="hidden lg:flex items-center">
              <div className="flex items-center gap-2 bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-1.5 shadow-2xs">
                <div className="w-6 h-6 rounded-full bg-[#92006F] text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                  {currentUser.name.replace("Dr.ª ", "").charAt(0)}
                </div>
                <div className="leading-tight text-left">
                  <p className="text-xs font-bold text-[#141414] leading-none">
                    {currentUser.name}
                  </p>
                  <p className="text-[10px] text-[#888] font-medium mt-0.5">
                    {currentUser.role === "admin_lawyer" ? "Direção (Admin)" : "Advogada Associada"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Friso Dourado Decorativo */}
          <div className="gold-divider-ribbon absolute bottom-0 left-0 right-0" />
        </header>

        {/* ── CONTEÚDO DA TAB: PAINEL DE DIREÇÃO (ESTRITAMENTE INFORMATIVO) ── */}
        {activeTab === "dashboard" && (
            <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl w-full mx-auto">
              {/* Se o menu lateral estiver recolhido no desktop, botão discreto para reabrir */}
              {isSidebarCollapsed && (
                <div>
                  <button
                    onClick={() => setIsSidebarCollapsed(false)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#92006F] bg-white border border-[#ECE6DB] px-3 py-1.5 rounded-lg hover:bg-[#FDF2F8] transition-colors cursor-pointer shadow-2xs"
                  >
                    <PanelLeftOpen className="w-3.5 h-3.5" />
                    <span>Mostrar Menu Lateral</span>
                  </button>
                </div>
              )}

              {/* Área Central Informativa: Tarefas em Curso & Prazos (8 col) + Equipa (4 col) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Lista Informativa de Tarefas (com link direto para Gestão de Tarefas) */}
                <div className="lg:col-span-8 pcn-card p-6 flex flex-col justify-between">
                  <div>
                    <h2 className="text-base font-bold text-[#141414]">Tarefas em Curso & Prazos</h2>
                    <div className="gold-accent-line w-full my-3.5" />

                    {activeTasks.length === 0 ? (
                      <div className="py-10 text-center text-xs text-[#888]">
                        Não existem tarefas ativas de momento.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {[...activeTasks]
                          .sort((a, b) => {
                            if (a.status === "in_progress" && b.status !== "in_progress") return -1;
                            if (a.status !== "in_progress" && b.status === "in_progress") return 1;
                            const da = getDeadlineInfo(a.due_date);
                            const db = getDeadlineInfo(b.due_date);
                            if (da && db) return da.diffDays - db.diffDays;
                            if (da && !db) return -1;
                            if (!da && db) return 1;
                            return 0;
                          })
                          .slice(0, 8)
                          .map((task) => {
                            const dInfo = getDeadlineInfo(task.due_date);
                            const isRunning = task.status === "in_progress";
                            const isPaused = task.status === "paused";
                            const isPool = task.status === "pool";
                            const respName = isPool
                              ? "Pool Partilhada"
                              : task.lawyer_name && task.lawyer_name !== "—"
                              ? task.lawyer_name.replace("Dr.ª ", "")
                              : "Atribuída";

                            return (
                              <div
                                key={task.id}
                                onClick={() => {
                                  setTaskStatusFilter("all");
                                  switchTab("tasks");
                                }}
                                className="p-3 sm:px-3.5 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F8F5EE] border border-[#E5DEC9] shadow-xs hover:bg-white hover:border-[#D4AF37] hover:shadow-md rounded-xl transition-all cursor-pointer group"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-bold text-[#92006F]">
                                      {task.client_name}
                                    </span>
                                    <span className="text-[#D9D1C5]">·</span>
                                    <span className="text-xs font-semibold text-[#141414] group-hover:text-[#92006F] truncate transition-colors">
                                      {task.title}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#736B5E]">
                                    <span>{respName}</span>
                                    {dInfo && (
                                      <>
                                        <span>·</span>
                                        <span
                                          className={`inline-flex items-center gap-1 font-semibold ${
                                            dInfo.level === "red"
                                              ? "text-rose-700"
                                              : dInfo.level === "yellow"
                                              ? "text-amber-700"
                                              : "text-emerald-700"
                                          }`}
                                        >
                                          <span className={`w-1.5 h-1.5 rounded-full ${dInfo.dotClass}`} />
                                          {dInfo.formattedDate} ({dInfo.label})
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                  {isRunning ? (
                                    <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                                      Em andamento
                                    </span>
                                  ) : isPaused ? (
                                    <span className="text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full">
                                      Em pausa
                                    </span>
                                  ) : isPool ? (
                                    <span className="text-[10px] font-semibold bg-purple-50 text-[#92006F] border border-purple-200 px-2.5 py-0.5 rounded-full">
                                      Na Pool
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-semibold bg-white text-[#666] border border-[#E5DECF] px-2.5 py-0.5 rounded-full">
                                      Aberta
                                    </span>
                                  )}

                                  <span className="text-[11px] font-semibold text-[#92006F] group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                                    <span>Ir para tarefa</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#F2EDE4] flex justify-end">
                    <button
                      onClick={() => {
                        setTaskStatusFilter("all");
                        switchTab("tasks");
                      }}
                      className="text-xs font-semibold text-[#92006F] hover:underline cursor-pointer"
                    >
                      Ver quadro completo →
                    </button>
                  </div>
                </div>

                {/* Coluna Direita (4 col): Equipa (Informativo, sem cronómetro) */}
                <div className="lg:col-span-4 pcn-card p-6 flex flex-col justify-between">
                  <div>
                    <h2 className="text-base font-bold text-[#141414]">Equipa</h2>
                    <div className="gold-accent-line w-full my-3.5" />

                    <div className="space-y-2.5">
                      {usersList.map((u) => {
                        const userTasks = tasks.filter(
                          (t) =>
                            t.status !== "archived" &&
                            (t.assigned_to === u.id ||
                              (t.lawyer_name &&
                                t.lawyer_name.toLowerCase() === u.name.toLowerCase()))
                        );
                        const runningCnt = userTasks.filter((t) => t.status === "in_progress").length;
                        const pausedCnt = userTasks.filter((t) => t.status === "paused").length;
                        const activeCnt = userTasks.filter((t) => t.status !== "completed").length;

                        return (
                          <div
                            key={u.id}
                            className="p-2.5 px-3 bg-[#F8F5EE] border border-[#E5DEC9] shadow-2xs rounded-xl flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-[#92006F]/10 text-[#92006F] font-bold text-xs flex items-center justify-center shrink-0">
                                {u.name.replace("Dr.ª ", "").charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-[#141414] truncate">{u.name}</p>
                                <p className="text-[10px] text-[#736B5E]">
                                  {runningCnt > 0
                                    ? `${runningCnt} em andamento`
                                    : pausedCnt > 0
                                    ? `${pausedCnt} em pausa`
                                    : "Sem tarefas em execução"}
                                </p>
                              </div>
                            </div>

                            <span className="text-xs font-semibold text-[#555] bg-white border border-[#E5DEC9] px-2.5 py-0.5 rounded-full shrink-0 shadow-2xs">
                              {activeCnt} {activeCnt === 1 ? "ativa" : "ativas"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#F2EDE4]">
                    <button
                      onClick={() => switchTab("reports")}
                      className="w-full bg-[#FAF8F5] hover:bg-[#F3EFE6] border border-[#D9D1C5] text-[#141414] text-xs font-semibold py-2 rounded-lg transition-colors cursor-pointer"
                    >
                      Relatório das 9h00 →
                    </button>
                  </div>
                </div>
              </div>
            </div>
        )}

        {/* ── CONTEÚDO DA TAB: GESTÃO DE TAREFAS ── */}
        {activeTab === "tasks" && (
          <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl w-full mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#141414]">Quadro Operacional de Tarefas</h2>
                <p className="text-xs text-[#736B5E]">
                  Inicie, pause e conclua tarefas. O cronómetro sincroniza com a base de dados.
                </p>
              </div>

              {currentUser.role === "admin_lawyer" && (
                <button
                  onClick={() => {
                    if (!taskFormClientId && clients.length > 0) {
                      setTaskFormClientId(clients[0].id);
                    }
                    setTaskFormDueDate(getTodayDateString());
                    setIsNewTaskModalOpen(true);
                  }}
                  className="bg-[#92006F] hover:bg-[#7E0060] text-white text-xs font-semibold px-4 py-2 rounded-md shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Criar Nova Tarefa</span>
                </button>
              )}
            </div>

            {/* Filtros Rápidos por Estado (Pool, Abertas, Em Andamento, Pausadas, Concluídas) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[#DFD6C5] -mx-1 px-1">
              {[
                { id: "all", label: "Todas", count: tasks.filter((t) => t.status !== "archived").length },
                { id: "pool", label: "Pool", count: tasks.filter((t) => t.status === "pool").length },
                { id: "assigned", label: "Abertas", count: tasks.filter((t) => t.status === "assigned").length },
                { id: "in_progress", label: "Em Andamento", count: tasks.filter((t) => t.status === "in_progress").length },
                { id: "paused", label: "Pausadas", count: tasks.filter((t) => t.status === "paused").length },
                { id: "completed", label: "Concluídas", count: tasks.filter((t) => t.status === "completed").length },
              ].map((f) => {
                const isSelected = taskStatusFilter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setTaskStatusFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? "bg-[#92006F] text-white shadow-sm"
                        : "bg-white text-[#666] border border-[#DFD6C5] shadow-2xs hover:border-[#AA820A] hover:text-[#111]"
                    }`}
                  >
                    <span>{f.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-[#F3EFE8] text-[#666] border border-[#E2D9C8]"
                      }`}
                    >
                      {f.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Visualização: Quando filtro é "all" -> Modo Kanban de 4 Colunas */}
            {taskStatusFilter === "all" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
                {/* Coluna 1: Pool Partilhada */}
                <div className="pcn-kanban-col p-3.5 sm:p-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#DDD3C0]">
                    <h3 className="text-xs font-bold text-[#141414] uppercase tracking-wider">
                      Pool Partilhada ({tasks.filter((t) => t.status === "pool").length})
                    </h3>
                    <span className="text-[10px] bg-purple-100 text-[#92006F] px-2 py-0.5 rounded font-semibold">
                      Livre
                    </span>
                  </div>

                  <div className="space-y-3.5 mt-3.5">
                    {tasks
                      .filter((t) => t.status === "pool")
                      .map((task) => {
                        const dInfo = getDeadlineInfo(task.due_date);
                        return (
                          <div
                            key={task.id}
                            className="pcn-task-card p-3 sm:p-3.5 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-[#92006F] uppercase">
                                {task.task_type}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => openTaskDetails(task)}
                                  className="text-[#888] hover:text-[#92006F] p-1 rounded cursor-pointer"
                                  title="Detalhes & Reatribuir"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => confirmDeleteTask(task)}
                                  className="text-[#999] hover:text-rose-600 p-1 rounded cursor-pointer"
                                  title="Eliminar Tarefa"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <h4
                              onClick={() => openTaskDetails(task)}
                              className="text-xs font-bold text-[#141414] hover:text-[#92006F] cursor-pointer"
                            >
                              {task.title}
                            </h4>
                            <p className="text-[11px] text-[#666] line-clamp-2">{task.description}</p>
                            {dInfo && (
                              <div className="pt-0.5">
                                <span
                                  className={`text-[10px] border px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 ${dInfo.badgeClass}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${dInfo.dotClass}`} />
                                  {dInfo.formattedDate} · {dInfo.label}
                                </span>
                              </div>
                            )}
                            <div className="pt-2 border-t border-[#F2ECE1] flex items-center justify-between text-[11px] text-[#888]">
                              <span>{task.client_name}</span>
                              <button
                                onClick={() => handleClaimTask(task)}
                                className="bg-[#92006F] text-white text-[10px] font-semibold px-2.5 py-1 rounded hover:bg-[#7E0060] transition-colors cursor-pointer"
                              >
                                Assumir Tarefa
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    {tasks.filter((t) => t.status === "pool").length === 0 && (
                      <p className="text-xs text-[#888] text-center py-6 italic">
                        Nenhuma tarefa na Pool de momento.
                      </p>
                    )}
                  </div>
                </div>

                {/* Coluna 2: Em Andamento (e Abertas) */}
                <div className="pcn-kanban-col p-3.5 sm:p-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#DDD3C0]">
                    <h3 className="text-xs font-bold text-[#141414] uppercase tracking-wider">
                      Em Andamento (
                      {
                        tasks.filter(
                          (t) => t.status === "assigned" || t.status === "in_progress"
                        ).length
                      }
                      )
                    </h3>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">
                      Em Execução
                    </span>
                  </div>

                  <div className="space-y-3.5 mt-3.5">
                    {tasks
                      .filter(
                        (t) => t.status === "assigned" || t.status === "in_progress"
                      )
                      .map((task) => {
                        const isRunningThis = task.status === "in_progress";
                        const dInfo = getDeadlineInfo(task.due_date);
                        return (
                          <div
                            key={task.id}
                            className={`pcn-task-card ${
                              isRunningThis ? "border-[#92006F] ring-2 ring-[#92006F]/25" : ""
                            } p-3 sm:p-3.5 space-y-2.5`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-[#92006F] uppercase">
                                {task.task_type}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {task.status === "in_progress" && (
                                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <Play className="w-2.5 h-2.5 fill-current" /> Em Andamento
                                  </span>
                                )}
                                {task.status === "assigned" && (
                                  <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">
                                    Aberta
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-start justify-between gap-2">
                              <h4
                                onClick={() => openTaskDetails(task)}
                                className="text-xs font-bold text-[#141414] hover:text-[#92006F] cursor-pointer"
                              >
                                {task.title}
                              </h4>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => openTaskDetails(task)}
                                  className="text-[#888] hover:text-[#92006F] p-1 rounded cursor-pointer"
                                  title="Detalhes & Reatribuir"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => confirmDeleteTask(task)}
                                  className="text-[#999] hover:text-rose-600 p-1 rounded cursor-pointer"
                                  title="Eliminar Tarefa"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="text-[11px] text-[#777] flex items-center justify-between">
                              <span>Cliente: <strong>{task.client_name}</strong></span>
                              <span>Resp: <strong>{task.lawyer_name || "—"}</strong></span>
                            </div>

                            {dInfo && (
                              <div>
                                <span
                                  className={`text-[10px] border px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 ${dInfo.badgeClass}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${dInfo.dotClass}`} />
                                  {dInfo.formattedDate} · {dInfo.label}
                                </span>
                              </div>
                            )}

                            <div className="bg-[#F6F2EA] p-2 rounded border border-[#E4DDD0] flex items-center justify-between text-xs font-mono">
                              <span className="text-[#666]">Tempo acumulado:</span>
                              <span className="font-bold text-[#141414]">
                                {formatSeconds(task.total_duration_seconds)}
                              </span>
                            </div>

                            <div className="pt-2 border-t border-[#F2ECE1] flex items-center justify-between gap-2">
                              {task.status === "in_progress" ? (
                                <button
                                  onClick={() => handlePauseTimer(task)}
                                  className="w-full bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold py-1.5 rounded flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Pause className="w-3 h-3" /> Pausar
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleStartTimer(task)}
                                  className="w-full bg-[#92006F] hover:bg-[#7E0060] text-white text-[11px] font-semibold py-1.5 rounded flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Play className="w-3 h-3 fill-current" /> Iniciar
                                </button>
                              )}

                              <button
                                onClick={() => handleCompleteTask(task)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold px-3 py-1.5 rounded cursor-pointer transition-colors"
                              >
                                Concluir
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    {tasks.filter(
                      (t) => t.status === "assigned" || t.status === "in_progress"
                    ).length === 0 && (
                      <p className="text-xs text-[#888] text-center py-6 italic">
                        Nenhuma tarefa em andamento.
                      </p>
                    )}
                  </div>
                </div>

                {/* Coluna 3: Pausadas */}
                <div className="pcn-kanban-col p-3.5 sm:p-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#DDD3C0]">
                    <h3 className="text-xs font-bold text-[#141414] uppercase tracking-wider">
                      Pausadas ({tasks.filter((t) => t.status === "paused").length})
                    </h3>
                    <span className="text-[10px] bg-amber-100 text-[#AA820A] px-2 py-0.5 rounded font-semibold">
                      Em Pausa
                    </span>
                  </div>

                  <div className="space-y-3.5 mt-3.5">
                    {tasks
                      .filter((t) => t.status === "paused")
                      .map((task) => {
                        const dInfo = getDeadlineInfo(task.due_date);
                        return (
                          <div
                            key={task.id}
                            className="pcn-task-card p-3 sm:p-3.5 space-y-2.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-[#92006F] uppercase">
                                {task.task_type}
                              </span>
                              <span className="text-[10px] bg-amber-100 text-[#AA820A] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Pause className="w-2.5 h-2.5" /> Pausada
                              </span>
                            </div>

                            <div className="flex items-start justify-between gap-2">
                              <h4
                                onClick={() => openTaskDetails(task)}
                                className="text-xs font-bold text-[#141414] hover:text-[#92006F] cursor-pointer"
                              >
                                {task.title}
                              </h4>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => openTaskDetails(task)}
                                  className="text-[#888] hover:text-[#92006F] p-1 rounded cursor-pointer"
                                  title="Detalhes & Reatribuir"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => confirmDeleteTask(task)}
                                  className="text-[#999] hover:text-rose-600 p-1 rounded cursor-pointer"
                                  title="Eliminar Tarefa"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="text-[11px] text-[#777] flex items-center justify-between">
                              <span>Cliente: <strong>{task.client_name}</strong></span>
                              <span>Resp: <strong>{task.lawyer_name || "—"}</strong></span>
                            </div>

                            {dInfo && (
                              <div>
                                <span
                                  className={`text-[10px] border px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 ${dInfo.badgeClass}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${dInfo.dotClass}`} />
                                  {dInfo.formattedDate} · {dInfo.label}
                                </span>
                              </div>
                            )}

                            <div className="bg-[#F6F2EA] p-2 rounded border border-[#E4DDD0] flex items-center justify-between text-xs font-mono">
                              <span className="text-[#666]">Tempo acumulado:</span>
                              <span className="font-bold text-[#141414]">
                                {formatSeconds(task.total_duration_seconds)}
                              </span>
                            </div>

                            <div className="pt-2 border-t border-[#F2ECE1] flex items-center justify-between gap-2">
                              <button
                                onClick={() => handleStartTimer(task)}
                                className="w-full bg-[#92006F] hover:bg-[#7E0060] text-white text-[11px] font-semibold py-1.5 rounded flex items-center justify-center gap-1 cursor-pointer transition-colors"
                              >
                                <Play className="w-3 h-3 fill-current" /> Iniciar
                              </button>

                              <button
                                onClick={() => handleCompleteTask(task)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold px-3 py-1.5 rounded cursor-pointer transition-colors"
                              >
                                Concluir
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    {tasks.filter((t) => t.status === "paused").length === 0 && (
                      <p className="text-xs text-[#888] text-center py-6 italic">
                        Nenhuma tarefa pausada de momento.
                      </p>
                    )}
                  </div>
                </div>

                {/* Coluna 4: Tarefas Concluídas */}
                <div className="pcn-kanban-col p-3.5 sm:p-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#DDD3C0]">
                    <h3 className="text-xs font-bold text-[#141414] uppercase tracking-wider">
                      Concluídas ({tasks.filter((t) => t.status === "completed").length})
                    </h3>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">
                      Finalizadas
                    </span>
                  </div>

                  <div className="space-y-3.5 mt-3.5">
                    {tasks
                      .filter((t) => t.status === "completed")
                      .map((task) => (
                        <div
                          key={task.id}
                          className="pcn-task-card p-3 sm:p-3.5 space-y-2 opacity-95"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-emerald-700 uppercase">
                              {task.task_type}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openTaskDetails(task)}
                                className="text-[#888] hover:text-[#92006F] p-1 rounded cursor-pointer"
                                title="Detalhes & Reatribuir"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => confirmDeleteTask(task)}
                                className="text-[#999] hover:text-rose-600 p-1 rounded cursor-pointer"
                                title="Eliminar Tarefa"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <h4
                            onClick={() => openTaskDetails(task)}
                            className="text-xs font-bold text-[#141414] line-through text-[#666] hover:text-[#92006F] cursor-pointer"
                          >
                            {task.title}
                          </h4>

                          <div className="text-[11px] text-[#666] flex justify-between">
                            <span>Tempo total:</span>
                            <strong>{formatSeconds(task.total_duration_seconds)}</strong>
                          </div>

                          <div className="pt-2 border-t border-[#F2ECE1] flex items-center justify-between gap-2">
                            <button
                              onClick={() => handleArchiveTask(task)}
                              className="w-full bg-[#5E0047] hover:bg-[#4A0038] text-white text-[11px] font-semibold py-1.5 px-2 rounded flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
                              title="Mover para Arquivadas (sai do quadro)"
                            >
                              <Archive className="w-3.5 h-3.5" />
                              <span>Mover para Arquivadas</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    {tasks.filter((t) => t.status === "completed").length === 0 && (
                      <p className="text-xs text-[#888] text-center py-6 italic">
                        Nenhuma tarefa concluída no quadro ativo.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Visualização Filtrada Específica */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-[#141414] uppercase tracking-wider">
                    {taskStatusFilter === "pool" && "Tarefas na Pool Partilhada"}
                    {taskStatusFilter === "assigned" && "Tarefas Abertas / Atribuídas"}
                    {taskStatusFilter === "in_progress" && "Tarefas Em Andamento"}
                    {taskStatusFilter === "paused" && "Tarefas Pausadas"}
                    {taskStatusFilter === "completed" && "Tarefas Concluídas"} (
                    {tasks.filter((t) => t.status === taskStatusFilter).length})
                  </h3>
                  <button
                    onClick={() => setTaskStatusFilter("all")}
                    className="text-xs font-semibold text-[#92006F] hover:underline cursor-pointer"
                  >
                    Ver todas no Quadro
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tasks
                    .filter((t) => t.status === taskStatusFilter)
                    .map((task) => {
                      const dInfo = getDeadlineInfo(task.due_date);
                      return (
                        <div
                          key={task.id}
                          className="pcn-task-card p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-[#92006F] uppercase">
                              {task.task_type}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openTaskDetails(task)}
                                className="text-[#888] hover:text-[#92006F] p-1 rounded cursor-pointer"
                                title="Detalhes & Reatribuir"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => confirmDeleteTask(task)}
                                className="text-[#999] hover:text-rose-600 p-1 rounded cursor-pointer"
                                title="Eliminar Tarefa"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <h4
                            onClick={() => openTaskDetails(task)}
                            className={`text-xs sm:text-sm font-bold text-[#141414] hover:text-[#92006F] cursor-pointer ${
                              task.status === "completed" ? "line-through text-[#777]" : ""
                            }`}
                          >
                            {task.title}
                          </h4>

                          {dInfo && task.status !== "completed" && (
                            <div>
                              <span
                                className={`text-[10px] border px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 ${dInfo.badgeClass}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${dInfo.dotClass}`} />
                                {dInfo.formattedDate} · {dInfo.label}
                              </span>
                            </div>
                          )}

                          <div className="bg-[#FAF7F2] p-2.5 rounded-lg border border-[#EFE8DD] text-xs space-y-1">
                            <div className="flex justify-between text-[#666]">
                              <span>Cliente:</span>
                              <strong className="text-[#333]">{task.client_name}</strong>
                            </div>
                            <div className="flex justify-between text-[#666]">
                              <span>Advogada:</span>
                              <span className="text-[#333] font-medium">{task.lawyer_name || "—"}</span>
                            </div>
                            <div className="flex justify-between text-[#666]">
                              <span>Tempo acumulado:</span>
                              <strong className="font-mono text-[#141414]">
                                {formatSeconds(task.total_duration_seconds)}
                              </strong>
                            </div>
                          </div>

                          {/* Ações contextuais por estado */}
                          <div className="pt-2 border-t border-[#F2ECE1] flex items-center justify-between gap-2">
                            {task.status === "pool" && (
                              <button
                                onClick={() => handleClaimTask(task)}
                                className="w-full bg-[#92006F] hover:bg-[#7E0060] text-white text-xs font-semibold py-1.5 rounded-md cursor-pointer transition-colors"
                              >
                                Assumir Tarefa
                              </button>
                            )}

                          {task.status === "assigned" && (
                            <>
                              <button
                                onClick={() => handleStartTimer(task)}
                                className="flex-1 bg-[#92006F] hover:bg-[#7E0060] text-white text-xs font-semibold py-1.5 rounded-md flex items-center justify-center gap-1 cursor-pointer transition-colors"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" /> Iniciar
                              </button>
                              <button
                                onClick={() => handleCompleteTask(task)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-1.5 px-3 rounded-md cursor-pointer transition-colors"
                              >
                                Concluir
                              </button>
                            </>
                          )}

                          {task.status === "in_progress" && (
                            <>
                              <button
                                onClick={() => handlePauseTimer(task)}
                                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold py-1.5 rounded-md flex items-center justify-center gap-1 cursor-pointer transition-colors"
                              >
                                <Pause className="w-3.5 h-3.5" /> Pausar
                              </button>
                              <button
                                onClick={() => handleCompleteTask(task)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-1.5 px-3 rounded-md cursor-pointer transition-colors"
                              >
                                Concluir
                              </button>
                            </>
                          )}

                          {task.status === "paused" && (
                            <>
                              <button
                                onClick={() => handleStartTimer(task)}
                                className="flex-1 bg-[#92006F] hover:bg-[#7E0060] text-white text-xs font-semibold py-1.5 rounded-md flex items-center justify-center gap-1 cursor-pointer transition-colors"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" /> Iniciar
                              </button>
                              <button
                                onClick={() => handleCompleteTask(task)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-1.5 px-3 rounded-md cursor-pointer transition-colors"
                              >
                                Concluir
                              </button>
                            </>
                          )}

                          {task.status === "completed" && (
                            <button
                              onClick={() => handleArchiveTask(task)}
                              className="w-full bg-[#5E0047] hover:bg-[#4A0038] text-white text-xs font-semibold py-1.5 rounded-md flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
                              title="Mover para Arquivadas (sai do quadro)"
                            >
                              <Archive className="w-3.5 h-3.5" />
                              <span>Mover para Arquivadas</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {tasks.filter((t) => t.status === taskStatusFilter).length === 0 && (
                    <div className="col-span-full p-8 text-center bg-white rounded-xl border border-dashed border-[#D9D1C5]">
                      <p className="text-xs text-[#777]">
                        Nenhuma tarefa encontrada com o estado selecionado.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CONTEÚDO DA TAB: TAREFAS ARQUIVADAS ── */}
        {activeTab === "archived" && (
          <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl w-full mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Archive className="w-5 h-5 text-[#92006F]" />
                  <h2 className="text-base sm:text-lg font-bold text-[#141414]">Tarefas Arquivadas</h2>
                </div>
                <p className="text-xs text-[#736B5E]">
                  Repositório de tarefas finalizadas e arquivadas. Não constam no quadro ativo.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold bg-[#FDF2F8] text-[#92006F] border border-[#FBCFE8] px-3 py-1.5 rounded-lg">
                  {tasks.filter((t) => t.status === "archived").length} arquivada(s)
                </span>
              </div>
            </div>

            {tasks.filter((t) => t.status === "archived").length === 0 ? (
              <div className="pcn-card p-10 text-center bg-white border border-dashed border-[#D9D1C5] rounded-xl space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full bg-[#FAF5EB] flex items-center justify-center text-[#AA820A]">
                  <Archive className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-[#333]">Nenhuma tarefa arquivada</h3>
                <p className="text-xs text-[#777] max-w-md mx-auto">
                  As tarefas concluídas no Quadro de Tarefas podem ser movidas para este arquivo através do botão "Mover para Arquivadas", mantendo o quadro limpo.
                </p>
                <button
                  onClick={() => switchTab("tasks")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#92006F] hover:underline cursor-pointer"
                >
                  <span>Ir para o Quadro de Tarefas</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tasks
                  .filter((t) => t.status === "archived")
                  .map((task) => (
                    <div
                      key={task.id}
                      className="pcn-task-card p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#665F54] uppercase bg-[#F3EFE8] px-2 py-0.5 rounded border border-[#E2DAD0]">
                          {task.task_type}
                        </span>
                        <span className="text-[10px] font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded flex items-center gap-1">
                          <Archive className="w-3 h-3" /> Arquivada
                        </span>
                      </div>

                      <h4
                        onClick={() => openTaskDetails(task)}
                        className="text-xs sm:text-sm font-bold text-[#141414] line-through text-[#666] hover:text-[#92006F] cursor-pointer"
                      >
                        {task.title}
                      </h4>
                      {task.description && (
                        <p className="text-[11px] text-[#777] line-clamp-2">{task.description}</p>
                      )}

                      <div className="bg-[#F5F1EA] p-2.5 rounded-lg border border-[#E4DDD2] text-xs space-y-1">
                        <div className="flex justify-between text-[#666]">
                          <span>Cliente:</span>
                          <strong className="text-[#333]">{task.client_name}</strong>
                        </div>
                        <div className="flex justify-between text-[#666]">
                          <span>Advogada:</span>
                          <span className="text-[#333] font-medium">{task.lawyer_name || "—"}</span>
                        </div>
                        <div className="flex justify-between text-[#666]">
                          <span>Tempo final acumulado:</span>
                          <strong className="font-mono text-[#141414]">
                            {formatSeconds(task.total_duration_seconds)}
                          </strong>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[#F2ECE1] flex items-center justify-between gap-2">
                        <button
                          onClick={() => handleRestoreTask(task)}
                          className="flex-1 bg-white hover:bg-[#FAF8F5] border border-[#D9D1C5] text-[#333] text-[11px] font-semibold py-1.5 px-2 rounded-md flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          title="Restaurar tarefa de volta ao Quadro"
                        >
                          <ArchiveRestore className="w-3.5 h-3.5 text-[#92006F]" />
                          <span>Restaurar ao Quadro</span>
                        </button>

                        <button
                          onClick={() => openTaskDetails(task)}
                          className="bg-white hover:bg-[#FAF8F5] border border-[#D9D1C5] text-[#555] text-[11px] font-medium py-1.5 px-2.5 rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                          title="Ver detalhes da tarefa"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => confirmDeleteTask(task)}
                          className="text-[#999] hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-md cursor-pointer transition-colors"
                          title="Eliminar permanentemente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ── CONTEÚDO DA TAB: NOTAS DE HONORÁRIOS (PATRÍCIA EXCLUSIVE) ── */}
        {activeTab === "feenotes" &&
          (() => {
            const clientTasks = tasks.filter((t) => t.client_id === selectedFeeClient);
            const totalClientSeconds = clientTasks.reduce(
              (acc, t) => acc + (t.total_duration_seconds || 0),
              0
            );
            const theoreticalCategoryTotal = clientTasks.reduce(
              (acc, t) => acc + calculateTaskFeeByCategory(t, billingRoundingMinutes),
              0
            );
            const subtotal = clientTasks.reduce((acc, t) => {
              const val = feeTaskPrices[t.id] ?? (t.fee_amount || 0);
              return acc + (Number.isFinite(val) ? val : 0);
            }, 0);
            const useWithholding = applyWithholdingByClient[selectedFeeClient] ?? true;
            const vatAmount = Math.round(subtotal * 0.23 * 100) / 100;
            const withholdingAmount = useWithholding
              ? Math.round(subtotal * 0.23 * 100) / 100
              : 0;
            const totalToPay = Math.round((subtotal + vatAmount - withholdingAmount) * 100) / 100;
            const savedClientNote = feeNotesByClient[selectedFeeClient];
            const currentRefCode = savedClientNote?.reference_code || "NH-2026-0001";

            const handleCalculateAllByCategoryRates = () => {
              if (clientTasks.length === 0) return;
              const nextPrices: Record<string, number> = { ...feeTaskPrices };
              for (const t of clientTasks) {
                nextPrices[t.id] = calculateTaskFeeByCategory(t, billingRoundingMinutes);
              }
              setFeeTaskPrices(nextPrices);
              saveFeeNoteToDb(selectedFeeClient, nextPrices, useWithholding, false).catch((err) =>
                console.error("Erro ao guardar cálculo automático:", err)
              );
              setModalFeedback(
                `Honorários calculados automaticamente segundo a Tabela de Serviços (€/h por categoria) para ${clientTasks.length} tarefa(s)!`
              );
              setTimeout(() => setModalFeedback(null), 3500);
            };

            return (
              <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl w-full mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#141414]">
                      Notas de Honorários PCN · Cálculo Automático por Categoria de Serviço
                    </h2>
                    <p className="text-xs text-[#736B5E]">
                      Área financeira reservada à Direção. O sistema calcula cada ato de acordo com o valor (€/h) definido na Tabela de Serviços Forenses.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleCalculateAllByCategoryRates}
                      disabled={clientTasks.length === 0}
                      className="bg-[#FAF5E8] hover:bg-[#F3E9CE] text-[#8F6D07] border border-[#E5D3A1] text-xs font-bold px-3 sm:px-4 py-2 rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      title="Converte automaticamente o tempo gasto em cada tarefa pelo valor €/h definido na sua Categoria de Serviço"
                    >
                      <Sparkles className="w-4 h-4 shrink-0 text-[#AA820A]" />
                      <span>Calcular Tudo pela Categoria (€/h)</span>
                    </button>

                    <button
                      onClick={handleExportOfficialPdf}
                      disabled={clientTasks.length === 0}
                      className="bg-[#92006F] hover:bg-[#7A005D] text-white text-xs font-bold px-3.5 sm:px-4 py-2 rounded-md shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      title="Gerar Documento Oficial A4 de Nota de Honorários pronto para PDF ou Impressão"
                    >
                      <Download className="w-3.5 h-3.5 text-[#F3D066]" />
                      <span>Emitir PDF Oficial (A4)</span>
                    </button>

                    <button
                      onClick={() => handleExportExcel(false)}
                      disabled={isExportingExcel || clientTasks.length === 0}
                      className="bg-white hover:bg-[#FAF8F5] text-[#333] border border-[#D9D1C5] text-xs font-semibold px-3 py-2 rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 shrink-0 text-[#92006F]" />
                      <span>{isExportingExcel ? "A descarregar..." : "Excel (Cliente)"}</span>
                    </button>
                  </div>
                </div>

                {/* Seletor de Cliente + Resumo de Categorias Ativas + Arredondamento Forense */}
                <div className="pcn-card p-4 sm:p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                      <label className="text-xs font-bold text-[#444] block mb-1.5">
                        Selecione o Cliente para Faturação:
                      </label>
                      <select
                        value={selectedFeeClient}
                        onChange={(e) => setSelectedFeeClient(e.target.value)}
                        className="w-full text-xs text-[#222] bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 focus:ring-1 focus:ring-[#92006F] outline-none font-medium"
                      >
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.nif || "Sem NIF"} — {c.process_reference || "Geral"})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[#444] block mb-1.5">
                        Tabela de Preços Aplicada:
                      </label>
                      <div className="flex items-center justify-between bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2">
                        <span className="text-xs font-semibold text-[#141414]">
                          {serviceCategories.length} Categorias de Serviço Ativas
                        </span>
                        <button
                          type="button"
                          onClick={() => switchTab("services")}
                          className="text-[11px] font-bold text-[#92006F] hover:underline cursor-pointer"
                        >
                          Gerir Preços →
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[#444] block mb-1.5">
                        Arredondamento de Tempo Forense:
                      </label>
                      <select
                        value={billingRoundingMinutes}
                        onChange={(e) => {
                          const nextRounding = parseInt(e.target.value, 10) as 0 | 6 | 15;
                          updateBillingRounding(nextRounding);
                          if (clientTasks.length > 0) {
                            const nextPrices: Record<string, number> = { ...feeTaskPrices };
                            for (const t of clientTasks) {
                              nextPrices[t.id] = calculateTaskFeeByCategory(t, nextRounding);
                            }
                            setFeeTaskPrices(nextPrices);
                            saveFeeNoteToDb(selectedFeeClient, nextPrices, useWithholding, true).catch(
                              () => {}
                            );
                          }
                        }}
                        className="w-full text-xs text-[#222] bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 focus:ring-1 focus:ring-[#92006F] outline-none"
                      >
                        <option value={0}>Ao Segundo Exato (Sem arredondamento)</option>
                        <option value={6}>Blocos de 6 Minutos (0,1h Forense)</option>
                        <option value={15}>Blocos de 15 Minutos (0,25h Forense)</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#EFE8DD] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-4 text-xs text-[#555] flex-wrap">
                      <span>
                        Tempo Total Acumulado:{" "}
                        <strong className="font-mono text-[#141414]">
                          {formatSeconds(totalClientSeconds)}
                        </strong>
                      </span>
                      <span>·</span>
                      <span>
                        Valor Calculado pelas Categorias:{" "}
                        <strong className="text-[#92006F]">
                          {theoreticalCategoryTotal.toFixed(2)} €
                        </strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="withholdingCheck"
                        checked={useWithholding}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setApplyWithholdingByClient((prev) => ({
                            ...prev,
                            [selectedFeeClient]: checked,
                          }));
                          saveFeeNoteToDb(selectedFeeClient, undefined, checked, false);
                        }}
                        className="rounded border-[#D9D1C5] text-[#92006F] focus:ring-[#92006F] cursor-pointer"
                      />
                      <label
                        htmlFor="withholdingCheck"
                        className="text-xs font-semibold text-[#444] cursor-pointer"
                      >
                        Aplicar Retenção na Fonte IRS (23%)
                      </label>
                    </div>
                  </div>
                </div>

                {/* Tabela de Tarefas para Definição de Preço */}
                <div className="pcn-card overflow-hidden">
                  <div className="p-3.5 sm:p-4 bg-[#FAF7F2] border-b border-[#ECE6DB] flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <h3 className="text-xs font-bold text-[#141414] uppercase tracking-wider">
                      Tarefas do Cliente para Inclusão na Nota ({clientTasks.length})
                    </h3>
                    <div className="flex items-center gap-2">
                      {savedClientNote && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Guardada no PostgreSQL
                        </span>
                      )}
                      <span className="text-xs text-[#666]">
                        Ref.ª: <strong>{currentRefCode}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto w-full">
                    <table className="min-w-[720px] w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#92006F] text-white">
                          <th className="p-3">Data</th>
                          <th className="p-3">Descrição do Ato & Categoria</th>
                          <th className="p-3">Tarifa da Categoria</th>
                          <th className="p-3">Advogada</th>
                          <th className="p-3">Tempo Gasto</th>
                          <th className="p-3">Estado</th>
                          <th className="p-3 text-right">Honorários (€)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EFE9DE]">
                        {clientTasks.map((t) => {
                          const catRate = getTaskCategoryRate(t);
                          const suggestedFee = calculateTaskFeeByCategory(
                            t,
                            billingRoundingMinutes
                          );
                          const currentVal =
                            feeTaskPrices[t.id] !== undefined
                              ? feeTaskPrices[t.id]
                              : (t.fee_amount ?? 0);
                          const isBilled = currentVal > 0;

                          return (
                            <tr key={t.id} className="hover:bg-[#FAF8F5]">
                              <td className="p-3 text-[#555]">
                                {formatIsoToEuropean(t.due_date || getTodayDateString())}
                              </td>
                              <td className="p-3 font-medium text-[#111]">
                                <div>{t.title}</div>
                                <span className="inline-block mt-0.5 text-[10px] font-bold text-[#92006F] bg-[#FDF2F8] border border-[#FBCFE8] px-2 py-0.2 rounded">
                                  {t.task_type}
                                </span>
                              </td>
                              <td className="p-3">
                                <span className="font-mono font-bold text-[#444] bg-[#F5F1EA] border border-[#E2DAD0] px-2 py-0.5 rounded text-[11px]">
                                  {catRate.toFixed(2)} €/h
                                </span>
                              </td>
                              <td className="p-3 text-[#555]">{t.lawyer_name || "—"}</td>
                              <td className="p-3">
                                <div className="font-mono font-semibold text-[#92006F]">
                                  {formatSeconds(t.total_duration_seconds)}
                                </div>
                                {suggestedFee > 0 && (
                                  <div className="text-[10px] text-[#736B5E]">
                                    Cálculo: <strong>{suggestedFee.toFixed(2)} €</strong>
                                  </div>
                                )}
                              </td>
                              <td className="p-3">
                                {isBilled ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                                    <Check className="w-2.5 h-2.5" /> Valorizada
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                                    Por Valorizar (WIP)
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updatedPrices = {
                                        ...feeTaskPrices,
                                        [t.id]: suggestedFee,
                                      };
                                      setFeeTaskPrices(updatedPrices);
                                      saveFeeNoteToDb(
                                        selectedFeeClient,
                                        updatedPrices,
                                        useWithholding,
                                        true
                                      ).catch((err) =>
                                        console.error("Auto-save fee note error:", err)
                                      );
                                    }}
                                    className="text-[10px] font-semibold bg-[#FAF5E8] hover:bg-[#EFE4C6] text-[#8F6D07] border border-[#E5D3A1] px-2 py-1 rounded cursor-pointer transition-colors"
                                    title={`Calcular segundo a categoria "${t.task_type}": ${formatSeconds(t.total_duration_seconds)} × ${catRate.toFixed(2)} €/h = ${suggestedFee.toFixed(2)} €`}
                                  >
                                    ⟳ {catRate}€/h
                                  </button>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={currentVal}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      const parsed = raw === "" ? 0 : parseFloat(raw);
                                      const cleanVal = isNaN(parsed) ? 0 : parsed;
                                      const updatedPrices = {
                                        ...feeTaskPrices,
                                        [t.id]: cleanVal,
                                      };
                                      setFeeTaskPrices(updatedPrices);
                                      if (autoSaveTimerRef.current) {
                                        clearTimeout(autoSaveTimerRef.current);
                                      }
                                      autoSaveTimerRef.current = setTimeout(() => {
                                        saveFeeNoteToDb(
                                          selectedFeeClient,
                                          updatedPrices,
                                          useWithholding,
                                          true
                                        ).catch((err) =>
                                          console.error("Auto-save fee note error:", err)
                                        );
                                      }, 800);
                                    }}
                                    className="w-24 sm:w-28 text-right font-semibold text-xs border border-[#D9D1C5] rounded px-2 py-1 focus:ring-1 focus:ring-[#92006F] bg-white"
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {clientTasks.length === 0 && (
                          <tr>
                            <td colSpan={7} className="p-6 text-center text-xs text-[#888] italic">
                              Nenhuma tarefa registada para este cliente.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Quadro de Totais Fiscais */}
                  <div className="p-4 sm:p-5 bg-[#FAF8F5] border-t border-[#ECE6DB] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="text-xs text-[#665F54] space-y-1 max-w-md">
                      <p className="font-bold text-[#141414]">
                        Documento Oficial pronto para emissão
                      </p>
                      <p className="text-[11px]">
                        Ao clicar em <strong>"Emitir PDF Oficial (A4)"</strong>, o sistema gera uma Nota de Honorários executiva em formato A4 com papel timbrado PCN Advogadas, tabela discriminada por categoria, apuramento fiscal e espaço de assinatura.
                      </p>
                    </div>

                    <div className="w-full sm:w-72 space-y-2 text-xs">
                      <div className="flex justify-between text-[#555]">
                        <span>Subtotal (Honorários):</span>
                        <span className="font-semibold text-[#141414]">
                          {subtotal.toFixed(2)} €
                        </span>
                      </div>
                      <div className="flex justify-between text-[#555]">
                        <span>IVA (23%):</span>
                        <span className="font-semibold text-[#141414]">
                          {vatAmount.toFixed(2)} €
                        </span>
                      </div>
                      <div className="flex justify-between text-[#555]">
                        <span>Retenção IRS ({useWithholding ? "23%" : "Isento / 0%"}):</span>
                        <span className="font-semibold text-rose-700">
                          -{withholdingAmount.toFixed(2)} €
                        </span>
                      </div>
                      <div className="pt-2 border-t border-[#D9D1C5] flex justify-between text-sm font-bold text-[#92006F]">
                        <span>Total a Pagar:</span>
                        <span>{totalToPay.toFixed(2)} €</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

        {/* ── CONTEÚDO DA TAB: AGENDAS E PRAZOS (CALCULADORA ART. 138/139 CPC) ── */}
        {activeTab === "calendar" && (
          <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl w-full mx-auto">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#141414]">Agendas e Prazos Judiciais</h2>
              <p className="text-xs text-[#736B5E]">
                Compromissos forenses e motor de cálculo automático com suspensão de férias judiciais (Art. 138.º CPC).
              </p>
            </div>

            <div className="pcn-card p-4 sm:p-6 bg-gradient-to-b from-white to-[#FDFBF7]">
              <div className="flex items-center gap-2 mb-2">
                <Scale className="w-5 h-5 text-[#AA820A]" />
                <h3 className="text-sm font-bold text-[#141414]">
                  Calculadora de Prazos Processuais Judiciais (Art. 138.º e 139.º CPC)
                </h3>
              </div>
              <p className="text-xs text-[#666] mb-4">
                Aplica a suspensão em férias judiciais (Verão: 16 jul a 31 ago; Natal: 22 dez a 3 jan; Páscoa) e a passagem para o 1.º dia útil.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-end">
                <div>
                  <label className="text-[11px] font-bold text-[#555] block mb-1">
                    Data da Notificação / Citação:
                  </label>
                  <EuropeanDateInput
                    value={calcStartDate}
                    onChange={setCalcStartDate}
                    className="w-full text-xs border border-[#D9D1C5] rounded p-2 bg-white focus:ring-1 focus:ring-[#92006F] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#555] block mb-1">
                    Prazo em Dias:
                  </label>
                  <input
                    type="number"
                    value={calcDays}
                    onChange={(e) => setCalcDays(parseInt(e.target.value) || 10)}
                    className="w-full text-xs border border-[#D9D1C5] rounded p-2 bg-white focus:ring-1 focus:ring-[#92006F] outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 pb-2">
                  <input
                    type="checkbox"
                    id="urgentCheck"
                    checked={calcIsUrgent}
                    onChange={(e) => setCalcIsUrgent(e.target.checked)}
                    className="rounded border-[#D9D1C5] text-[#92006F] focus:ring-[#92006F]"
                  />
                  <label htmlFor="urgentCheck" className="text-xs text-[#444] cursor-pointer">
                    Processo Urgente (não suspende)
                  </label>
                </div>

                <div>
                  <button
                    onClick={handleCalculateDeadline}
                    className="w-full bg-[#AA820A] hover:bg-[#8F6D07] text-white text-xs font-semibold py-2 rounded transition-colors cursor-pointer"
                  >
                    Calcular Termo do Prazo
                  </button>
                </div>
              </div>

              {calcResult && (
                <div className="mt-5 p-4 bg-[#FAF7EE] border border-[#EEDB98] rounded-xl text-xs space-y-3 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-[#666] font-medium">Data Limite sem Multa (Art. 138.º CPC):</span>
                    <strong className="text-base font-bold text-[#92006F] bg-white px-3 py-1 rounded-md border border-[#EEDB98] shadow-xs">
                      {calcResult.finalDate}
                    </strong>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[#777]">
                    <span>Dias Suspensos por Férias Judiciais:</span>
                    <span className="font-semibold text-[#AA820A]">{calcResult.suspendedDays} dias</span>
                  </div>
                  <div className="pt-2 border-t border-[#E5DECF] flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[#666]">
                    <span>Prática com Multa (Art. 139.º n.º 5 CPC):</span>
                    <span className="font-mono text-[11px] text-[#444] bg-white/70 px-2 py-0.5 rounded border border-[#ECE6DB]">
                      1º dia: {calcResult.penaltyDays[0]} | 2º dia: {calcResult.penaltyDays[1]} | 3º dia: {calcResult.penaltyDays[2]}
                    </span>
                  </div>

                  {/* Botão Único Inteligente com Deteção Automática do Sistema Operativo + Criar Tarefa com este Prazo */}
                  <div className="pt-3 border-t border-[#EEDB98] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-[#AA820A] flex items-center gap-1.5">
                        <CalendarPlus className="w-4 h-4 text-[#AA820A]" />
                        Sincronizar ou Criar Tarefa com este Prazo:
                      </span>
                      <span className="text-[10px] text-[#736B5E] mt-0.5 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-[#AA820A]" />
                        <span>
                          Deteção automática de dispositivo:{" "}
                          <strong className="text-[#141414] font-semibold">
                            {platformInfo?.shortLabel || "A detetar..."}
                          </strong>
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          const parts = calcResult.finalDate.split("/");
                          if (parts.length === 3) {
                            setTaskFormDueDate(`${parts[2]}-${parts[1]}-${parts[0]}`);
                          }
                          setTaskFormIsUrgent(calcIsUrgent);
                          setIsNewTaskModalOpen(true);
                        }}
                        className="bg-white hover:bg-[#FAF8F5] text-[#92006F] border border-[#92006F]/30 text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                      >
                        <Plus className="w-4 h-4 text-[#92006F]" />
                        <span>Criar Tarefa com este Prazo ({calcResult.finalDate})</span>
                      </button>

                      <div className="relative inline-flex items-stretch shadow-xs rounded-lg">
                        {/* Botão Principal Único (Automático para o SO detetado) */}
                        <button
                          onClick={handleSmartExportToCalendar}
                          className="bg-[#92006F] hover:bg-[#7E0060] text-white text-xs font-semibold px-4 py-2 rounded-l-lg flex items-center gap-2 cursor-pointer transition-colors"
                          title={platformInfo?.hint || "Adicionar à agenda do seu dispositivo"}
                        >
                          <CalendarPlus className="w-4 h-4 text-[#D4AF37]" />
                          <span>{platformInfo?.label || "Adicionar à Agenda"}</span>
                        </button>

                        {/* Botão Secundário para abrir opções caso prefira outro fornecedor */}
                        <button
                          onClick={() => setShowCalendarMenu(!showCalendarMenu)}
                          className="bg-[#7E0060] hover:bg-[#6A0051] text-white px-2.5 rounded-r-lg border-l border-white/20 cursor-pointer transition-colors flex items-center justify-center"
                          title="Escolher outro formato (Google, Outlook, Apple .ics)"
                          aria-label="Escolher outro fornecedor de agenda"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>

                        {showCalendarMenu && (
                          <div className="absolute right-0 bottom-full mb-2 sm:bottom-auto sm:top-full sm:mt-1.5 w-64 bg-white border border-[#D9D1C5] rounded-xl shadow-2xl z-30 p-1.5 space-y-1 animate-in fade-in duration-150">
                            <div className="px-2 py-1 text-[10px] font-bold text-[#8C7D6B] uppercase tracking-wider border-b border-[#F4EFE6]">
                              Outros Fornecedores de Agenda:
                            </div>
                            <button
                              onClick={() => handleExportToCalendar("ics")}
                              className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium hover:bg-[#FAF8F5] flex items-center gap-2 text-[#333] transition-colors"
                            >
                              <Download className="w-3.5 h-3.5 text-[#92006F]" />
                              <div>
                                <p className="font-semibold">iPhone / iPad / Mac (.ics)</p>
                                <p className="text-[10px] text-[#777]">Ficheiro universal iCalendar</p>
                              </div>
                            </button>
                            <button
                              onClick={() => handleExportToCalendar("google")}
                              className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium hover:bg-[#FAF8F5] flex items-center gap-2 text-[#333] transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-[#AA820A]" />
                              <div>
                                <p className="font-semibold">Google Agenda</p>
                                <p className="text-[10px] text-[#777]">Abre no navegador ou na app Google</p>
                              </div>
                            </button>
                            <button
                              onClick={() => handleExportToCalendar("outlook")}
                              className="w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium hover:bg-[#FAF8F5] flex items-center gap-2 text-[#333] transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                              <div>
                                <p className="font-semibold">Outlook Web / 365</p>
                                <p className="text-[10px] text-[#777]">Microsoft 365 Corporativo</p>
                              </div>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CONTEÚDO DA TAB: RELATÓRIO PCN & MÉTRICAS ── */}
        {activeTab === "reports" &&
          (() => {
            const q = searchQuery.trim().toLowerCase();
            const filteredTasks = tasks.filter(
              (t) =>
                !q ||
                t.title.toLowerCase().includes(q) ||
                (t.description || "").toLowerCase().includes(q) ||
                t.client_name.toLowerCase().includes(q) ||
                t.task_type.toLowerCase().includes(q)
            );
            const grouped: Record<string, { count: number; totalSec: number }> = {};
            for (const t of filteredTasks) {
              const typeName = t.task_type || "Geral";
              if (!grouped[typeName]) {
                grouped[typeName] = { count: 0, totalSec: 0 };
              }
              grouped[typeName].count += 1;
              grouped[typeName].totalSec += t.total_duration_seconds || 0;
            }
            const groupEntries = Object.entries(grouped);

            return (
              <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl w-full mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#141414]">
                      Relatório PCN & Métricas
                    </h2>
                    <p className="text-xs text-[#736B5E]">
                      Pesquisa por palavra-chave e agrupamento de horas por tipo de tarefa jurídica.
                    </p>
                  </div>

                  {/* Barra de Pesquisa inteligente */}
                  <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-[#888] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Pesquisar (ex: 'negativa', 'predial')..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2 border border-[#D9D1C5] rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#92006F]"
                    />
                  </div>
                </div>

                {/* Tabela de Resultados Agrupados */}
                <div className="pcn-card overflow-hidden">
                  <div className="overflow-x-auto w-full">
                    <table className="min-w-[540px] w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#FAF7F2] text-[#555] border-b border-[#ECE6DB]">
                          <th className="p-3">Tipo de Tarefa</th>
                          <th className="p-3">Qtd. Tarefas</th>
                          <th className="p-3">Tempo Total</th>
                          <th className="p-3">Tempo Médio</th>
                          <th className="p-3 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EFE9DE]">
                        {groupEntries.map(([typeName, stats]) => {
                          const avgMin =
                            stats.count > 0 ? (stats.totalSec / 60 / stats.count).toFixed(1) : "0.0";
                          return (
                            <tr key={typeName} className="hover:bg-[#FAF8F5]">
                              <td className="p-3 font-bold text-[#92006F]">{typeName}</td>
                              <td className="p-3">{stats.count}</td>
                              <td className="p-3 font-mono">{formatSeconds(stats.totalSec)}</td>
                              <td className="p-3 font-mono">{avgMin} min</td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => switchTab("tasks")}
                                  className="text-xs font-semibold text-[#AA820A] hover:underline cursor-pointer"
                                >
                                  Ver no Quadro
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {groupEntries.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-xs text-[#888] italic">
                              Nenhuma tarefa encontrada para os critérios pesquisados.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

        {/* ── CONTEÚDO DA TAB: CLIENTES PCN ── */}
        {activeTab === "clients" && (
          <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl w-full mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#141414]">
                  Diretório de Clientes PCN
                </h2>
                <p className="text-xs text-[#736B5E]">
                  Gestão de clientes, dossiês e referências processuais do escritório.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-[#888] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Filtrar cliente, NIF ou proc..."
                    value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-2 border border-[#D9D1C5] rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#92006F]"
                  />
                </div>
                <button
                  onClick={() => setIsNewClientModalOpen(true)}
                  className="bg-[#92006F] hover:bg-[#7E0060] text-white text-xs font-semibold px-4 py-2 rounded-md shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer w-full sm:w-auto shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Registar Cliente</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {clients
                .filter((c) => {
                  const q = clientSearchQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    c.name.toLowerCase().includes(q) ||
                    (c.nif || "").toLowerCase().includes(q) ||
                    (c.process_reference || "").toLowerCase().includes(q)
                  );
                })
                .map((c) => {
                  const cTasks = tasks.filter((t) => t.client_id === c.id);

                  return (
                    <div key={c.id} className="pcn-card p-4 sm:p-5 space-y-3.5">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-[#141414]">{c.name}</h3>
                          <p className="text-xs text-[#777]">
                            NIF: {c.nif || "Não registado"} ·{" "}
                            {c.process_reference || "Assessoria Geral"}
                          </p>
                        </div>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold shrink-0">
                          Ativo
                        </span>
                      </div>

                      <div className="text-xs text-[#666] space-y-1">
                        <p>Correio: {c.email || "—"}</p>
                        <p>Contacto telefónico: {c.phone || "—"}</p>
                      </div>

                      <div className="pt-2 border-t border-[#F2EDE4] flex justify-between items-center text-xs">
                        <span className="text-[#888]">{cTasks.length} tarefas registadas</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setTaskFormClientId(c.id);
                              setIsNewTaskModalOpen(true);
                            }}
                            className="text-xs font-semibold text-[#141414] hover:text-[#92006F] hover:underline cursor-pointer"
                            title="Criar tarefa para este cliente"
                          >
                            + Nova Tarefa
                          </button>
                          {currentUser.role === "admin_lawyer" && (
                            <>
                              <span className="text-[#CCC]">·</span>
                              <button
                                onClick={() => {
                                  setSelectedFeeClient(c.id);
                                  setActiveTab("feenotes");
                                }}
                                className="text-xs font-semibold text-[#92006F] hover:underline cursor-pointer"
                              >
                                Criar Nota de Honorários →
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ── CONTEÚDO DA TAB: TABELA DE SERVIÇOS & CATEGORIAS (€/H) (PORTAL ADMIN) ── */}
        {activeTab === "services" && currentUser.role === "admin_lawyer" && (
          <div className="p-4 sm:p-8 space-y-6 max-w-7xl w-full mx-auto">
            {/* Cabeçalho */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-xl border border-[#ECE6DB] shadow-xs">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-lg bg-[#FDF2F8] text-[#92006F] border border-[#FBCFE8]">
                  <SlidersHorizontal className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-[#141414]">
                    Tabela de Serviços Forenses & Tarifas por Categoria (€/h)
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => switchTab("feenotes")}
                  className="bg-white hover:bg-[#FAF8F5] text-[#444] border border-[#D9D1C5] text-xs font-semibold px-3.5 py-2.5 rounded-lg flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                >
                  <CreditCard className="w-4 h-4 text-[#92006F]" />
                  <span>Ir para Notas de Honorários</span>
                </button>

                <button
                  type="button"
                  onClick={openCreateCategoryModal}
                  className="bg-[#92006F] hover:bg-[#7E0060] text-white text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Novo Serviço / Categoria</span>
                </button>
              </div>
            </div>

            {/* Tabela de Categorias de Serviço */}
            <div className="pcn-card overflow-hidden">
              <div className="px-5 py-4 bg-[#FAF7F2] border-b border-[#ECE6DB] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[#141414]">
                    Catálogo de Serviços e Valores Horários (€/h)
                  </h3>
                  <p className="text-[11px] text-[#736B5E]">
                    Pode alterar rapidamente o valor €/h diretamente na tabela ou clicar em "Editar" para alterar o nome e descrição do serviço.
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                  Cálculo Automático Ativo
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[600px] w-full text-left text-xs text-[#222] border-collapse">
                  <thead className="bg-[#92006F] text-white text-[11px] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Categoria / Serviço Forense</th>
                      <th className="px-5 py-3">Descrição do Ato</th>
                      <th className="px-5 py-3">Valor Hora (€/h)</th>
                      <th className="px-5 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECE6DB]">
                    {serviceCategories.map((cat) => (
                      <tr key={cat.id} className="hover:bg-[#FAF8F5] transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                              style={{ backgroundColor: cat.color || "#92006F" }}
                            />
                            <span className="font-bold text-[#141414] text-xs">{cat.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-[#665F54] max-w-md">
                          {cat.description || "Serviço jurídico e acompanhamento processual"}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="inline-flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              step="5"
                              value={cat.hourly_rate}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                handleQuickUpdateCategoryRate(cat, isNaN(val) ? 0 : val);
                              }}
                              className="w-24 text-right font-bold text-xs text-[#92006F] bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-2.5 py-1.5 focus:ring-1 focus:ring-[#92006F] outline-none"
                            />
                            <span className="font-bold text-[#555] text-xs">€/h</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditCategoryModal(cat)}
                              className="px-2.5 py-1.5 rounded-md bg-white hover:bg-[#FAF8F5] text-[#333] border border-[#D9D1C5] font-semibold text-[11px] cursor-pointer transition-colors"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(cat)}
                              className="p-1.5 rounded-md text-[#888] hover:text-rose-700 hover:bg-rose-50 cursor-pointer transition-colors"
                              title="Eliminar Categoria de Serviço"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: CRIAR / EDITAR CATEGORIA DE SERVIÇO (€/H) (PORTAL ADMIN) ── */}
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white border border-[#D4AF37]/40 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
              <div className="bg-gradient-to-r from-[#92006F] to-[#5E0047] text-white px-5 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold tracking-wide">
                    {editingCategory ? "Editar Categoria de Serviço" : "Novo Serviço / Categoria Forense"}
                  </h3>
                  <p className="text-[11px] text-white/80">
                    Defina o nome do serviço e o valor por hora (€/h) para cálculo automático
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="text-white/70 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveCategory} className="p-5 space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-[#333] mb-1">
                    Nome do Serviço / Categoria *
                  </label>
                  <input
                    type="text"
                    required
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    placeholder="ex: Direito Societário & Contratos"
                    className="w-full bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 text-xs text-[#141414] focus:ring-1 focus:ring-[#92006F] outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-[#333] mb-1">
                      Valor por Hora (€/h) *
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.5"
                        value={categoryForm.hourly_rate}
                        onChange={(e) =>
                          setCategoryForm({
                            ...categoryForm,
                            hourly_rate: parseFloat(e.target.value) || 0,
                          })
                        }
                        placeholder="150"
                        className="w-full bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 text-xs font-bold text-[#92006F] focus:ring-1 focus:ring-[#92006F] outline-none"
                      />
                      <span className="font-bold text-[#555]">€/h</span>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-[#333] mb-1">
                      Cor Identificadora
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={categoryForm.color}
                        onChange={(e) =>
                          setCategoryForm({ ...categoryForm, color: e.target.value })
                        }
                        className="h-9 w-14 rounded border border-[#D9D1C5] bg-[#FAF8F5] p-1 cursor-pointer"
                      />
                      <span className="font-mono text-[11px] text-[#666]">
                        {categoryForm.color}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-[#333] mb-1">
                    Descrição / Âmbito do Serviço
                  </label>
                  <textarea
                    rows={3}
                    value={categoryForm.description}
                    onChange={(e) =>
                      setCategoryForm({ ...categoryForm, description: e.target.value })
                    }
                    placeholder="ex: Elaboração de contratos, atas societárias, pareceres ou diligências externas..."
                    className="w-full bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 text-xs text-[#141414] focus:ring-1 focus:ring-[#92006F] outline-none"
                  />
                </div>

                <div className="pt-3 border-t border-[#ECE6DB] flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(false)}
                    className="px-3 py-2 text-xs font-medium text-[#666] hover:text-[#222] cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-[#92006F] hover:bg-[#7E0060] text-white text-xs font-semibold px-4 py-2 rounded-md flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{editingCategory ? "Guardar Alterações" : "Criar Serviço"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── CONTEÚDO DA TAB: GESTÃO DE UTILIZADORAS & ACESSOS (PORTAL ADMIN) ── */}
        {activeTab === "users" && currentUser.role === "admin_lawyer" && (
          <div className="p-4 sm:p-8 space-y-6 max-w-7xl w-full mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-xl border border-[#ECE6DB] shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-lg bg-[#FAF8F5] text-[#92006F] border border-[#ECE6DB]">
                    <ShieldCheck className="w-5 h-5" />
                  </span>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-[#141414]">
                      Gestão de Utilizadoras & Níveis de Acesso
                    </h2>
                    <p className="text-xs text-[#666] mt-0.5">
                      Portal exclusivo da Direção (Dr.ª Patrícia) · Criação de advogadas e privilégios de sistema no PostgreSQL.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsNewUserModalOpen(true)}
                className="bg-[#92006F] hover:bg-[#7E0060] text-white text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Nova Utilizadora / Advogada</span>
              </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white p-4 rounded-xl border border-[#ECE6DB] shadow-xs">
                <p className="text-xs text-[#666] font-medium">Total de Utilizadoras</p>
                <p className="text-2xl font-bold text-[#141414] mt-1">{usersList.length}</p>
                <p className="text-[10px] text-[#888] mt-0.5">Contas registadas no PostgreSQL</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-[#ECE6DB] shadow-xs">
                <p className="text-xs text-[#666] font-medium">Direção / Administradoras</p>
                <p className="text-2xl font-bold text-[#92006F] mt-1">
                  {usersList.filter((u) => u.role === "admin_lawyer").length}
                </p>
                <p className="text-[10px] text-[#888] mt-0.5">Acesso total e gestão financeira</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-[#ECE6DB] shadow-xs">
                <p className="text-xs text-[#666] font-medium">Advogadas Associadas</p>
                <p className="text-2xl font-bold text-[#AA820A] mt-1">
                  {usersList.filter((u) => u.role === "lawyer").length}
                </p>
                <p className="text-[10px] text-[#888] mt-0.5">Acesso a tarefas e cronómetros</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-[#ECE6DB] shadow-xs">
                <p className="text-xs text-[#666] font-medium">Sessão Ativa</p>
                <p className="text-sm font-bold text-emerald-700 mt-2 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  30 Minutos (Ativa)
                </p>
                <p className="text-[10px] text-[#888] mt-0.5">Expiração automática por inatividade</p>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-[#ECE6DB] shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-[#ECE6DB] flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#141414]">Utilizadoras Registadas no Escritório</h3>
                {isLoadingUsers && (
                  <span className="text-xs text-[#92006F] flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> A atualizar lista...
                  </span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#222]">
                  <thead className="bg-[#FAF8F5] border-b border-[#ECE6DB] text-[11px] font-bold text-[#666] uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Nome da Advogada</th>
                      <th className="px-5 py-3">Correio Eletrónico</th>
                      <th className="px-5 py-3">Nível de Acesso</th>
                      <th className="px-5 py-3">Estado</th>
                      <th className="px-5 py-3 text-right">Identificador</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ECE6DB]">
                    {usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-[#FAF8F5]/60 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-[#141414] flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#FAF8F5] border border-[#ECE6DB] flex items-center justify-center text-[#92006F] font-bold text-xs shrink-0">
                            {u.name.replace("Dr.ª ", "").charAt(0)}
                          </div>
                          <span>{u.name}</span>
                        </td>
                        <td className="px-5 py-3.5 text-[#555] font-mono text-[11px]">{u.email}</td>
                        <td className="px-5 py-3.5">
                          <select
                            value={u.role}
                            disabled={u.email.toLowerCase() === currentUser.email.toLowerCase()}
                            onChange={async (e) => {
                              const newRole = e.target.value;
                              try {
                                if (!authToken) return;
                                await updateUserApi(authToken, u.id, { role: newRole });
                                setUsersList((prev) =>
                                  prev.map((usr) => (usr.id === u.id ? { ...usr, role: newRole } : usr))
                                );
                                setModalFeedback(
                                  `Nível de acesso de ${u.name} atualizado para ${
                                    newRole === "admin_lawyer" ? "Direção" : "Advogada Associada"
                                  }!`
                                );
                                setTimeout(() => setModalFeedback(null), 3500);
                              } catch (err: any) {
                                alert(err.message || "Erro ao atualizar nível de acesso.");
                              }
                            }}
                            className={`text-xs font-semibold px-2.5 py-1 rounded-md border cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#92006F] shadow-2xs transition-all ${
                              u.role === "admin_lawyer"
                                ? "bg-[#FDF2F8] text-[#92006F] border-[#FBCFE8]"
                                : "bg-[#FCF8EE] text-[#7A5B00] border-[#F1E5C7]"
                            }`}
                            title={
                              u.email.toLowerCase() === currentUser.email.toLowerCase()
                                ? "Não é possível alterar o nível da sua própria conta de Direção"
                                : "Alterar nível de acesso forense"
                            }
                          >
                            <option value="admin_lawyer">Direção / Administradora</option>
                            <option value="lawyer">Advogada Associada</option>
                          </select>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Ativa
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-[10px] text-[#888]">
                          {u.id}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: NOVA UTILIZADORA / ADVOGADA (PORTAL ADMIN) ── */}
        {isNewUserModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white border border-[#D9D1C5] rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4 relative">
              <button
                type="button"
                onClick={() => setIsNewUserModalOpen(false)}
                className="absolute right-4 top-4 text-[#888] hover:text-[#222] p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#FAF8F5] border border-[#ECE6DB] flex items-center justify-center text-[#92006F] shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#141414]">Criar Nova Utilizadora Forense</h3>
                  <p className="text-[11px] text-[#666]">
                    Registo de conta e atribuição de nível de acesso no PostgreSQL
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateUserSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#444] mb-1">
                    Nome Completo da Advogada
                  </label>
                  <input
                    type="text"
                    value={newUserForm.name}
                    onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                    required
                    placeholder="ex: Dr.ª Mariana Silva"
                    className="w-full text-xs bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 text-[#222] focus:outline-none focus:ring-1 focus:ring-[#92006F]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#444] mb-1">
                    Correio Eletrónico Forense
                  </label>
                  <input
                    type="email"
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                    required
                    placeholder="mariana@pcnadvogadas.pt"
                    className="w-full text-xs bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 text-[#222] focus:outline-none focus:ring-1 focus:ring-[#92006F]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#444] mb-1">
                    Nível de Acesso / Perfil
                  </label>
                  <select
                    value={newUserForm.role}
                    onChange={(e) =>
                      setNewUserForm({
                        ...newUserForm,
                        role: e.target.value as "admin_lawyer" | "lawyer",
                      })
                    }
                    className="w-full text-xs bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 text-[#222] focus:outline-none focus:ring-1 focus:ring-[#92006F]"
                  >
                    <option value="lawyer">Advogada Associada (Tarefas, Prazos e Cronómetro)</option>
                    <option value="admin_lawyer">
                      Direção / Administradora (Acesso Total, Honorários e Gestão de Utilizadoras)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#444] mb-1">
                    Palavra-passe Inicial
                  </label>
                  <input
                    type="text"
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                    required
                    className="w-full text-xs bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 text-[#222] font-mono focus:outline-none focus:ring-1 focus:ring-[#92006F]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#ECE6DB]">
                  <button
                    type="button"
                    onClick={() => setIsNewUserModalOpen(false)}
                    className="px-3 py-2 text-xs font-medium text-[#666] hover:text-[#222] cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingUser}
                    className="bg-[#92006F] hover:bg-[#7E0060] text-white text-xs font-semibold px-4 py-2 rounded-md flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingUser ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>A criar conta...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Criar Utilizadora no PostgreSQL</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Notificação Toast */}
        {modalFeedback && (
          <div className="fixed bottom-6 right-6 z-50 bg-[#92006F] text-white px-5 py-3 rounded-lg shadow-xl flex items-center gap-3 border border-[#D4AF37]/50 text-xs font-semibold animate-in slide-in-from-bottom duration-300">
            <Check className="w-4 h-4 text-amber-300" />
            <span>{modalFeedback}</span>
          </div>
        )}

        {/* ── MODAL: NOVA TAREFA JURÍDICA ── */}
        {isNewTaskModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white border border-[#D4AF37]/40 rounded-xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden my-auto">
              <div className="bg-gradient-to-r from-[#92006F] to-[#5E0047] text-white px-5 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-sm font-bold tracking-wide">Criar Nova Tarefa Jurídica</h3>
                  <p className="text-[11px] text-white/80">Registo de ato processual ou diligência forense</p>
                </div>
                <button
                  onClick={() => setIsNewTaskModalOpen(false)}
                  className="text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 text-xs overflow-y-auto flex-1">
                <div>
                  <label className="font-bold text-[#333] block mb-1">Título do Assunto / Diligência *</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Redação de Petição Inicial de Divórcio"
                    value={taskFormTitle}
                    onChange={(e) => setTaskFormTitle(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-[#92006F] outline-none text-[#141414]"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#333] block mb-1">Descrição e Instruções</label>
                  <textarea
                    rows={3}
                    placeholder="Instruções forenses, pontos essenciais e documentos a juntar..."
                    value={taskFormDescription}
                    onChange={(e) => setTaskFormDescription(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-[#92006F] outline-none text-[#141414]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-[#333] block mb-1">Cliente Forense *</label>
                    <select
                      value={taskFormClientId || (clients.length > 0 ? clients[0].id : "")}
                      onChange={(e) => setTaskFormClientId(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-[#92006F] outline-none text-[#141414]"
                    >
                      {clients.length === 0 ? (
                        <option value="">Nenhum cliente registado</option>
                      ) : (
                        clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.process_reference ? `(${c.process_reference})` : ""}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-[#333]">Categoria de Serviço *</label>
                      {currentUser.role === "admin_lawyer" && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsNewTaskModalOpen(false);
                            switchTab("services");
                          }}
                          className="text-[10px] font-bold text-[#92006F] hover:underline cursor-pointer"
                        >
                          + Gerir Serviços
                        </button>
                      )}
                    </div>
                    <select
                      value={taskFormTypeId}
                      onChange={(e) => setTaskFormTypeId(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-[#92006F] outline-none text-[#141414]"
                    >
                      {serviceCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name} ({cat.hourly_rate.toFixed(2)} €/h)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="font-bold text-[#333] block mb-1">Data Limite / Prazo</label>
                    <EuropeanDateInput
                      value={taskFormDueDate}
                      onChange={setTaskFormDueDate}
                      className="w-full bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-[#92006F] outline-none text-[#141414]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#333] block mb-1">Destino da Tarefa</label>
                    <div className="flex items-center gap-2 pt-1.5">
                      <input
                        type="checkbox"
                        id="poolCheckbox"
                        checked={taskFormPublishToPool}
                        onChange={(e) => setTaskFormPublishToPool(e.target.checked)}
                        className="rounded border-[#D9D1C5] text-[#92006F] focus:ring-[#92006F]"
                      />
                      <label htmlFor="poolCheckbox" className="text-xs text-[#555] cursor-pointer">
                        Enviar para a <strong>Pool Partilhada</strong>
                      </label>
                    </div>
                  </div>
                </div>

                {!taskFormPublishToPool && (
                  <div>
                    <label className="font-bold text-[#333] block mb-1">Atribuir a Advogada / Responsável</label>
                    <select
                      value={taskFormAssignee}
                      onChange={(e) => setTaskFormAssignee(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-[#92006F] outline-none text-[#141414]"
                    >
                      {(usersList && usersList.length > 0 ? usersList : INITIAL_USERS)
                        .filter((u: any) => u.is_active !== false)
                        .map((u: any) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.role === "admin_lawyer" ? "Direção / Admin" : "Advogada"})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-2 p-2.5 bg-amber-50 rounded border border-amber-200">
                  <input
                    type="checkbox"
                    id="urgentTaskCheckbox"
                    checked={taskFormIsUrgent}
                    onChange={(e) => setTaskFormIsUrgent(e.target.checked)}
                    className="rounded border-[#D9D1C5] text-[#92006F] focus:ring-[#92006F]"
                  />
                  <label htmlFor="urgentTaskCheckbox" className="text-[11px] text-[#7A5B00] cursor-pointer">
                    <strong>Processo Urgente (Art. 138.º n.º 1 CPC):</strong> Prazo corre em férias judiciais.
                  </label>
                </div>

                <div className="pt-3 sm:pt-4 border-t border-[#EFE8DD] flex items-center justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsNewTaskModalOpen(false)}
                    className="px-4 py-2 border border-[#D9D1C5] rounded-md text-[#666] hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTask}
                    className="bg-[#92006F] hover:bg-[#7E0060] text-white px-5 py-2 rounded-md font-semibold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isSubmittingTask ? "A guardar..." : "Gravar e Publicar Tarefa"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL: REGISTAR CLIENTE ── */}
        {isNewClientModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white border border-[#D4AF37]/40 rounded-xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden my-auto">
              <div className="bg-gradient-to-r from-[#92006F] to-[#5E0047] text-white px-5 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-sm font-bold tracking-wide">Registar Novo Cliente</h3>
                  <p className="text-[11px] text-white/80">Ficha cadastral de cliente e processo judicial</p>
                </div>
                <button
                  onClick={() => setIsNewClientModalOpen(false)}
                  className="text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateClient} className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 text-xs overflow-y-auto flex-1">
                <div>
                  <label className="font-bold text-[#333] block mb-1">Nome Completo / Firma Coletiva *</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Sociedade Agrícola do Norte, Lda."
                    value={clientFormName}
                    onChange={(e) => setClientFormName(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-[#92006F] outline-none text-[#141414]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-[#333] block mb-1">NIF Português</label>
                    <input
                      type="text"
                      maxLength={9}
                      placeholder="ex: 501234567"
                      value={clientFormNif}
                      onChange={(e) => setClientFormNif(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-[#92006F] outline-none text-[#141414]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#333] block mb-1">Ref.ª do Processo Judicial</label>
                    <input
                      type="text"
                      placeholder="ex: Proc. 512/26.4T8OVR"
                      value={clientFormProcess}
                      onChange={(e) => setClientFormProcess(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-[#92006F] outline-none text-[#141414]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-[#333] block mb-1">Correio Eletrónico</label>
                    <input
                      type="email"
                      placeholder="contacto@cliente.pt"
                      value={clientFormEmail}
                      onChange={(e) => setClientFormEmail(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-[#92006F] outline-none text-[#141414]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-[#333] block mb-1">Telefone / Telemóvel</label>
                    <input
                      type="tel"
                      placeholder="+351 912 345 678"
                      value={clientFormPhone}
                      onChange={(e) => setClientFormPhone(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-[#92006F] outline-none text-[#141414]"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-[#333] block mb-1">Observações Forenses</label>
                  <textarea
                    rows={2}
                    placeholder="Histórico prévio, especificidades fiscais ou avenças..."
                    value={clientFormNotes}
                    onChange={(e) => setClientFormNotes(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-[#92006F] outline-none text-[#141414]"
                  />
                </div>

                <div className="pt-3 sm:pt-4 border-t border-[#EFE8DD] flex items-center justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsNewClientModalOpen(false)}
                    className="px-4 py-2 border border-[#D9D1C5] rounded-md text-[#666] hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingClient}
                    className="bg-[#92006F] hover:bg-[#7E0060] text-white px-5 py-2 rounded-md font-semibold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isSubmittingClient ? "A registar..." : "Registar Cliente"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* ── BARRA DE NAVEGAÇÃO INFERIOR PARA TELEMÓVEL (MOBILE BOTTOM BAR) ── */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#ECE6DB] flex items-center justify-around py-1.5 px-1 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
          <button
            onClick={() => switchTab("dashboard")}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
              activeTab === "dashboard"
                ? "text-[#92006F] font-bold"
                : "text-[#666] hover:text-[#111]"
            }`}
          >
            <LayoutDashboard className="w-4 h-4 mb-0.5" />
            <span>Painel</span>
          </button>

          <button
            onClick={() => switchTab("tasks")}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
              activeTab === "tasks"
                ? "text-[#92006F] font-bold"
                : "text-[#666] hover:text-[#111]"
            }`}
          >
            <Kanban className="w-4 h-4 mb-0.5" />
            <span>Tarefas</span>
          </button>

          <button
            onClick={() => switchTab("archived")}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors cursor-pointer relative ${
              activeTab === "archived"
                ? "text-[#92006F] font-bold"
                : "text-[#666] hover:text-[#111]"
            }`}
          >
            <Archive className="w-4 h-4 mb-0.5" />
            <span>Arquivo</span>
            {tasks.filter((t) => t.status === "archived").length > 0 && (
              <span className="absolute top-0.5 right-2 w-2 h-2 rounded-full bg-[#92006F]" />
            )}
          </button>

          <button
            onClick={() => switchTab("calendar")}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
              activeTab === "calendar"
                ? "text-[#92006F] font-bold"
                : "text-[#666] hover:text-[#111]"
            }`}
          >
            <Scale className="w-4 h-4 mb-0.5" />
            <span>Prazos</span>
          </button>

          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-medium text-[#666] hover:text-[#111] transition-colors cursor-pointer"
          >
            <Menu className="w-4 h-4 mb-0.5" />
            <span>Mais</span>
          </button>
        </nav>

        {/* ── MODAL: DETALHES & REATRIBUIÇÃO DE TAREFA ── */}
        {selectedTaskForDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white border border-[#D4AF37]/40 rounded-xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden my-auto">
              <div className="bg-gradient-to-r from-[#92006F] to-[#5E0047] text-white px-5 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-sm font-bold tracking-wide">Detalhes & Reatribuição de Tarefa</h3>
                  <p className="text-[11px] text-white/80">Ref. {selectedTaskForDetails.id} · {selectedTaskForDetails.client_name}</p>
                </div>
                <button
                  onClick={() => setSelectedTaskForDetails(null)}
                  className="text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveTaskDetails} className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 text-xs overflow-y-auto flex-1">
                <div>
                  <label className="font-bold text-[#333] block mb-1">Título da Tarefa *</label>
                  <input
                    type="text"
                    required
                    value={detailsForm.title}
                    onChange={(e) => setDetailsForm({ ...detailsForm, title: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-[#92006F] outline-none text-[#141414]"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#333] block mb-1">Descrição / Factos Forenses</label>
                  <textarea
                    rows={3}
                    value={detailsForm.description}
                    onChange={(e) => setDetailsForm({ ...detailsForm, description: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-[#92006F] outline-none text-[#141414]"
                  />
                </div>

                {/* Secção de Reatribuição (Reassign Dinâmico com Todas as Utilizadoras / Tiago) */}
                <div className="p-3 bg-[#FCF8EE] border border-[#F1E5C7] rounded-lg space-y-2">
                  <label className="font-bold text-[#AA820A] block flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-[#AA820A]" /> Reatribuir Advogada / Responsável:
                  </label>
                  <select
                    value={detailsForm.assigned_to}
                    onChange={(e) => setDetailsForm({ ...detailsForm, assigned_to: e.target.value })}
                    className="w-full bg-white border border-[#D9D1C5] rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-[#92006F] outline-none text-[#141414] font-semibold cursor-pointer"
                  >
                    <option value="pool">Pool Partilhada (Livre / Sem Advogada)</option>
                    {(usersList && usersList.length > 0 ? usersList : INITIAL_USERS)
                      .filter((u: any) => u.is_active !== false)
                      .map((u: any) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role === "admin_lawyer" ? "Direção / Admin" : "Advogada"})
                        </option>
                      ))}
                  </select>
                  <p className="text-[10px] text-[#777]">
                    Ao reatribuir, a tarefa passará a constar imediatamente no painel do utilizador selecionado.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-[#333] block mb-1">Estado da Tarefa</label>
                    <select
                      value={detailsForm.status}
                      onChange={(e) => setDetailsForm({ ...detailsForm, status: e.target.value as Task["status"] })}
                      className="w-full bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-[#92006F] outline-none text-[#141414] cursor-pointer"
                    >
                      <option value="pool">Pool Partilhada</option>
                      <option value="assigned">Aberta / Atribuída</option>
                      <option value="in_progress">Em Andamento</option>
                      <option value="paused">Pausada</option>
                      <option value="completed">Concluída</option>
                      <option value="archived">Arquivada</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-[#333] block mb-1">Data Limite / Prazo</label>
                    <EuropeanDateInput
                      value={detailsForm.due_date}
                      onChange={(iso) => setDetailsForm({ ...detailsForm, due_date: iso })}
                      className="w-full bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-[#92006F] outline-none text-[#141414]"
                    />
                  </div>
                </div>

                <div className="bg-[#F5F1EA] p-3 rounded-lg border border-[#E4DDD2] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#444] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#92006F]" />
                      Ajuste Manual de Tempo Acumulado:
                    </span>
                    <strong className="font-mono text-xs text-[#92006F] bg-white px-2 py-0.5 rounded border border-[#E2DAD0]">
                      {formatSeconds(
                        Math.max(
                          0,
                          (Number(detailsForm.duration_hours) || 0) * 3600 +
                            (Number(detailsForm.duration_minutes) || 0) * 60 +
                            (Number(detailsForm.duration_seconds) || 0)
                        )
                      )}
                    </strong>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-[#665F54] block mb-0.5">
                        Horas
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={detailsForm.duration_hours}
                        onChange={(e) =>
                          setDetailsForm({
                            ...detailsForm,
                            duration_hours: Math.max(0, parseInt(e.target.value, 10) || 0),
                          })
                        }
                        className="w-full bg-white border border-[#D9D1C5] rounded px-2 py-1.5 text-xs font-mono font-bold text-[#141414] focus:ring-1 focus:ring-[#92006F] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-[#665F54] block mb-0.5">
                        Minutos
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={detailsForm.duration_minutes}
                        onChange={(e) =>
                          setDetailsForm({
                            ...detailsForm,
                            duration_minutes: Math.max(0, parseInt(e.target.value, 10) || 0),
                          })
                        }
                        className="w-full bg-white border border-[#D9D1C5] rounded px-2 py-1.5 text-xs font-mono font-bold text-[#141414] focus:ring-1 focus:ring-[#92006F] outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-[#665F54] block mb-0.5">
                        Segundos
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={detailsForm.duration_seconds}
                        onChange={(e) =>
                          setDetailsForm({
                            ...detailsForm,
                            duration_seconds: Math.max(0, parseInt(e.target.value, 10) || 0),
                          })
                        }
                        className="w-full bg-white border border-[#D9D1C5] rounded px-2 py-1.5 text-xs font-mono font-bold text-[#141414] focus:ring-1 focus:ring-[#92006F] outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-1.5 pt-1">
                    <span className="text-[10px] text-[#736B5E]">Atalhos rápidos:</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {[
                        { label: "+15m", addSec: 900 },
                        { label: "+30m", addSec: 1800 },
                        { label: "+1h", addSec: 3600 },
                      ].map((btn) => (
                        <button
                          key={btn.label}
                          type="button"
                          onClick={() => {
                            const cur =
                              (Number(detailsForm.duration_hours) || 0) * 3600 +
                              (Number(detailsForm.duration_minutes) || 0) * 60 +
                              (Number(detailsForm.duration_seconds) || 0) +
                              btn.addSec;
                            setDetailsForm({
                              ...detailsForm,
                              duration_hours: Math.floor(cur / 3600),
                              duration_minutes: Math.floor((cur % 3600) / 60),
                              duration_seconds: cur % 60,
                            });
                          }}
                          className="text-[10px] font-bold bg-white hover:bg-[#FAF8F5] text-[#92006F] border border-[#D9D1C5] px-2 py-0.5 rounded cursor-pointer transition-colors"
                        >
                          {btn.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setDetailsForm({
                            ...detailsForm,
                            duration_hours: 0,
                            duration_minutes: 0,
                            duration_seconds: 0,
                          })
                        }
                        className="text-[10px] font-semibold bg-white hover:bg-rose-50 text-rose-600 border border-[#D9D1C5] px-2 py-0.5 rounded cursor-pointer transition-colors"
                      >
                        Zerar
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-3 sm:pt-4 border-t border-[#EFE8DD] flex items-center justify-between gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const t = selectedTaskForDetails;
                      setSelectedTaskForDetails(null);
                      confirmDeleteTask(t);
                    }}
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-md font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar Tarefa</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTaskForDetails(null)}
                      className="px-4 py-2 border border-[#D9D1C5] rounded-md text-[#666] hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingDetails}
                      className="bg-[#92006F] hover:bg-[#7E0060] text-white px-5 py-2 rounded-md font-semibold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {isSubmittingDetails ? "A guardar..." : "Guardar Alterações"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL: CONFIRMAR ELIMINAÇÃO DE TAREFA ── */}
        {taskToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white border border-rose-300 rounded-xl shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0 text-rose-600">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#141414]">Confirmar Eliminação da Tarefa</h3>
                  <p className="text-xs text-[#666] mt-1">
                    Tem a certeza de que deseja eliminar permanentemente a tarefa{" "}
                    <strong className="text-[#141414]">"{taskToDelete.title}"</strong> ({taskToDelete.client_name})?
                  </p>
                  <p className="text-[11px] text-rose-600 font-semibold mt-1.5">
                    Esta ação não poderá ser revertida e removerá todos os registos associados.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-[#ECE6DB] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTaskToDelete(null)}
                  className="px-4 py-2 border border-[#D9D1C5] rounded-md text-xs font-semibold text-[#666] hover:bg-[#FAF8F5] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteTask}
                  disabled={isDeletingTask}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-4 py-2 rounded-md flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeletingTask ? "A eliminar..." : "Sim, Eliminar Definitivamente"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL POPUP: ALERTA DE 1 HORA DE TAREFA EM ANDAMENTO + NOTIFICAÇÃO POR EMAIL ── */}
        {overtimeAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white border-2 border-[#D4AF37] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
              <div className="bg-gradient-to-r from-[#92006F] to-[#5E0047] text-white px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-300 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-wide">
                      Alerta de Execução · {overtimeAlert.hours}h em Andamento
                    </h3>
                    <p className="text-[11px] text-white/80">
                      Controlo de Tempo & Notificação Automática PCN
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleContinueOvertimeTask}
                  className="text-white/75 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1">
                  <p className="font-bold text-xs flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Esta tarefa atingiu {overtimeAlert.hours} hora(s) em execução!</span>
                  </p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Verifique se ainda se encontra a trabalhar neste assunto ou se deseja pausar/concluir o cronómetro.
                  </p>
                </div>

                <div className="bg-[#FAF8F5] border border-[#ECE6DB] rounded-xl p-3.5 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-[#736B5E]">Tarefa:</span>
                    <strong className="text-[#141414] text-right">{overtimeAlert.task.title}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#736B5E]">Cliente:</span>
                    <strong className="text-[#141414]">{overtimeAlert.task.client_name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#736B5E]">Responsável:</span>
                    <span className="font-semibold text-[#333]">{overtimeAlert.task.lawyer_name || currentUser.name}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-[#ECE6DB]">
                    <span className="text-[#736B5E]">Tempo Acumulado:</span>
                    <strong className="font-mono text-sm text-[#92006F]">
                      {formatSeconds(
                        tasks.find((t) => t.id === overtimeAlert.task.id)?.total_duration_seconds ??
                          overtimeAlert.task.total_duration_seconds
                      )}
                    </strong>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Alerta enviado para o correio eletrónico:{" "}
                    <strong>{overtimeAlert.recipientEmail}</strong>
                  </span>
                </div>

                <div className="pt-2 border-t border-[#ECE6DB] flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const target = tasks.find((t) => t.id === overtimeAlert.task.id) || overtimeAlert.task;
                      setOvertimeAlert(null);
                      handlePauseTimer(target);
                    }}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pausar Tarefa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const target = tasks.find((t) => t.id === overtimeAlert.task.id) || overtimeAlert.task;
                      setOvertimeAlert(null);
                      handleCompleteTask(target);
                    }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Concluir</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleContinueOvertimeTask}
                    className="flex-1 bg-[#92006F] hover:bg-[#7E0060] text-white font-semibold py-2 px-3 rounded-lg cursor-pointer transition-colors"
                  >
                    Continuar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
