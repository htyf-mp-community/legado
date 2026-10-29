import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, useColorScheme } from 'react-native';
import {
  DarkTheme,
  DefaultTheme,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import {
  loadAppPreferences,
  saveAppPreferences,
  type AppPreferences,
} from '../data/appPreferences';
import { translator } from '../i18n';
import { resolveAppColors } from './appColors';
export type AppColors = {
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  danger: string;
  accent: string;
  toolbarBackground: string;
  toolbarText: string;
};
type Value = {
  preferences: AppPreferences;
  setPreferences: (value: AppPreferences) => void;
  dark: boolean;
  backgroundImage: string;
  colors: AppColors;
  navigationTheme: NavigationTheme;
  t: ReturnType<typeof translator>;
};
const Context = createContext<Value | undefined>(undefined);
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme(),
    [preferences, setState] = useState(loadAppPreferences),
    setPreferences = (value: AppPreferences) => {
      setState(saveAppPreferences(value));
      Appearance.setColorScheme(
        (value.themeMode === 'system'
          ? null
          : value.themeMode === 'eink'
            ? 'light'
            : value.themeMode) as Parameters<
          typeof Appearance.setColorScheme
        >[0],
      );
    },
    value = useMemo<Value>(() => {
      const isDark =
          preferences.themeMode === 'dark' ||
          (preferences.themeMode === 'system' && system === 'dark'),
        backgroundImage =
          preferences.themeMode === 'eink'
            ? ''
            : isDark
              ? preferences.nightBackgroundImage ||
                preferences.dayBackgroundImage
              : preferences.dayBackgroundImage,
        themed = {
          ...resolveAppColors(preferences, isDark),
          ...(backgroundImage ? { background: 'transparent' } : {}),
        },
        colors: AppColors =
          preferences.highContrast && preferences.themeMode !== 'eink'
            ? {
                ...themed,
                muted: isDark ? '#d9ddd9' : '#3d413e',
                border: isDark ? '#697069' : '#999f99',
              }
            : themed,
        navigationBase = isDark ? DarkTheme : DefaultTheme;
      return {
        preferences,
        setPreferences,
        dark: isDark,
        backgroundImage,
        colors,
        t: translator(preferences.language),
        navigationTheme: {
          ...navigationBase,
          colors: {
            ...navigationBase.colors,
            primary: colors.primary,
            background: colors.background,
            card: colors.surface,
            text: colors.text,
            border: colors.border,
            notification: colors.danger,
          },
        },
      };
    }, [preferences, system]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAppTheme() {
  const value = useContext(Context);
  if (!value)
    throw new Error('useAppTheme must be used inside AppThemeProvider');
  return value;
}
