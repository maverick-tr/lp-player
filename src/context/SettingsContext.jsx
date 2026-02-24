import { createContext, useState, useEffect, useCallback } from 'react';

export const SettingsContext = createContext();

const STORAGE_KEY = 'lap_settings';
const API_BASE = window.location.origin;

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load settings: localStorage cache first, then server
  useEffect(() => {
    const load = async () => {
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          setSettings(JSON.parse(cached));
        }
        const res = await fetch(`${API_BASE}/api/settings`);
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const updateSettings = useCallback(async (updates) => {
    try {
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to update settings:', err);
      return false;
    }
  }, []);

  const testAiConnection = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings/test-ai`, { method: 'POST' });
      return await res.json();
    } catch (err) {
      return { error: err.message };
    }
  }, []);

  const isAiConfigured = settings?._isAiConfigured === true;

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings, testAiConnection, isAiConfigured }}>
      {children}
    </SettingsContext.Provider>
  );
}
