
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface HSLColor {
  h: number;
  s: number;
  l: number;
}

interface CustomizationSettings {
  themeMode: 'light' | 'dark';
  themeBackground: HSLColor;
  themeForeground: HSLColor;
  themePrimary: HSLColor;
  themeAccent: HSLColor;
  gridColor: string; // hex
  gridOpacity: number; // 0-1
}

const DEFAULT_SETTINGS: CustomizationSettings = {
  themeMode: 'dark',
  themeBackground: { h: 0, s: 0, l: 13 },    // Matches --background: 0 0% 13%;
  themeForeground: { h: 0, s: 0, l: 90 },    // Matches --foreground: 0 0% 90%;
  themePrimary: { h: 220, s: 43, l: 41 },  // Matches --primary: 220 43% 41%;
  themeAccent: { h: 271, s: 76, l: 53 },   // Matches --accent: 271 76% 53%;
  gridColor: '#8A2BE2',
  gridOpacity: 0.3,
};

interface CustomizationContextType {
  settings: CustomizationSettings;
  updateSetting: <K extends keyof CustomizationSettings>(key: K, value: CustomizationSettings[K]) => void;
  updateThemeColorValue: (colorName: 'themeBackground' | 'themeForeground' | 'themePrimary' | 'themeAccent', component: 'h' | 's' | 'l', value: number) => void;
  resetSettings: () => void;
}

const CustomizationContext = createContext<CustomizationContextType | undefined>(undefined);

export const useCustomization = () => {
  const context = useContext(CustomizationContext);
  if (!context) {
    throw new Error('useCustomization must be used within a CustomizationProvider');
  }
  return context;
};

const hslToCssVarString = (hsl: HSLColor) => `${hsl.h} ${hsl.s}% ${hsl.l}%`;

