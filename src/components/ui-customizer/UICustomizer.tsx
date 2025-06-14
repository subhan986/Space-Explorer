
// src/components/ui-customizer/UICustomizer.tsx
'use client';

import { SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCustomization, HSLColor } from "@/contexts/CustomizationContext";
import React from "react";
import { Check, RotateCcw } from "lucide-react";

const GRID_COLOR_PALETTE = [
  '#8A2BE2', // Violet (Original Default)
  '#FFFFFF', // White
  '#A9A9A9', // DarkGray
  '#505050', // Medium Gray
  '#1E90FF', // DodgerBlue
  '#32CD32', // LimeGreen
  '#FF4500', // OrangeRed
  '#FFD700', // Gold
];

interface PaletteOption {
  name: string;
  hsl: HSLColor;
}

const themeBackgroundPalettes: PaletteOption[] = [
  { name: 'Graphite', hsl: { h: 0, s: 0, l: 13 } },
  { name: 'Space Blue', hsl: { h: 220, s: 25, l: 15 } },
  { name: 'Deep Ocean', hsl: { h: 210, s: 30, l: 10 } },
  { name: 'Charcoal', hsl: { h: 0, s: 0, l: 20 } },
  { name: 'Midnight Green', hsl: { h: 180, s: 15, l: 12 } },
  { name: 'Dark Purple', hsl: { h: 270, s: 20, l: 18 } },

  { name: 'Snow', hsl: { h: 0, s: 0, l: 97 } },
  { name: 'Paper', hsl: { h: 40, s: 30, l: 95 } },
  { name: 'Ivory', hsl: { h: 50, s: 20, l: 96 } },
  { name: 'Light Steel', hsl: { h: 220, s: 10, l: 94 } },
  { name: 'Mint Cream', hsl: { h: 150, s: 40, l: 95 } },
  { name: 'Lavender Mist', hsl: { h: 250, s: 30, l: 96 } },
];

const themeForegroundPalettes: PaletteOption[] = [
  { name: 'Light Gray', hsl: { h: 0, s: 0, l: 90 } },
  { name: 'Off-White', hsl: { h: 30, s: 20, l: 85 } },
  { name: 'Silver Text', hsl: { h: 0, s: 0, l: 75 } },
  { name: 'Cream', hsl: { h: 45, s: 50, l: 92 } },
  { name: 'Ghost White', hsl: { h: 240, s: 60, l: 95 } },
  { name: 'Pale Aqua', hsl: { h: 180, s: 40, l: 88 } },

  { name: 'Dark Slate', hsl: { h: 0, s: 0, l: 10 } },
  { name: 'Charcoal Text', hsl: { h: 210, s: 10, l: 20 } },
  { name: 'Near Black', hsl: { h: 0, s: 0, l: 5 } },
  { name: 'Steel Blue Text', hsl: { h: 215, s: 20, l: 30 } },
  { name: 'Dark Brown', hsl: { h: 25, s: 30, l: 15 } },
  { name: 'Deep Navy', hsl: { h: 240, s: 40, l: 25 } },
];

const themePrimaryPalettes: PaletteOption[] = [
  { name: 'Deep Space Blue', hsl: { h: 220, s: 43, l: 41 } },
  { name: 'Forest Green', hsl: { h: 140, s: 40, l: 35 } },
  { name: 'Crimson Red', hsl: { h: 0, s: 50, l: 45 } },
  { name: 'Royal Purple', hsl: { h: 270, s: 50, l: 50 } },
  { name: 'Ocean Teal', hsl: { h: 175, s: 55, l: 40 } },
  { name: 'Goldenrod', hsl: { h: 45, s: 70, l: 50 } },
  { name: 'Indigo', hsl: { h: 240, s: 60, l: 55 } },
  { name: 'Olive Green', hsl: { h: 80, s: 30, l: 40 } },
  { name: 'Maroon', hsl: { h: 0, s: 35, l: 30 } },
  { name: 'Sapphire Blue', hsl: { h: 210, s: 60, l: 50 } },
];

