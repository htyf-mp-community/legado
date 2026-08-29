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
export type AppColors = {
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  danger: string;
};
const light: AppColors = {
    background: '#f4f4f1',
    surface: '#ffffff',
    text: '#171717',
    muted: '#6f746f',
    border: '#d8dcd8',
    primary: '#285d42',
    danger: '#a13b3b',
  },
  darkColors: AppColors = {
    background: '#101311',
    surface: '#191d1a',
    text: '#f2f4f2',
    muted: '#a8aea9',
    border: '#373d38',
    primary: '#79c99b',
    danger: '#ff8e8e',
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
        (value.themeMode === 'system' ? null : value.themeMode) as Parameters<
          typeof Appearance.setColorScheme
        >[0],
      );
    },
    value = useMemo<Value>(() => {
      const isDark =
          preferences.themeMode === 'dark' ||
          (preferences.themeMode === 'system' && system === 'dark'),
        backgroundImage = isDark
          ? preferences.nightBackgroundImage || preferences.dayBackgroundImage
          : preferences.dayBackgroundImage,
        base = isDark ? darkColors : light,
        custom = isDark
          ? {
              primary: preferences.nightPrimary,
              danger: preferences.nightAccent,
              background: preferences.nightBackground,
              surface: preferences.nightBottomBackground,
            }
          : {
              primary: preferences.dayPrimary,
              danger: preferences.dayAccent,
              background: preferences.dayBackground,
              surface: preferences.dayBottomBackground,
            },
        themed = {
          ...base,
          ...custom,
          ...(backgroundImage ? { background: 'transparent' } : {}),
        },
        colors: AppColors = preferences.highContrast
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
