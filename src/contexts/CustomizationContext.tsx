
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface HSLColor {
  h: number;
  s: number;
  l: number;
}

interface CustomizationSettings {
  themeBackground: HSLColor;
  themeForeground: HSLColor;
  themePrimary: HSLColor;
  themeAccent: HSLColor;
  gridColor: string; // hex
  gridOpacity: number; // 0-1
}

const DEFAULT_SETTINGS: CustomizationSettings = {
  themeBackground: { h: 0, s: 0, l: 13 },    // Matches --background: 0 0% 13%;
  themeForeground: { h: 0, s: 0, l: 90 },    // Matches --foreground: 0 0% 90%;
  themePrimary: { h: 220, s: 43, l: 41 },  // Matches --primary: 220 43% 41%;
  themeAccent: { h: 271, s: 76, l: 53 },   // Matches --accent: 271 76% 53%;
  gridColor: '#8A2BE2', // Default purple from original grid visual
  gridOpacity: 0.3,     // Default opacity from original grid visual
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
        // Merge with defaults to ensure all keys are present
        const mergedSettings = { ...DEFAULT_SETTINGS, ...parsed };
         // Validate crucial nested objects
        if (
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
      rootStyle.setProperty('--background', hslToCssVarString(settings.themeBackground));
      rootStyle.setProperty('--foreground', hslToCssVarString(settings.themeForeground));
      
      rootStyle.setProperty('--card', `${settings.themeBackground.h} ${settings.themeBackground.s}% ${Math.max(0, settings.themeBackground.l + (settings.themeBackground.l < 50 ? 3 : -3))}%`);
      rootStyle.setProperty('--card-foreground', hslToCssVarString(settings.themeForeground));
      
      rootStyle.setProperty('--popover', `${settings.themeBackground.h} ${settings.themeBackground.s}% ${Math.max(0, settings.themeBackground.l + (settings.themeBackground.l < 50 ? 5 : -5))}%`);
      rootStyle.setProperty('--popover-foreground', hslToCssVarString(settings.themeForeground));

      rootStyle.setProperty('--primary', hslToCssVarString(settings.themePrimary));
      // primary-foreground is often white/black based on primary's L value. For simplicity, keeping it static or derived simply.
      rootStyle.setProperty('--primary-foreground', settings.themePrimary.l > 50 ? '0 0% 5%' : '0 0% 98%');


      rootStyle.setProperty('--secondary', `${settings.themePrimary.h} ${Math.max(0, settings.themePrimary.s - 20)}% ${settings.themePrimary.l > 50 ? Math.max(0, settings.themePrimary.l - 10) : Math.min(100, settings.themePrimary.l + 10)}%`);
      rootStyle.setProperty('--secondary-foreground', settings.themePrimary.l > 50 ? '0 0% 5%' : '0 0% 98%');
      
      rootStyle.setProperty('--muted', `${settings.themeForeground.h} ${settings.themeForeground.s}% ${settings.themeForeground.l > 50 ? Math.max(0, settings.themeForeground.l - 10) : Math.min(100, settings.themeForeground.l + 10)}%`);
      rootStyle.setProperty('--muted-foreground', `${settings.themeForeground.h} ${settings.themeForeground.s}% ${settings.themeForeground.l > 50 ? Math.max(0, settings.themeForeground.l - 30) : Math.min(100, settings.themeForeground.l + 30)}%`);

      rootStyle.setProperty('--accent', hslToCssVarString(settings.themeAccent));
      rootStyle.setProperty('--accent-foreground', settings.themeAccent.l > 50 ? '0 0% 5%' : '0 0% 98%');

      // Destructive, border, input, ring typically have fixed hues or derive subtly.
      // For simplicity, these are not made fully dynamic from base colors but could be.
      // Example for border based on background lightness:
      rootStyle.setProperty('--border', `${settings.themeBackground.h} ${settings.themeBackground.s}% ${settings.themeBackground.l > 50 ? Math.max(0, settings.themeBackground.l - 10) : Math.min(100, settings.themeBackground.l + 10)}%`);
      rootStyle.setProperty('--input', `${settings.themeBackground.h} ${settings.themeBackground.s}% ${settings.themeBackground.l > 50 ? Math.max(0, settings.themeBackground.l - 10) : Math.min(100, settings.themeBackground.l + 10)}%`);
      rootStyle.setProperty('--ring', hslToCssVarString(settings.themeAccent));


      // Update sidebar-specific variables to follow the main theme
      const sidebarBgL = settings.themeBackground.l > 10 ? Math.max(0, settings.themeBackground.l - 5) : Math.min(100, settings.themeBackground.l + 2); // slightly darker/lighter than main bg
      rootStyle.setProperty('--sidebar-background', `${settings.themeBackground.h} ${settings.themeBackground.s}% ${sidebarBgL}%`);
      rootStyle.setProperty('--sidebar-foreground', hslToCssVarString(settings.themeForeground));
      rootStyle.setProperty('--sidebar-primary', hslToCssVarString(settings.themePrimary));
      rootStyle.setProperty('--sidebar-primary-foreground', settings.themePrimary.l > 50 ? '0 0% 5%' : '0 0% 98%');
      const sidebarAccentL = settings.themeAccent.l > 50 ? Math.max(0, settings.themeAccent.l - 10) : Math.min(100, settings.themeAccent.l + 10); // slightly muted accent
      rootStyle.setProperty('--sidebar-accent', `${settings.themeAccent.h} ${settings.themeAccent.s}% ${sidebarAccentL}%`);
      rootStyle.setProperty('--sidebar-accent-foreground', sidebarAccentL > 50 ? '0 0% 5%' : '0 0% 98%');
      rootStyle.setProperty('--sidebar-border', `${sidebarBgL} ${settings.themeBackground.s}% ${sidebarBgL > 50 ? Math.max(0, sidebarBgL - 5) : Math.min(100, sidebarBgL + 5)}%`);

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
      if (component === 'h') newComponentValue = (value % 360 + 360) % 360; // Ensure H is 0-359
      else newComponentValue = Math.max(0, Math.min(100, value)); // Ensure S, L are 0-100

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

