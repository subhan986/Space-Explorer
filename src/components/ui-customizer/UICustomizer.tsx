
// src/components/ui-customizer/UICustomizer.tsx
'use client';

import { SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useCustomization } from "@/contexts/CustomizationContext";
import { HexColorPicker } from "react-colorful";
import React from "react";

interface ThemeColorControlProps {
  label: string;
  colorKey: 'themeBackground' | 'themeForeground' | 'themePrimary' | 'themeAccent';
}

const ThemeColorControl: React.FC<ThemeColorControlProps> = ({ label, colorKey }) => {
  const { settings, updateThemeColorValue } = useCustomization();
  const color = settings[colorKey];

  const handleInputChange = (component: 'h' | 's' | 'l', value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      updateThemeColorValue(colorKey, component, numValue);
    } else if (value === "") {
      updateThemeColorValue(colorKey, component, 0);
    }
  };

  return (
    <div className="space-y-2 p-3 border border-border rounded-lg shadow-sm bg-card">
      <Label className="text-base font-semibold text-card-foreground">{label}</Label>
      <div className="grid grid-cols-3 gap-2 items-center">
        <div>
          <Label htmlFor={`${colorKey}-h`} className="text-xs text-muted-foreground db-1">H (0-359)</Label>
          <Input
            id={`${colorKey}-h`}
            type="number"
            min="0" max="359" step="1"
            value={color.h}
            onChange={(e) => handleInputChange('h', e.target.value)}
            className="w-full h-9 text-sm p-2"
          />
        </div>
        <div>
          <Label htmlFor={`${colorKey}-s`} className="text-xs text-muted-foreground db-1">S (0-100%)</Label>
          <Input
            id={`${colorKey}-s`}
            type="number"
            min="0" max="100" step="1"
            value={color.s}
            onChange={(e) => handleInputChange('s', e.target.value)}
            className="w-full h-9 text-sm p-2"
          />
        </div>
        <div>
          <Label htmlFor={`${colorKey}-l`} className="text-xs text-muted-foreground db-1">L (0-100%)</Label>
          <Input
            id={`${colorKey}-l`}
            type="number"
            min="0" max="100" step="1"
            value={color.l}
            onChange={(e) => handleInputChange('l', e.target.value)}
            className="w-full h-9 text-sm p-2"
          />
        </div>
      </div>
       <div 
        className="w-full h-8 rounded-md border border-border mt-2" 
        style={{ 
          backgroundColor: settings.themeMode === 'light' && (colorKey === 'themeBackground' || colorKey === 'themeForeground')
            ? `hsl(${color.h}, ${color.s}%, ${colorKey === 'themeBackground' ? 92 : 10}%)`
            : `hsl(${color.h}, ${color.s}%, ${color.l}%)`
        }}
        title={`Base: hsl(${color.h}, ${color.s}%, ${color.l}%)`}
      />
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
          <h3 className="text-xl font-semibold mb-3">Theme Colors (Base HSL)</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Customize base Hue, Saturation, and Lightness. Lightness for Background/Foreground is primarily controlled by Appearance Mode.
          </p>
          <div className="space-y-4">
            <ThemeColorControl label="Background" colorKey="themeBackground" />
            <ThemeColorControl label="Foreground" colorKey="themeForeground" />
            <ThemeColorControl label="Primary" colorKey="themePrimary" />
            <ThemeColorControl label="Accent" colorKey="themeAccent" />
          </div>
        </section>
        <Separator />
        <section>
          <h3 className="text-xl font-semibold mb-4">Grid Customization</h3>
          <div className="space-y-4 p-3 border border-border rounded-lg shadow-sm bg-card">
            <div>
              <Label htmlFor="gridColor" className="text-base font-semibold text-card-foreground mb-1 block">Grid Color (Hex)</Label>
              <div className="flex items-center gap-2 mb-2">
                <Input
                  id="gridColorInput"
                  type="text"
                  value={settings.gridColor}
                  onChange={(e) => updateSetting('gridColor', e.target.value)}
                  className="w-1/2 h-9 p-2 text-sm"
                  placeholder="#RRGGBB"
                />
                <div style={{ backgroundColor: settings.gridColor, width: '28px', height: '28px', borderRadius: '4px', border: '1px solid hsl(var(--border))' }} />
              </div>
              <HexColorPicker 
                color={settings.gridColor} 
                onChange={(newColor) => updateSetting('gridColor', newColor)} 
                style={{ width: '100%', height: '150px' }}
              />
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
          <h3 className="text-xl font-semibold mb-4">Layout (Placeholders)</h3>
          <div className="space-y-3 p-3 border border-border rounded-lg shadow-sm bg-card">
            <div className="flex items-center justify-between">
              <Label className="text-card-foreground text-sm">Sidebar Width</Label>
              <Input type="number" defaultValue="320" className="w-20 h-8 rounded-md border-input text-xs p-1.5" disabled />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-card-foreground text-sm">Font Size (Base)</Label>
              <Input type="number" defaultValue="16" className="w-20 h-8 rounded-md border-input text-xs p-1.5" disabled />
            </div>
          </div>
        </section>
        <Separator />
        <div className="pt-4 pb-2 flex justify-end sticky bottom-0 bg-background border-t border-border -mx-4 px-4">
            <Button variant="outline" onClick={resetSettings} className="border-primary text-primary hover:bg-primary/10">Reset to Defaults</Button>
        </div>
      </div>
    </>
  );
}
