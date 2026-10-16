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
import { INITIAL_USERS, INITIAL_CLIENTS, INITIAL_TASKS } from "@/lib/mockData";
import { Task, Client, UserProfile } from "@/lib/types";
import { detectPlatform, PlatformInfo } from "@/lib/platform";
import {
  loginApi,
  changePasswordApi,
  getDirectionBoard,
  getClientsApi,
  createClientApi,
  getActiveTimerApi,
  startTimerApi,
  pauseTimerApi,
  completeTaskApi,
  claimTaskApi,
  createTaskApi,
  assignTaskApi,
  updateTaskApi,
  archiveTaskApi,
  restoreTaskApi,
  deleteTaskApi,
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

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile>(INITIAL_USERS[0]);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [sessionExpiry, setSessionExpiry] = useState<number | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "tasks" | "archived" | "clients" | "calendar" | "feenotes" | "reports" | "users"
  >("dashboard");

  // User Management State (Portal Admin)
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

  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingApi, setIsLoadingApi] = useState<boolean>(false);
  const [apiConnected, setApiConnected] = useState<boolean>(false);

  // Active Timer State
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  // Search in Reports
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [reportsData, setReportsData] = useState<any>(null);

  // Judicial Deadline Calculator State (Art. 138/139 CPC)
  const [calcStartDate, setCalcStartDate] = useState<string>("2026-07-10");
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

  // Fee Note Builder State
  const [selectedFeeClient, setSelectedFeeClient] = useState<string>("");
  const [feeTaskPrices, setFeeTaskPrices] = useState<Record<string, number>>({});
  const [feeNotesByClient, setFeeNotesByClient] = useState<Record<string, any>>({});
  const [applyWithholdingByClient, setApplyWithholdingByClient] = useState<Record<string, boolean>>({});
  const [isSavingFeeNote, setIsSavingFeeNote] = useState<boolean>(false);

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

  // Task Details & Reassign Modal State
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState<Task | null>(null);
  const [detailsForm, setDetailsForm] = useState<{
    title: string;
    description: string;
    assigned_to: string;
    due_date: string;
    status: Task["status"];
  }>({
    title: "",
    description: "",
    assigned_to: "pool",
    due_date: "",
    status: "assigned",
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
    tab: "dashboard" | "tasks" | "archived" | "clients" | "calendar" | "feenotes" | "reports" | "users"
  ) => {
    if (typeof window !== "undefined") {
      window.history.pushState({ tab }, "");
    }
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const openTaskDetails = (task: Task) => {
    if (typeof window !== "undefined") {
      window.history.pushState({ modal: "taskDetails" }, "");
    }
    setSelectedTaskForDetails(task);
    setDetailsForm({
      title: task.title,
      description: task.description || "",
      assigned_to: task.assigned_to || (task.status === "pool" ? "pool" : "usr_patricia"),
      due_date: task.due_date || "",
      status: task.status,
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
  const [taskFormDueDate, setTaskFormDueDate] = useState("2026-10-25");
  const [taskFormIsUrgent, setTaskFormIsUrgent] = useState(false);
  const [taskFormPublishToPool, setTaskFormPublishToPool] = useState(false);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

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

      // 1. Tarefas
      try {
        const apiTasks = await getDirectionBoard(token);
        if (apiTasks) {
          const mappedTasks = apiTasks.map((t: any) => {
            const parsedFee = t.fee_amount !== null && t.fee_amount !== undefined ? parseFloat(t.fee_amount) : undefined;
            if (parsedFee !== undefined && !isNaN(parsedFee)) {
              dbPrices[t.id] = parsedFee;
            }
            return {
              id: t.id,
              title: t.title,
              description: t.description,
              client_id: t.client_id,
              client_name: t.client?.name || "Cliente",
              task_type: t.task_type?.name || "Geral",
              status: t.status,
              assigned_to: t.assigned_to,
              lawyer_name: t.assignee?.name || "—",
              due_date: t.due_date ? t.due_date.split("T")[0] : undefined,
              total_duration_seconds: t.total_duration_seconds || 0,
              fee_amount: parsedFee,
            };
          });
          setTasks(mappedTasks);
        }
      } catch (e) {
        console.warn("Aviso ao carregar tarefas:", e);
      }

      // 1.b Cronómetro Ativo
      try {
        const activeTimer = await getActiveTimerApi(token);
        if (activeTimer && activeTimer.is_active && activeTimer.task_id) {
          setActiveTaskId(activeTimer.task_id);
          setTimerSeconds(activeTimer.total_accumulated_seconds || 0);
          setIsTimerRunning(true);
        }
      } catch (e) {
        console.warn("Aviso ao verificar cronómetro ativo:", e);
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

      // 3. Utilizadores e Notas de Honorários (se Direção / Admin)
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

        try {
          setIsLoadingUsers(true);
          const apiUsers = await getUsersApi(token);
          if (apiUsers && apiUsers.length > 0) {
            setUsersList(apiUsers);
          }
        } catch (e) {
          console.warn("Aviso ao carregar utilizadoras:", e);
        } finally {
          setIsLoadingUsers(false);
        }
      }

      setFeeTaskPrices(dbPrices);
    } finally {
      setIsLoadingApi(false);
    }
  };

  const handleLogout = (notice?: string) => {
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

  // 2. Live timer interval (supports multiple concurrent in_progress tasks)
  const hasRunningTasks = tasks.some((t) => t.status === "in_progress");
  useEffect(() => {
    if (!hasRunningTasks && !isTimerRunning) return;
    const interval = setInterval(() => {
      setTasks((prev) =>
        prev.map((t) =>
          t.status === "in_progress"
            ? { ...t, total_duration_seconds: (t.total_duration_seconds || 0) + 1 }
            : t
        )
      );
      if (isTimerRunning && activeTaskId) {
        setTimerSeconds((prev) => prev + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [hasRunningTasks, isTimerRunning, activeTaskId]);

  const formatSeconds = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleStartTimer = async (task: Task) => {
    let serverDuration = task.total_duration_seconds;
    if (authToken && apiConnected) {
      try {
        const updated = await startTimerApi(task.id, authToken);
        if (updated && typeof updated.total_duration_seconds === "number") {
          serverDuration = updated.total_duration_seconds;
        }
      } catch (e) {
        console.error(e);
      }
    }
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
        const updated = await pauseTimerApi(targetId, authToken);
        if (updated && typeof updated.total_duration_seconds === "number") {
          finalSeconds = updated.total_duration_seconds;
        }
      } catch (e) {
        console.error(e);
      }
    }

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
        const updated = await completeTaskApi(task.id, authToken);
        if (updated && typeof updated.total_duration_seconds === "number") {
          finalSeconds = updated.total_duration_seconds;
        }
      } catch (e) {
        console.error(e);
      }
    }
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

  const handleSaveTaskDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskForDetails) return;
    setIsSubmittingDetails(true);
    try {
      const isPool = detailsForm.assigned_to === "pool";
      const lawyerMap: Record<string, string> = {
        usr_patricia: "Dr.ª Patrícia",
        usr_ines: "Dr.ª Inês",
        usr_sofia: "Dr.ª Sofia",
      };

      const finalStatus: Task["status"] = isPool
        ? "pool"
        : detailsForm.status === "pool"
        ? "assigned"
        : detailsForm.status;

      if (authToken && apiConnected) {
        if (isPool) {
          await assignTaskApi(selectedTaskForDetails.id, null, authToken);
          await updateTaskApi(selectedTaskForDetails.id, authToken, {
            title: detailsForm.title,
            description: detailsForm.description,
            due_date: detailsForm.due_date ? `${detailsForm.due_date}T18:00:00` : null,
            status: finalStatus,
          });
        } else {
          await assignTaskApi(selectedTaskForDetails.id, detailsForm.assigned_to, authToken);
          await updateTaskApi(selectedTaskForDetails.id, authToken, {
            title: detailsForm.title,
            description: detailsForm.description,
            due_date: detailsForm.due_date ? `${detailsForm.due_date}T18:00:00` : null,
            status: finalStatus,
          });
        }
      }

      setTasks((prev) =>
        prev.map((t) =>
          t.id === selectedTaskForDetails.id
            ? {
                ...t,
                title: detailsForm.title,
                description: detailsForm.description,
                status: finalStatus,
                assigned_to: isPool ? undefined : detailsForm.assigned_to,
                lawyer_name: isPool ? undefined : lawyerMap[detailsForm.assigned_to] || "Advogada",
                due_date: detailsForm.due_date || t.due_date,
              }
            : t
        )
      );

      setSelectedTaskForDetails(null);
      setModalFeedback("Detalhes e atribuição da tarefa guardados com sucesso!");
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
      const typeMap: Record<string, string> = {
        tp_1: "Certidões e Registos",
        tp_2: "Peças Processuais",
        tp_3: "Consultoria e Reuniões",
        tp_4: "Audiências e Julgamentos",
      };
      const lawyerMap: Record<string, string> = {
        usr_patricia: "Dr.ª Patrícia",
        usr_ines: "Dr.ª Inês",
        usr_sofia: "Dr.ª Sofia",
      };
      const selectedClient = clients.find((c) => c.id === effectiveClientId);

      if (authToken && apiConnected) {
        const created = await createTaskApi(authToken, {
          title: taskFormTitle.trim(),
          description: taskFormDescription.trim() || undefined,
          client_id: effectiveClientId,
          task_type_id: taskFormTypeId,
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
          task_type: typeMap[taskFormTypeId] || "Geral",
          status: taskFormPublishToPool ? "pool" : "assigned",
          assigned_to: taskFormPublishToPool ? undefined : taskFormAssignee,
          lawyer_name: taskFormPublishToPool ? undefined : lawyerMap[taskFormAssignee],
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
          task_type: typeMap[taskFormTypeId] || "Peças Processuais",
          status: taskFormPublishToPool ? "pool" : "assigned",
          assigned_to: taskFormPublishToPool ? undefined : taskFormAssignee,
          lawyer_name: taskFormPublishToPool ? undefined : lawyerMap[taskFormAssignee],
          due_date: taskFormDueDate,
          total_duration_seconds: 0,
        };
        setTasks((prev) => [newTask, ...prev]);
      }

      setModalFeedback("Tarefa jurídica criada com sucesso!");
      setTimeout(() => setModalFeedback(null), 3500);
      setIsNewTaskModalOpen(false);
      setTaskFormTitle("");
      setTaskFormDescription("");
    } catch (err: any) {
      alert("Erro ao criar tarefa: " + err.message);
    } finally {
      setIsSubmittingTask(false);
    }
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

  // Metrics calculations
  const archivedTasksCount = tasks.filter((t) => t.status === "archived").length;
  const openTasksCount = tasks.filter((t) => t.status !== "completed" && t.status !== "archived").length;
  const completedTasksCount = tasks.filter((t) => t.status === "completed").length;
  const poolTasksCount = tasks.filter((t) => t.status === "pool").length;

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
    <div className="flex min-h-screen bg-[#FAF8F5]">
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

        {/* ── CONTEÚDO DA TAB: PAINEL DE DIREÇÃO (DESIGN EXATO DA IMAGEM) ── */}
        {activeTab === "dashboard" && (
          <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl w-full mx-auto">
            {/* 1. Fileira de 4 Cartões KPI */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="pcn-card p-3.5 sm:p-5 bg-gradient-to-b from-white to-[#FAF6F8]">
                <p className="text-[11px] sm:text-xs font-medium text-[#736B5E] mb-1">Tarefas em aberto</p>
                <p className="text-2xl sm:text-4xl font-bold text-[#92006F]">{openTasksCount}</p>
              </div>

              <div className="pcn-card p-3.5 sm:p-5">
                <p className="text-[11px] sm:text-xs font-medium text-[#736B5E] mb-1">Prazos ultrapassados</p>
                <p className="text-2xl sm:text-4xl font-bold text-[#92006F]">0</p>
              </div>

              <div className="pcn-card p-3.5 sm:p-5">
                <p className="text-[11px] sm:text-xs font-medium text-[#736B5E] mb-1">Por atribuir</p>
                <p className="text-2xl sm:text-4xl font-bold text-[#92006F]">{poolTasksCount}</p>
              </div>

              <div className="pcn-card p-3.5 sm:p-5">
                <p className="text-[11px] sm:text-xs font-medium text-[#736B5E] mb-1">Tarefas concluídas</p>
                <p className="text-2xl sm:text-4xl font-bold text-[#141414]">{completedTasksCount}</p>
              </div>
            </div>

            {/* 2. Grelha Central de Dois Cartões */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Assuntos que exigem atenção */}
              <div className="lg:col-span-7 pcn-card p-6 flex flex-col justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#1F1F1F]">Assuntos que exigem atenção</h2>
                  <div className="gold-accent-line w-full my-3" />

                  <div className="py-2 divide-y divide-[#F2EDE4]">
                    <div className="py-2 text-xs text-[#333] flex items-center justify-between hover:bg-[#FAF8F5] px-2 rounded transition-colors">
                      <span className="font-medium">
                        <strong>Cliente A</strong> · Registo predial — Inês · 21/10/2026
                      </span>
                      <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                        A vencer em 5 dias
                      </span>
                    </div>

                    <div className="py-2 text-xs text-[#333] flex items-center justify-between hover:bg-[#FAF8F5] px-2 rounded transition-colors">
                      <span className="font-medium">
                        <strong>Cliente B</strong> · Certidão negativa de dívidas — Pool partilhada
                      </span>
                      <span className="text-[10px] bg-purple-50 text-[#92006F] border border-purple-200 px-2 py-0.5 rounded-full font-semibold">
                        Disponível
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-[#F2EDE4] flex justify-end">
                  <button
                    onClick={() => setActiveTab("tasks")}
                    className="text-xs font-semibold text-[#92006F] hover:underline cursor-pointer"
                  >
                    Ver todas as tarefas no quadro →
                  </button>
                </div>
              </div>

              {/* Resumo operacional */}
              <div className="lg:col-span-5 pcn-card p-6 flex flex-col justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#1F1F1F]">Resumo operacional</h2>
                  <div className="gold-accent-line w-full my-3" />

                  <ul className="space-y-2 text-xs text-[#444] py-1">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#AA820A]"></span>
                      <span>
                        <strong>1</strong> tarefas a aguardar cliente
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#AA820A]"></span>
                      <span>
                        <strong>2</strong> clientes com assuntos ativos
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#AA820A]"></span>
                      <span>
                        <strong>1</strong> serviços concluídos ainda não faturados
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#AA820A]"></span>
                      <span>
                        <strong>2</strong> compromissos / prazos registados
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="mt-5">
                  <button
                    onClick={() => setActiveTab("reports")}
                    className="w-full sm:w-auto bg-[#BA9448] hover:bg-[#A88238] text-white text-xs font-semibold px-5 py-2.5 rounded-md shadow-xs transition-colors cursor-pointer"
                  >
                    Consultar relatório das 9h00
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Bloco Inferior: Prioridades e Acompanhamento Externo */}
            <div className="pcn-card p-6">
              <h2 className="text-base font-bold text-[#1F1F1F]">
                Prioridades e acompanhamento externo
              </h2>
              <div className="py-3 text-xs text-[#736B5E]">Sem alertas adicionais.</div>
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
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[#ECE6DB] -mx-1 px-1">
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
                        ? "bg-[#92006F] text-white shadow-xs"
                        : "bg-white text-[#666] border border-[#E5DECF] hover:border-[#AA820A] hover:text-[#111]"
                    }`}
                  >
                    <span>{f.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-[#FAF7F2] text-[#888] border border-[#EFE8DD]"
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
                <div className="pcn-card p-3.5 sm:p-4 bg-[#FDFCFB]">
                  <div className="flex items-center justify-between pb-3 border-b border-[#ECE6DB]">
                    <h3 className="text-xs font-bold text-[#141414] uppercase tracking-wider">
                      Pool Partilhada ({tasks.filter((t) => t.status === "pool").length})
                    </h3>
                    <span className="text-[10px] bg-purple-100 text-[#92006F] px-2 py-0.5 rounded font-semibold">
                      Livre
                    </span>
                  </div>

                  <div className="space-y-3 mt-3">
                    {tasks
                      .filter((t) => t.status === "pool")
                      .map((task) => (
                        <div
                          key={task.id}
                          className="bg-white border border-[#E5DECF] p-3 sm:p-3.5 rounded-lg shadow-xs space-y-2 hover:border-[#D4AF37] transition-all"
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
                      ))}
                    {tasks.filter((t) => t.status === "pool").length === 0 && (
                      <p className="text-xs text-[#888] text-center py-6 italic">
                        Nenhuma tarefa na Pool de momento.
                      </p>
                    )}
                  </div>
                </div>

                {/* Coluna 2: Em Andamento (e Abertas) */}
                <div className="pcn-card p-3.5 sm:p-4 bg-[#FDFCFB]">
                  <div className="flex items-center justify-between pb-3 border-b border-[#ECE6DB]">
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

                  <div className="space-y-3 mt-3">
                    {tasks
                      .filter(
                        (t) => t.status === "assigned" || t.status === "in_progress"
                      )
                      .map((task) => {
                        const isRunningThis = task.status === "in_progress";
                        return (
                          <div
                            key={task.id}
                            className={`bg-white border ${
                              isRunningThis ? "border-[#92006F] ring-1 ring-[#92006F]" : "border-[#E5DECF]"
                            } p-3 sm:p-3.5 rounded-lg shadow-xs space-y-2.5 transition-all`}
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

                            <div className="bg-[#FAF7F2] p-2 rounded border border-[#EFE8DD] flex items-center justify-between text-xs font-mono">
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
                <div className="pcn-card p-3.5 sm:p-4 bg-[#FDFCFB]">
                  <div className="flex items-center justify-between pb-3 border-b border-[#ECE6DB]">
                    <h3 className="text-xs font-bold text-[#141414] uppercase tracking-wider">
                      Pausadas ({tasks.filter((t) => t.status === "paused").length})
                    </h3>
                    <span className="text-[10px] bg-amber-100 text-[#AA820A] px-2 py-0.5 rounded font-semibold">
                      Em Pausa
                    </span>
                  </div>

                  <div className="space-y-3 mt-3">
                    {tasks
                      .filter((t) => t.status === "paused")
                      .map((task) => (
                        <div
                          key={task.id}
                          className="bg-white border border-[#E5DECF] p-3 sm:p-3.5 rounded-lg shadow-xs space-y-2.5 hover:border-[#D4AF37] transition-all"
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

                          <div className="bg-[#FAF7F2] p-2 rounded border border-[#EFE8DD] flex items-center justify-between text-xs font-mono">
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
                      ))}
                    {tasks.filter((t) => t.status === "paused").length === 0 && (
                      <p className="text-xs text-[#888] text-center py-6 italic">
                        Nenhuma tarefa pausada de momento.
                      </p>
                    )}
                  </div>
                </div>

                {/* Coluna 4: Tarefas Concluídas */}
                <div className="pcn-card p-3.5 sm:p-4 bg-[#FDFCFB]">
                  <div className="flex items-center justify-between pb-3 border-b border-[#ECE6DB]">
                    <h3 className="text-xs font-bold text-[#141414] uppercase tracking-wider">
                      Concluídas ({tasks.filter((t) => t.status === "completed").length})
                    </h3>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">
                      Finalizadas
                    </span>
                  </div>

                  <div className="space-y-3 mt-3">
                    {tasks
                      .filter((t) => t.status === "completed")
                      .map((task) => (
                        <div
                          key={task.id}
                          className="bg-white border border-[#E5DECF] p-3 sm:p-3.5 rounded-lg shadow-xs space-y-2 opacity-95 hover:border-[#D4AF37] transition-all"
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
                    .map((task) => (
                      <div
                        key={task.id}
                        className="bg-white border border-[#E5DECF] p-4 rounded-xl shadow-xs space-y-3 hover:border-[#D4AF37] transition-all"
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
                    ))}
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
                      className="bg-white border border-[#E5DECF] p-4 rounded-xl shadow-xs space-y-3 hover:border-[#D4AF37] transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#777] uppercase bg-[#FAF8F5] px-2 py-0.5 rounded border border-[#ECE6DB]">
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

            return (
              <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl w-full mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#141414]">
                      Notas de Honorários PCN
                    </h2>
                    <p className="text-xs text-[#736B5E]">
                      Área financeira reservada à Dr.ª Patrícia. Atribua o preço com base no tempo gasto, guarde na base de dados e exporte o ficheiro Excel oficial.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => saveFeeNoteToDb(selectedFeeClient)}
                      disabled={isSavingFeeNote || clientTasks.length === 0}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-3 sm:px-4 py-2 rounded-md shadow-xs flex items-center gap-1.5 sm:gap-2 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isSavingFeeNote ? (
                        <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
                      ) : (
                        <Database className="w-4 h-4 shrink-0" />
                      )}
                      <span>
                        {isSavingFeeNote ? "A guardar..." : "Guardar na Base de Dados"}
                      </span>
                    </button>

                    <button
                      onClick={() => handleExportExcel(false)}
                      disabled={isExportingExcel || clientTasks.length === 0}
                      className="bg-[#92006F] hover:bg-[#7A005D] text-white text-xs font-semibold px-3 sm:px-4 py-2 rounded-md shadow-xs flex items-center gap-1.5 sm:gap-2 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <FileSpreadsheet className="w-4 h-4 shrink-0" />
                      <span>
                        {isExportingExcel ? "A descarregar..." : "Exportar Excel (Cliente)"}
                      </span>
                    </button>

                    <button
                      onClick={() => handleExportExcel(true)}
                      disabled={isExportingExcel || clientTasks.length === 0}
                      className="bg-[#BA9448] hover:bg-[#A88238] text-white text-xs font-semibold px-3 py-2 rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <span>{isExportingExcel ? "..." : "Versão Interna"}</span>
                    </button>
                  </div>
                </div>

                {/* Seletor de Cliente */}
                <div className="pcn-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <label className="text-xs font-bold text-[#444] block mb-2">
                      Selecione o Cliente para Faturação:
                    </label>
                    <select
                      value={selectedFeeClient}
                      onChange={(e) => setSelectedFeeClient(e.target.value)}
                      className="w-full sm:w-96 text-xs text-[#222] bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 focus:ring-1 focus:ring-[#92006F] outline-none"
                    >
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.nif || "Sem NIF"} — {c.process_reference || "Geral"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-1 sm:pt-5">
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
                    <table className="min-w-[620px] w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#92006F] text-white">
                          <th className="p-3">Data</th>
                          <th className="p-3">Descrição do Ato / Tarefa</th>
                          <th className="p-3">Advogada</th>
                          <th className="p-3">Tempo Gasto</th>
                          <th className="p-3 text-right">Honorários (€)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EFE9DE]">
                        {clientTasks.map((t) => (
                          <tr key={t.id} className="hover:bg-[#FAF8F5]">
                            <td className="p-3 text-[#555]">{t.due_date || "16/10/2026"}</td>
                            <td className="p-3 font-medium text-[#111]">{t.title}</td>
                            <td className="p-3 text-[#555]">{t.lawyer_name || "—"}</td>
                            <td className="p-3 font-mono font-semibold text-[#92006F]">
                              {formatSeconds(t.total_duration_seconds)}
                            </td>
                            <td className="p-3 text-right">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={
                                  feeTaskPrices[t.id] !== undefined
                                    ? feeTaskPrices[t.id]
                                    : (t.fee_amount ?? 0)
                                }
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
                                    ).catch((err) => console.error("Auto-save fee note error:", err));
                                  }, 800);
                                }}
                                className="w-24 sm:w-28 text-right font-semibold text-xs border border-[#D9D1C5] rounded px-2 py-1 focus:ring-1 focus:ring-[#92006F] bg-white"
                              />
                            </td>
                          </tr>
                        ))}
                        {clientTasks.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-xs text-[#888] italic">
                              Nenhuma tarefa registada para este cliente.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Quadro de Totais Fiscais */}
                  <div className="p-4 sm:p-5 bg-[#FAF8F5] border-t border-[#ECE6DB] flex justify-end">
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
                  <input
                    type="date"
                    value={calcStartDate}
                    onChange={(e) => setCalcStartDate(e.target.value)}
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

                  {/* Botão Único Inteligente com Deteção Automática do Sistema Operativo (iOS / Android / Mac / Windows) */}
                  <div className="pt-3 border-t border-[#EEDB98] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-[#AA820A] flex items-center gap-1.5">
                        <CalendarPlus className="w-4 h-4 text-[#AA820A]" />
                        Sincronizar Prazo Processual:
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
                <h2 className="text-base sm:text-lg font-bold text-[#141414]">Diretório de Clientes PCN</h2>
                <p className="text-xs text-[#736B5E]">
                  Histórico cronológico de assuntos e processos judiciais por cliente.
                </p>
              </div>

              <button
                onClick={() => setIsNewClientModalOpen(true)}
                className="bg-[#92006F] hover:bg-[#7E0060] text-white text-xs font-semibold px-4 py-2 rounded-md shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Registar Cliente</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {clients.map((c) => (
                <div key={c.id} className="pcn-card p-4 sm:p-5 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-sm font-bold text-[#141414]">{c.name}</h3>
                      <p className="text-xs text-[#777]">
                        NIF: {c.nif || "Não registado"} · {c.process_reference || "Assessoria Geral"}
                      </p>
                    </div>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">
                      Ativo
                    </span>
                  </div>

                  <div className="text-xs text-[#666] space-y-1">
                    <p>Correio: {c.email || "—"}</p>
                    <p>Contacto telefónico: {c.phone || "—"}</p>
                  </div>

                  <div className="pt-3 border-t border-[#F2EDE4] flex justify-between items-center text-xs">
                    <span className="text-[#888]">
                      {tasks.filter((t) => t.client_id === c.id).length} tarefas registadas
                    </span>
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
                    </div>
                  </div>
                </div>
              ))}
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
                    <label className="font-bold text-[#333] block mb-1">Tipo de Tarefa *</label>
                    <select
                      value={taskFormTypeId}
                      onChange={(e) => setTaskFormTypeId(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-[#92006F] outline-none text-[#141414]"
                    >
                      <option value="tp_1">Certidões e Registos</option>
                      <option value="tp_2">Peças Processuais</option>
                      <option value="tp_3">Consultoria e Reuniões</option>
                      <option value="tp_4">Audiências e Julgamentos</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="font-bold text-[#333] block mb-1">Data Limite / Prazo</label>
                    <input
                      type="date"
                      value={taskFormDueDate}
                      onChange={(e) => setTaskFormDueDate(e.target.value)}
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
                    <label className="font-bold text-[#333] block mb-1">Atribuir a Advogada</label>
                    <select
                      value={taskFormAssignee}
                      onChange={(e) => setTaskFormAssignee(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-[#92006F] outline-none text-[#141414]"
                    >
                      <option value="usr_patricia">Dr.ª Patrícia (Direção)</option>
                      <option value="usr_ines">Dr.ª Inês (Advogada)</option>
                      <option value="usr_sofia">Dr.ª Sofia (Advogada)</option>
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

                {/* Secção de Reatribuição (Reassign) */}
                <div className="p-3 bg-[#FCF8EE] border border-[#F1E5C7] rounded-lg space-y-2">
                  <label className="font-bold text-[#AA820A] block flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-[#AA820A]" /> Reatribuir Advogada Responsável:
                  </label>
                  <select
                    value={detailsForm.assigned_to}
                    onChange={(e) => setDetailsForm({ ...detailsForm, assigned_to: e.target.value })}
                    className="w-full bg-white border border-[#D9D1C5] rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-[#92006F] outline-none text-[#141414] font-semibold cursor-pointer"
                  >
                    <option value="pool">Pool Partilhada (Livre / Sem Advogada)</option>
                    <option value="usr_patricia">Dr.ª Patrícia Candeias Neto (Direção)</option>
                    <option value="usr_ines">Dr.ª Inês Ramos (Advogada)</option>
                    <option value="usr_sofia">Dr.ª Sofia Lima (Advogada)</option>
                  </select>
                  <p className="text-[10px] text-[#777]">
                    Ao reatribuir, a tarefa passará a constar imediatamente no painel da advogada selecionada.
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
                    <input
                      type="date"
                      value={detailsForm.due_date}
                      onChange={(e) => setDetailsForm({ ...detailsForm, due_date: e.target.value })}
                      className="w-full bg-[#FAF8F5] border border-[#D9D1C5] rounded-md px-3 py-2 text-xs focus:ring-1 focus:ring-[#92006F] outline-none text-[#141414]"
                    />
                  </div>
                </div>

                <div className="bg-[#FAF8F5] p-2.5 rounded border border-[#EFE8DD] flex items-center justify-between text-xs font-mono text-[#666]">
                  <span>Tempo acumulado registado:</span>
                  <strong className="text-[#141414] font-bold">
                    {formatSeconds(selectedTaskForDetails.total_duration_seconds)}
                  </strong>
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
      </main>
    </div>
  );
}
