import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

export type ThemeMode = 'dark' | 'light';

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

const STORAGE_KEY = 'malawiModels.theme';
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const isThemeMode = (value: string | null): value is ThemeMode => (
  value === 'dark' || value === 'light'
);

const getStoredTheme = (userId?: string): ThemeMode => {
  if (typeof window === 'undefined') return 'dark';

  const userTheme = userId ? window.localStorage.getItem(`${STORAGE_KEY}.${userId}`) : null;
  if (isThemeMode(userTheme)) return userTheme;

  const globalTheme = window.localStorage.getItem(STORAGE_KEY);
  return isThemeMode(globalTheme) ? globalTheme : 'dark';
};

const applyTheme = (theme: ThemeMode) => {
  if (typeof document === 'undefined') return;

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  const themeColor = theme === 'light' ? '#f8fafc' : '#09090b';
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', themeColor);
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<ThemeMode>(() => getStoredTheme());

  useEffect(() => {
    const nextTheme = getStoredTheme(user?.uid);
    setThemeState(nextTheme);
    applyTheme(nextTheme);
  }, [user?.uid]);

  const setTheme = (nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
    applyTheme(nextTheme);

    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    if (user?.uid) {
      window.localStorage.setItem(`${STORAGE_KEY}.${user.uid}`, nextTheme);
    }
  };

  const value = useMemo(() => ({ theme, setTheme }), [theme, user?.uid]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
