import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme, ThemeMode } from './ThemeContext';

const options: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4" /> },
  { value: 'light', label: 'Light', icon: <Sun className="w-4 h-4" /> },
];

const AppearanceSettings: React.FC = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white">Appearance</h3>
          <p className="text-xs text-brand-muted mt-1">Choose dark or light mode for every page.</p>
        </div>
        <div className="inline-flex rounded-lg bg-white/5 border border-white/10 p-1 w-full sm:w-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              className={`flex flex-1 sm:flex-none items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-colors ${
                theme === option.value
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-brand-muted hover:text-white hover:bg-white/5'
              }`}
              aria-pressed={theme === option.value}
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AppearanceSettings;
