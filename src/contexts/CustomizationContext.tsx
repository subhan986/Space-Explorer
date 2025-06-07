
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export interface HSLColor {
  h: number;
  s: number;
  l: number;
}

const FONT_MAP: Record<string, string> = {
  'geist': 'var(--font-geist-sans)',
  'inter': 'var(--font-inter)',
  'robotoSlab': 'var(--font-roboto-slab)',
};
const DEFAULT_FONT_KEY = 'geist';

interface CustomizationSettings {
  themeMode: 'light' | 'dark';
  themeBackground: HSLColor;
  themeForeground: HSLColor;
  themePrimary: HSLColor;
  themeAccent: HSLColor;
  gridColor: string; // hex
  gridOpacity: number; // 0-1
  uiScale: number; // percentage, e.g., 100
  showObjectLabels3D: boolean;
  fontFamilyKey: string; // e.g., 'geist', 'inter', 'robotoSlab'
}

const DEFAULT_SETTINGS: CustomizationSettings = {
  themeMode: 'dark',
  themeBackground: { h: 0, s: 0, l: 13 },
  themeForeground: { h: 0, s: 0, l: 90 },
  themePrimary: { h: 220, s: 43, l: 41 },
  themeAccent: { h: 271, s: 76, l: 53 },
  gridColor: '#8A2BE2',
  gridOpacity: 0.3,
  uiScale: 100,
  showObjectLabels3D: true,
  fontFamilyKey: DEFAULT_FONT_KEY,
};

