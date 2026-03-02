import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "wordlist_manager_app_settings_v1";
const DEFAULT_SETTINGS = {
  aiModel: "google/gemini-2.5-flash-lite",
};

const AppSettingsContext = createContext(null);

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_SETTINGS;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch (_err) {
    return DEFAULT_SETTINGS;
  }
}

export function AppSettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => loadSettings());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (_err) {
      // no-op
    }
  }, [settings]);

  const setAiModel = (value) => {
    setSettings((prev) => ({
      ...prev,
      aiModel: String(value || "").trim() || DEFAULT_SETTINGS.aiModel,
    }));
  };

  const resetSettings = () => setSettings(DEFAULT_SETTINGS);

  const value = useMemo(
    () => ({
      settings,
      setAiModel,
      resetSettings,
    }),
    [settings]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error("useAppSettings must be used within AppSettingsProvider.");
  }
  return context;
}

