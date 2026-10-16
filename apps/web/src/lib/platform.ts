/**
 * Utilitário para deteção automática do Sistema Operativo (OS)
 * e do fornecedor de calendário padrão (Apple Calendar, Google Agenda, Outlook).
 */

export type DetectedPlatform = "ios" | "android" | "mac" | "windows" | "other";

export interface PlatformInfo {
  os: DetectedPlatform;
  label: string;
  shortLabel: string;
  defaultCalendarType: "ics" | "google" | "outlook";
  hint: string;
}

export function detectPlatform(): PlatformInfo {
  if (typeof window === "undefined" || !navigator) {
    return {
      os: "other",
      label: "Agenda (.ics)",
      shortLabel: "Agenda",
      defaultCalendarType: "ics",
      hint: "Compatível com qualquer aplicação de calendário",
    };
  }

  const ua = navigator.userAgent || "";
  const platform = (navigator as any).userAgentData?.platform || navigator.platform || "";

  // 1. iOS (iPhone, iPad, iPod) - Trata também iPadOS recente que reporta MacIntel com multi-touch
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (platform === "MacIntel" && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1);

  if (isIOS) {
    return {
      os: "ios",
      label: "Adicionar à Agenda do iPhone (Apple)",
      shortLabel: "iPhone (Apple)",
      defaultCalendarType: "ics",
      hint: "Abre diretamente na app Calendário do iOS",
    };
  }

  // 2. Android
  if (/Android/i.test(ua)) {
    return {
      os: "android",
      label: "Adicionar ao Google Agenda",
      shortLabel: "Google Agenda",
      defaultCalendarType: "google",
      hint: "Abre na app Google Agenda no telemóvel Android",
    };
  }

  // 3. macOS
  if (/Macintosh|Mac OS X/i.test(ua)) {
    return {
      os: "mac",
      label: "Adicionar ao Calendário do Mac (Apple)",
      shortLabel: "Mac (Apple)",
      defaultCalendarType: "ics",
      hint: "Abre na app Calendário nativa do macOS",
    };
  }

  // 4. Windows PC
  if (/Windows|Win32|Win64/i.test(ua)) {
    return {
      os: "windows",
      label: "Adicionar à Agenda (Outlook / Windows)",
      shortLabel: "Outlook / Windows",
      defaultCalendarType: "ics",
      hint: "Abre automaticamente no Microsoft Outlook ou Calendário do Windows",
    };
  }

  // 5. Outros sistemas (Linux, ChromeOS, etc.)
  return {
    os: "other",
    label: "Adicionar à Agenda (.ics)",
    shortLabel: "Agenda (.ics)",
    defaultCalendarType: "ics",
    hint: "Ficheiro universal iCalendar (.ics)",
  };
}