interface CustomizationContextType {
  settings: CustomizationSettings;
  updateSetting: <K extends keyof CustomizationSettings>(key: K, value: CustomizationSettings[K]) => void;
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

export const CustomizationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<CustomizationSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const storedSettings = localStorage.getItem('spacetimeExplorerCustomization');
    if (storedSettings) {
      try {
        const parsed = JSON.parse(storedSettings) as Partial<CustomizationSettings>;
        const mergedSettings = { ...DEFAULT_SETTINGS, ...parsed };
        // Basic validation for critical fields
        if (
          typeof mergedSettings.themeMode === 'string' &&
          typeof mergedSettings.themeBackground?.h === 'number' &&
          typeof mergedSettings.themeForeground?.h === 'number' &&
          typeof mergedSettings.themePrimary?.h === 'number' &&
          typeof mergedSettings.themeAccent?.h === 'number' &&
          typeof mergedSettings.gridColor === 'string' &&
          typeof mergedSettings.gridOpacity === 'number' &&
          typeof mergedSettings.uiScale === 'number' &&
          typeof mergedSettings.showObjectLabels3D === 'boolean' &&
          typeof mergedSettings.fontFamilyKey === 'string' // Added font family key validation
        ) {
          setSettings(mergedSettings);
        } else {
          console.warn("Stored customization settings were malformed or incomplete. Resetting to defaults.");
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
      const bodyStyle = document.body.style;
      
      document.documentElement.style.fontSize = `${settings.uiScale}%`;
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(settings.themeMode);

      // Apply font family
      bodyStyle.fontFamily = FONT_MAP[settings.fontFamilyKey] || FONT_MAP[DEFAULT_FONT_KEY];


      let effectiveBackgroundH = settings.themeBackground.h;
      let effectiveBackgroundS = settings.themeBackground.s;
      let effectiveBackgroundL: number;
      let effectiveForegroundH = settings.themeForeground.h;
      let effectiveForegroundS = settings.themeForeground.s;
      let effectiveForegroundL: number;
      
      let effectivePrimaryH = settings.themePrimary.h;
      let effectivePrimaryS = settings.themePrimary.s;
      let effectivePrimaryL = settings.themePrimary.l;
      
      let effectiveAccentH = settings.themeAccent.h;
      let effectiveAccentS = settings.themeAccent.s;
      let effectiveAccentL = settings.themeAccent.l;

      if (settings.themeMode === 'light') {
        effectiveBackgroundL = settings.themeBackground.l > 50 ? settings.themeBackground.l : Math.max(90, 100 - settings.themeBackground.l);
        effectiveForegroundL = settings.themeForeground.l < 50 ? settings.themeForeground.l : Math.min(15, 100 - settings.themeForeground.l);
        
        effectivePrimaryL = Math.min(65, Math.max(35, settings.themePrimary.l));
        effectiveAccentL = Math.min(70, Math.max(40, settings.themeAccent.l));

      } else { // Dark mode
        effectiveBackgroundL = settings.themeBackground.l < 50 ? settings.themeBackground.l : Math.min(20, 100 - settings.themeBackground.l);
        effectiveForegroundL = settings.themeForeground.l > 50 ? settings.themeForeground.l : Math.max(80, 100 - settings.themeForeground.l);

        effectivePrimaryL = settings.themePrimary.l;
        effectiveAccentL = settings.themeAccent.l;
      }

      rootStyle.setProperty('--background', `${effectiveBackgroundH} ${effectiveBackgroundS}% ${effectiveBackgroundL}%`);
      rootStyle.setProperty('--foreground', `${effectiveForegroundH} ${effectiveForegroundS}% ${effectiveForegroundL}%`);
      
      const cardL = effectiveBackgroundL + (settings.themeMode === 'light' ? -3 : 3);
      rootStyle.setProperty('--card', `${effectiveBackgroundH} ${effectiveBackgroundS}% ${Math.max(0, Math.min(100,cardL))}%`);
      rootStyle.setProperty('--card-foreground', `${effectiveForegroundH} ${effectiveForegroundS}% ${effectiveForegroundL}%`);
      
      const popoverL = effectiveBackgroundL + (settings.themeMode === 'light' ? -5 : 5);
      rootStyle.setProperty('--popover', `${effectiveBackgroundH} ${effectiveBackgroundS}% ${Math.max(0, Math.min(100,popoverL))}%`);
      rootStyle.setProperty('--popover-foreground', `${effectiveForegroundH} ${effectiveForegroundS}% ${effectiveForegroundL}%`);

      rootStyle.setProperty('--primary', `${effectivePrimaryH} ${effectivePrimaryS}% ${effectivePrimaryL}%`);
      rootStyle.setProperty('--primary-foreground', effectivePrimaryL > 55 ? '0 0% 5%' : '0 0% 98%');

      const secondaryLOffset = settings.themeMode === 'light' ? -10 : 10;
      const secondaryL = Math.max(0, Math.min(100, effectivePrimaryL + secondaryLOffset));
      rootStyle.setProperty('--secondary', `${effectivePrimaryH} ${Math.max(0, effectivePrimaryS - 15)}% ${secondaryL}%`);
      rootStyle.setProperty('--secondary-foreground', secondaryL > 55 ? '0 0% 5%' : '0 0% 98%');
      
      const mutedLOffset = settings.themeMode === 'light' ? 5 : -5; 
      const mutedL = Math.max(0, Math.min(100, effectiveBackgroundL + mutedLOffset));
      rootStyle.setProperty('--muted', `${effectiveBackgroundH} ${effectiveBackgroundS}% ${mutedL}%`);
      const mutedFgLOffset = settings.themeMode === 'light' ? 30 : -30; 
      const mutedFgL = Math.max(0, Math.min(100, effectiveForegroundL + mutedFgLOffset));
      rootStyle.setProperty('--muted-foreground', `${effectiveForegroundH} ${effectiveForegroundS}% ${mutedFgL}%`);

      rootStyle.setProperty('--accent', `${effectiveAccentH} ${effectiveAccentS}% ${effectiveAccentL}%`);
      rootStyle.setProperty('--accent-foreground', effectiveAccentL > 55 ? '0 0% 5%' : '0 0% 98%');

      const borderLOffset = settings.themeMode === 'light' ? -10 : 10;
      const borderL = Math.max(0, Math.min(100, effectiveBackgroundL + borderLOffset));
      rootStyle.setProperty('--border', `${effectiveBackgroundH} ${effectiveBackgroundS}% ${borderL}%`);
      rootStyle.setProperty('--input', `${effectiveBackgroundH} ${effectiveBackgroundS}% ${borderL}%`);
      rootStyle.setProperty('--ring', `${effectiveAccentH} ${effectiveAccentS}% ${Math.min(100, effectiveAccentL + (settings.themeMode === 'light' ? -10 : 10))}%`);


      // Sidebar specific variables
      const sidebarBgLOffset = settings.themeMode === 'light' ? 2 : -2; 
      const sidebarBgL = Math.max(0, Math.min(100, effectiveBackgroundL + sidebarBgLOffset));
      rootStyle.setProperty('--sidebar-background', `${effectiveBackgroundH} ${effectiveBackgroundS}% ${sidebarBgL}%`);
      rootStyle.setProperty('--sidebar-foreground', `${effectiveForegroundH} ${effectiveForegroundS}% ${effectiveForegroundL}%`);
      
      rootStyle.setProperty('--sidebar-primary', `${effectivePrimaryH} ${effectivePrimaryS}% ${effectivePrimaryL}%`);
      rootStyle.setProperty('--sidebar-primary-foreground', effectivePrimaryL > 55 ? '0 0% 5%' : '0 0% 98%');
      
      const sidebarAccentLOffset = settings.themeMode === 'light' ? -5 : 5; 
      const sidebarAccentL = Math.max(0, Math.min(100, effectiveAccentL + sidebarAccentLOffset));
      rootStyle.setProperty('--sidebar-accent', `${effectiveAccentH} ${effectiveAccentS}% ${sidebarAccentL}%`);
      rootStyle.setProperty('--sidebar-accent-foreground', sidebarAccentL > 55 ? '0 0% 5%' : '0 0% 98%');
      
      const sidebarBorderLOffset = settings.themeMode === 'light' ? -5 : 5;
      const sidebarBorderL = Math.max(0, Math.min(100, sidebarBgL + sidebarBorderLOffset));
      rootStyle.setProperty('--sidebar-border', `${effectiveBackgroundH} ${effectiveBackgroundS}% ${sidebarBorderL}%`);
      rootStyle.setProperty('--sidebar-ring', `${effectiveAccentH} ${effectiveAccentS}% ${Math.min(100, effectiveAccentL + (settings.themeMode === 'light' ? -10 : 10))}%`);
      rootStyle.setProperty('--sidebar-muted-foreground', `${effectiveForegroundH} ${effectiveForegroundS}% ${Math.max(0, Math.min(100, effectiveForegroundL + mutedFgLOffset))}%`);

    }
  }, [settings, isLoaded]);

  const updateSetting = useCallback(<K extends keyof CustomizationSettings>(key: K, value: CustomizationSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    // Directly apply font size default as body style might not update immediately from state
    document.documentElement.style.fontSize = `${DEFAULT_SETTINGS.uiScale}%`;
    document.body.style.fontFamily = FONT_MAP[DEFAULT_SETTINGS.fontFamilyKey];
  }, []);

  if (!isLoaded) {
    // Optionally, return a loading indicator or null to prevent flash of unstyled content
    // For this prototype, null is fine as it's client-side quick.
    return null; 
  }

  return (
    <CustomizationContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </CustomizationContext.Provider>
  );
};