export const CustomizationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<CustomizationSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const storedSettings = localStorage.getItem('spacetimeExplorerCustomization');
    if (storedSettings) {
      try {
        const parsed = JSON.parse(storedSettings) as Partial<CustomizationSettings>;
        const mergedSettings = { ...DEFAULT_SETTINGS, ...parsed };
        if (
          typeof mergedSettings.themeMode === 'string' &&
          typeof mergedSettings.themeBackground?.h === 'number' &&
          typeof mergedSettings.themeForeground?.h === 'number' &&
          typeof mergedSettings.themePrimary?.h === 'number' &&
          typeof mergedSettings.themeAccent?.h === 'number' &&
          typeof mergedSettings.gridColor === 'string' &&
          typeof mergedSettings.gridOpacity === 'number'
        ) {
          setSettings(mergedSettings);
        } else {
          console.warn("Stored customization settings were malformed. Resetting to defaults.");
          localStorage.removeItem('spacetimeExplorerCustomization');
          setSettings(DEFAULT_SETTINGS);
        }
      } catch (error) {
        console.error("Failed to parse stored settings, using defaults:", error);
        localStorage.removeItem('spacetimeExplorerCustomization');
        setSettings(DEFAULT_SETTINGS);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('spacetimeExplorerCustomization', JSON.stringify(settings));

      const rootStyle = document.documentElement.style;
      
      // Determine effective HSL values based on themeMode
      let effectiveBackground: HSLColor, effectiveForeground: HSLColor, effectivePrimary: HSLColor, effectiveAccent: HSLColor;

      if (settings.themeMode === 'light') {
        effectiveBackground = { h: settings.themeBackground.h, s: settings.themeBackground.s, l: 92 };
        effectiveForeground = { h: settings.themeForeground.h, s: settings.themeForeground.s, l: 10 };
        // Adjust primary/accent for light mode: make them reasonably visible, not too pale or too dark.
        effectivePrimary = { h: settings.themePrimary.h, s: settings.themePrimary.s, l: Math.min(65, Math.max(40, settings.themePrimary.l)) };
        effectiveAccent = { h: settings.themeAccent.h, s: settings.themeAccent.s, l: Math.min(70, Math.max(45, settings.themeAccent.l)) };
      } else { // Dark mode
        effectiveBackground = settings.themeBackground;
        effectiveForeground = settings.themeForeground;
        effectivePrimary = settings.themePrimary;
        effectiveAccent = settings.themeAccent;
      }

      rootStyle.setProperty('--background', hslToCssVarString(effectiveBackground));
      rootStyle.setProperty('--foreground', hslToCssVarString(effectiveForeground));
      
      // Card uses background L value, shifted slightly
      const cardL = effectiveBackground.l + (effectiveBackground.l < 50 ? 3 : -3);
      rootStyle.setProperty('--card', `${effectiveBackground.h} ${effectiveBackground.s}% ${Math.max(0, Math.min(100,cardL))}%`);
      rootStyle.setProperty('--card-foreground', hslToCssVarString(effectiveForeground));
      
      // Popover also uses background L value, shifted slightly more or differently
      const popoverL = effectiveBackground.l + (effectiveBackground.l < 50 ? -3 : 3); // Example: darker for dark bg, lighter for light bg
      rootStyle.setProperty('--popover', `${effectiveBackground.h} ${effectiveBackground.s}% ${Math.max(0, Math.min(100,popoverL))}%`);
      rootStyle.setProperty('--popover-foreground', hslToCssVarString(effectiveForeground));

      rootStyle.setProperty('--primary', hslToCssVarString(effectivePrimary));
      rootStyle.setProperty('--primary-foreground', effectivePrimary.l > 50 ? '0 0% 5%' : '0 0% 98%');

      const secondaryL = effectivePrimary.l > 50 ? Math.max(0, effectivePrimary.l - 10) : Math.min(100, effectivePrimary.l + 10);
      rootStyle.setProperty('--secondary', `${effectivePrimary.h} ${Math.max(0, effectivePrimary.s - 20)}% ${secondaryL}%`);
      rootStyle.setProperty('--secondary-foreground', secondaryL > 50 ? '0 0% 5%' : '0 0% 98%');
      
      const mutedL = effectiveForeground.l > 50 ? Math.max(0, effectiveForeground.l - 10) : Math.min(100, effectiveForeground.l + 10);
      rootStyle.setProperty('--muted', `${effectiveForeground.h} ${effectiveForeground.s}% ${mutedL}%`);
      const mutedFgL = effectiveForeground.l > 50 ? Math.max(0, effectiveForeground.l - 30) : Math.min(100, effectiveForeground.l + 30);
      rootStyle.setProperty('--muted-foreground', `${effectiveForeground.h} ${effectiveForeground.s}% ${mutedFgL}%`);

      rootStyle.setProperty('--accent', hslToCssVarString(effectiveAccent));
      rootStyle.setProperty('--accent-foreground', effectiveAccent.l > 50 ? '0 0% 5%' : '0 0% 98%');

      const borderL = effectiveBackground.l > 50 ? Math.max(0, effectiveBackground.l - 10) : Math.min(100, effectiveBackground.l + 10);
      rootStyle.setProperty('--border', `${effectiveBackground.h} ${effectiveBackground.s}% ${borderL}%`);
      rootStyle.setProperty('--input', `${effectiveBackground.h} ${effectiveBackground.s}% ${borderL}%`);
      rootStyle.setProperty('--ring', hslToCssVarString(effectiveAccent)); // Ring usually matches accent

      // Update sidebar-specific variables to follow the main theme
      const sidebarBgL = effectiveBackground.l > 10 ? Math.max(0, effectiveBackground.l - (settings.themeMode === 'light' ? -2 : 5) ) : Math.min(100, effectiveBackground.l + (settings.themeMode === 'light' ? 2 : 2));
      rootStyle.setProperty('--sidebar-background', `${effectiveBackground.h} ${effectiveBackground.s}% ${sidebarBgL}%`);
      rootStyle.setProperty('--sidebar-foreground', hslToCssVarString(effectiveForeground));
      rootStyle.setProperty('--sidebar-primary', hslToCssVarString(effectivePrimary));
      rootStyle.setProperty('--sidebar-primary-foreground', effectivePrimary.l > 50 ? '0 0% 5%' : '0 0% 98%');
      
      const sidebarAccentL = effectiveAccent.l > 50 ? Math.max(0, effectiveAccent.l - (settings.themeMode === 'light' ? 5 : 10)) : Math.min(100, effectiveAccent.l + (settings.themeMode === 'light' ? 5 : 10));
      rootStyle.setProperty('--sidebar-accent', `${effectiveAccent.h} ${effectiveAccent.s}% ${sidebarAccentL}%`);
      rootStyle.setProperty('--sidebar-accent-foreground', sidebarAccentL > 50 ? '0 0% 5%' : '0 0% 98%');
      
      const sidebarBorderL = sidebarBgL > 50 ? Math.max(0, sidebarBgL - 5) : Math.min(100, sidebarBgL + 5);
      rootStyle.setProperty('--sidebar-border', `${effectiveBackground.h} ${effectiveBackground.s}% ${sidebarBorderL}%`);

    }
  }, [settings, isLoaded]);

  const updateSetting = useCallback(<K extends keyof CustomizationSettings>(key: K, value: CustomizationSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateThemeColorValue = useCallback((
    colorName: 'themeBackground' | 'themeForeground' | 'themePrimary' | 'themeAccent',
    component: 'h' | 's' | 'l',
    value: number
  ) => {
    setSettings(prev => {
      const currentHsl = prev[colorName];
      let newComponentValue = value;
      if (component === 'h') newComponentValue = (value % 360 + 360) % 360;
      else newComponentValue = Math.max(0, Math.min(100, value));

      return {
        ...prev,
        [colorName]: {
          ...currentHsl,
          [component]: newComponentValue,
        },
      };
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  if (!isLoaded) {
    return null; 
  }

  return (
    <CustomizationContext.Provider value={{ settings, updateSetting, updateThemeColorValue, resetSettings }}>
      {children}
    </CustomizationContext.Provider>
  );
};
