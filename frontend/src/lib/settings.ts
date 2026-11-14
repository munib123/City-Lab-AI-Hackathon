import { useCallback, useEffect, useState } from "react";

export interface AppSettings {
  largerText: boolean;
  reduceMotion: boolean;
  /** Open urgent, high and low results automatically on the analysis page. */
  expandFlaggedByDefault: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  largerText: false,
  reduceMotion: false,
  expandFlaggedByDefault: false,
};

const KEY = "labsense.settings";
const EVENT = "labsense:settings";

function read(): AppSettings {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Settings stored in this browser only. Starts with defaults on the server, then hydrates. */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(read());
    const sync = () => setSettings(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((patch: Partial<AppSettings>) => {
    const next = { ...read(), ...patch };
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const reset = useCallback(() => {
    window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { settings, update, reset };
}