const themeAccentPalettes: PaletteOption[] = [
  { name: 'Violet', hsl: { h: 271, s: 76, l: 53 } },
  { name: 'Teal Burst', hsl: { h: 180, s: 60, l: 45 } },
  { name: 'Sunset Orange', hsl: { h: 30, s: 80, l: 55 } },
  { name: 'Hot Pink', hsl: { h: 330, s: 70, l: 60 } },
  { name: 'Lime Green', hsl: { h: 90, s: 65, l: 50 } },
  { name: 'Sky Blue', hsl: { h: 200, s: 70, l: 60 } },
  { name: 'Ruby Red', hsl: { h: 350, s: 75, l: 50 } },
  { name: 'Amber', hsl: { h: 40, s: 85, l: 58 } },
  { name: 'Electric Blue', hsl: { h: 230, s: 80, l: 60 } },
  { name: 'Emerald Green', hsl: { h: 150, s: 70, l: 40 } },
];

const FONT_OPTIONS = [
  { value: 'geist', label: 'Geist Sans (Default)' },
  { value: 'inter', label: 'Inter' },
  { value: 'robotoSlab', label: 'Roboto Slab (Serif)' },
];


interface ThemePaletteSelectorProps {
  label: string;
  colorKey: 'themeBackground' | 'themeForeground' | 'themePrimary' | 'themeAccent';
  palette: PaletteOption[];
}

