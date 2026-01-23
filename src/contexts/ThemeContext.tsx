import React, { createContext, useContext, useState, useEffect } from 'react';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  isDarkMode: boolean;
  themeMode: ThemeMode;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'tw-eval-theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    // Check localStorage first
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
    // Fall back to system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  const isDarkMode = themeMode === 'dark';

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  };

  const toggleTheme = () => {
    setThemeMode(isDarkMode ? 'light' : 'dark');
  };

  // Apply theme to document
  React.useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      // Only auto-switch if user hasn't explicitly set a preference
      if (!localStorage.getItem(STORAGE_KEY)) {
        setThemeModeState(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <ThemeContext.Provider
      value={{ isDarkMode, themeMode, toggleTheme, setThemeMode }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