const ThemePaletteSelector: React.FC<ThemePaletteSelectorProps> = ({ label, colorKey, palette }) => {
  const { settings, updateSetting } = useCustomization();
  const selectedHsl = settings[colorKey];

  const getEffectiveDisplayL = (baseHsl: HSLColor): number => {
    let displayL = baseHsl.l;
     if (settings.themeMode === 'light') {
        if (colorKey === 'themeBackground') displayL = baseHsl.l > 50 ? baseHsl.l : Math.max(90, 100 - baseHsl.l);
        else if (colorKey === 'themeForeground') displayL = baseHsl.l < 50 ? baseHsl.l : Math.min(15, 100 - baseHsl.l);
        else if (colorKey === 'themePrimary') displayL = Math.min(65, Math.max(35, baseHsl.l));
        else if (colorKey === 'themeAccent') displayL = Math.min(70, Math.max(40, baseHsl.l));
    } else { // Dark mode
        if (colorKey === 'themeBackground') displayL = baseHsl.l < 50 ? baseHsl.l : Math.min(20, 100 - baseHsl.l);
        else if (colorKey === 'themeForeground') displayL = baseHsl.l > 50 ? baseHsl.l : Math.max(80, 100 - baseHsl.l);
        else if (colorKey === 'themePrimary') displayL = baseHsl.l;
        else if (colorKey === 'themeAccent') displayL = baseHsl.l;
    }
    return Math.max(0, Math.min(100, displayL));
  };

  return (
    <div className="space-y-2 p-3 border border-border rounded-lg shadow-sm bg-card">
      <Label className="text-base font-semibold text-card-foreground">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {palette.map((option) => {
          const isSelected = selectedHsl.h === option.hsl.h && selectedHsl.s === option.hsl.s && selectedHsl.l === option.hsl.l;
          const effectiveL = getEffectiveDisplayL(option.hsl);
          const displayColor = `hsl(${option.hsl.h}, ${option.hsl.s}%, ${effectiveL}%)`;
          
          return (
            <button
              key={option.name}
              type="button"
              title={`${option.name} (Base: H${option.hsl.h} S${option.hsl.s} L${option.hsl.l})`}
              className={`w-10 h-10 rounded-md border-2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
                          ${isSelected ? 'border-primary ring-2 ring-primary' : 'border-border/50 hover:border-muted-foreground'}`}
              style={{ backgroundColor: displayColor }}
              onClick={() => updateSetting(colorKey, option.hsl)}
            >
              {isSelected && (
                <Check
                  className="w-5 h-5 text-primary-foreground opacity-90 mx-auto"
                  style={{ filter: effectiveL > 70 ? 'invert(1)' : 'none' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default function UICustomizer() {
  const { settings, updateSetting, resetSettings } = useCustomization();

  return (
    <>
      <SheetHeader className="p-4 border-b bg-card sticky top-0 z-10">
        <SheetTitle className="text-card-foreground">UI Customizer</SheetTitle>
        <SheetDescription className="text-muted-foreground">
          Adjust the look and feel. Changes are live and saved locally.
        </SheetDescription>
      </SheetHeader>
      <div className="p-4 space-y-6 flex-1 overflow-y-auto bg-background text-foreground">
        <section>
          <h3 className="text-xl font-semibold mb-3">Appearance Mode</h3>
           <div className="p-3 border border-border rounded-lg shadow-sm bg-card space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="light-mode-switch" className="text-base text-card-foreground">
                Enable Light Mode
              </Label>
              <Switch
                id="light-mode-switch"
                checked={settings.themeMode === 'light'}
                onCheckedChange={(checked) => updateSetting('themeMode', checked ? 'light' : 'dark')}
                className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-input"
              />
            </div>
          </div>
        </section>
        <Separator/>
        <section>
          <h3 className="text-xl font-semibold mb-3">Theme Colors</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Select base colors. Effective lightness is adjusted by Appearance Mode.
          </p>
          <div className="space-y-4">
            <ThemePaletteSelector label="Background" colorKey="themeBackground" palette={themeBackgroundPalettes} />
            <ThemePaletteSelector label="Foreground" colorKey="themeForeground" palette={themeForegroundPalettes} />
            <ThemePaletteSelector label="Primary" colorKey="themePrimary" palette={themePrimaryPalettes} />
            <ThemePaletteSelector label="Accent" colorKey="themeAccent" palette={themeAccentPalettes} />
          </div>
        </section>
        <Separator />
        <section>
          <h3 className="text-xl font-semibold mb-4">Grid Customization</h3>
          <div className="space-y-4 p-3 border border-border rounded-lg shadow-sm bg-card">
            <div>
              <Label className="text-base font-semibold text-card-foreground mb-2 block">Grid Color</Label>
              <div className="flex flex-wrap gap-2 mb-3">
                {GRID_COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-md border-2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
                                ${settings.gridColor.toLowerCase() === color.toLowerCase() ? 'border-primary ring-2 ring-primary' : 'border-border'}`}
                    style={{ backgroundColor: color }}
                    onClick={() => updateSetting('gridColor', color)}
                    title={color}
                  >
                    {settings.gridColor.toLowerCase() === color.toLowerCase() && (
                      <Check className="w-5 h-5 text-primary-foreground opacity-80" style={{ mixBlendMode: color.toLowerCase() === '#ffffff' ? 'difference':'normal'}}/>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <Label htmlFor="gridOpacity" className="text-base font-semibold text-card-foreground">Grid Opacity: {settings.gridOpacity.toFixed(2)}</Label>
              <Slider
                id="gridOpacity"
                min={0} max={1} step={0.01}
                value={[settings.gridOpacity]}
                onValueChange={(value) => updateSetting('gridOpacity', value[0])}
                className="mt-2 [&>span:first-child]:h-2 [&>span>span]:bg-primary [&>span>button]:bg-primary-foreground [&>span>button]:border-primary"
              />
            </div>
          </div>
        </section>
        <Separator />
        <section>
          <h3 className="text-xl font-semibold mb-4">Typography Settings</h3>
          <div className="space-y-4 p-3 border border-border rounded-lg shadow-sm bg-card">
            <div>
              <Label htmlFor="fontFamily" className="text-base font-semibold text-card-foreground">Font Family</Label>
              <Select
                value={settings.fontFamilyKey}
                onValueChange={(value) => updateSetting('fontFamilyKey', value)}
              >
                <SelectTrigger id="fontFamily" className="mt-2 h-10">
                  <SelectValue placeholder="Select font family" />
                </SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map(font => (
                    <SelectItem key={font.value} value={font.value}>
                      {font.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-3">
              <Label htmlFor="uiScale" className="text-base font-semibold text-card-foreground">UI Scale: {settings.uiScale}%</Label>
              <Slider
                id="uiScale"
                min={75} max={150} step={5}
                value={[settings.uiScale]}
                onValueChange={(value) => updateSetting('uiScale', value[0])}
                className="mt-2 [&>span:first-child]:h-2 [&>span>span]:bg-primary [&>span>button]:bg-primary-foreground [&>span>button]:border-primary"
              />
            </div>
          </div>
        </section>
        <Separator />
        <div className="pt-4 pb-2">
            <Button 
                variant="outline" 
                onClick={resetSettings} 
                className="w-full border-primary text-primary hover:bg-primary/10"
            >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset to Defaults
            </Button>
        </div>
      </div>
    </>
  );
}
