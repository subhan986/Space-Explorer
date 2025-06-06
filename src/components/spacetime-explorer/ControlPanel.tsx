
// src/components/spacetime-explorer/ControlPanel.tsx
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Play, Pause, SkipForward, Settings2, Library, Sun, Orbit, MoonIcon, SigmaSquare, RefreshCw, Paintbrush, Zap, Rocket, Sparkles, Circle, Aperture, Target, DraftingCompass, SaveIcon, BookOpenCheck, FolderOpen, SlidersHorizontal, PaletteIcon } from 'lucide-react';
import type { SceneObject, ObjectType, LightingMode } from '@/types/spacetime';
import { PRESET_SCENARIOS } from '@/lib/preset-scenarios';
import { REAL_OBJECT_DEFINITIONS } from '@/lib/real-objects';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MIN_SIMULATION_SPEED, MAX_SIMULATION_SPEED } from '@/lib/constants';
import ObjectManagementPanel from './ObjectManagementPanel'; // New component for object management UI

interface ControlPanelProps {
  objects: SceneObject[];
  selectedObjectId: string | null;
  simulationStatus: 'stopped' | 'running' | 'paused';
  simulationSpeed: number;
  showTrajectories: boolean;
  trajectoryLength: number;
  showShadows: boolean;
  lightingMode: LightingMode;
  onAddObject: (object: SceneObject) => void;
  onUpdateObject: (object: SceneObject) => void;
  onRemoveObject: (objectId: string) => void;
  onSelectObject: (objectId: string | null) => void;
  onSetSimulationStatus: (status: 'stopped' | 'running' | 'paused') => void;
  onSetSimulationSpeed: (speed: number) => void;
  onResetSimulation: () => void;
  onSetShowTrajectories: (show: boolean) => void;
  onSetTrajectoryLength: (length: number) => void;
  onSetShowShadows: (show: boolean) => void;
  onSetLightingMode: (mode: LightingMode) => void;
  onSaveState: () => void;
  onLoadState: () => void;
  onLoadPreset: (presetKey: string) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = (props) => {
  const {
    objects, selectedObjectId, simulationStatus, simulationSpeed, showTrajectories, trajectoryLength,
    showShadows, lightingMode, onAddObject, onUpdateObject, onRemoveObject, onSelectObject,
    onSetSimulationStatus, onSetSimulationSpeed, onResetSimulation, onSetShowTrajectories,
    onSetTrajectoryLength, onSetShowShadows, onSetLightingMode, onSaveState, onLoadState, onLoadPreset
  } = props;

  const [isObjectSheetOpen, setIsObjectSheetOpen] = useState(false);

  const handleAddRealObject = (objectKey: keyof typeof REAL_OBJECT_DEFINITIONS) => {
     // This logic would need to be passed down or handled by a central manager if ObjectManagementPanel creates objects
     // For simplicity, we keep it here for now if the Select is directly in ControlPanel
    const definition = REAL_OBJECT_DEFINITIONS[objectKey];
    if (!definition) return;
    const newObject: SceneObject = {
      ...definition,
      id: `${definition.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
      position: definition.basePosition || { x: 0, y: 0, z: 0 },
      velocity: definition.baseVelocity || { x: 0, y: 0, z: 0 },
    };
    onAddObject(newObject);
  };


  return (
    <div className="fixed bottom-0 left-0 right-0 h-auto bg-card text-card-foreground border-t border-border p-3 shadow-lg flex items-center justify-around flex-wrap gap-x-4 gap-y-2 z-10">
      
      {/* Object Management Trigger */}
      <Sheet open={isObjectSheetOpen} onOpenChange={setIsObjectSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="flex items-center gap-1.5">
            <Settings2 className="h-4 w-4" /> Objects
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-full max-w-md p-0 flex flex-col">
          <ObjectManagementPanel
            objects={objects}
            selectedObjectId={selectedObjectId}
            onAddObject={onAddObject}
            onUpdateObject={onUpdateObject}
            onRemoveObject={onRemoveObject}
            onSelectObject={onSelectObject}
            onClose={() => setIsObjectSheetOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Simulation Controls */}
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          title="Start Simulation"
          onClick={() => onSetSimulationStatus('running')}
          disabled={simulationStatus === 'running'}
          className="h-8 w-8"
        >
          <Play className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          title="Pause Simulation"
          onClick={() => onSetSimulationStatus('paused')}
          disabled={simulationStatus !== 'running'}
          className="h-8 w-8"
        >
          <Pause className="h-4 w-4" />
        </Button>
        <Button size="icon" title="Reset Simulation" onClick={onResetSimulation} className="h-8 w-8">
          <SkipForward className="h-4 w-4" />
        </Button>
        <div className="flex flex-col items-start w-28 ml-2">
          <Label htmlFor="simSpeed" className="text-xs text-muted-foreground mb-0.5">
            Speed: {simulationSpeed.toFixed(1)}x
          </Label>
          <Slider
            id="simSpeed"
            min={MIN_SIMULATION_SPEED} max={MAX_SIMULATION_SPEED} step={0.1}
            value={[simulationSpeed]}
            onValueChange={(val) => onSetSimulationSpeed(val[0])}
            className="[&>span:first-child]:h-1.5 [&>span>button]:h-3.5 [&>span>button]:w-3.5"
          />
        </div>
      </div>
      
      {/* Trajectory Settings Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="flex items-center gap-1.5">
            <SlidersHorizontal className="h-4 w-4" /> Trajectories
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-3 space-y-3 mb-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="show-trajectories" className="text-sm">Show Trajectories</Label>
            <Switch id="show-trajectories" checked={showTrajectories} onCheckedChange={onSetShowTrajectories} 
              className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-input h-4 w-7 [&>span]:h-3 [&>span]:w-3 [&>span[data-state=checked]]:translate-x-3.5"
            />
          </div>
          {showTrajectories && (
            <div className="space-y-1">
              <Label htmlFor="trajectoryLength" className="text-sm">Length: {trajectoryLength}</Label>
              <Slider
                id="trajectoryLength"
                min={50} max={500} step={10}
                value={[trajectoryLength]}
                onValueChange={(val) => onSetTrajectoryLength(val[0])}
                className="[&>span:first-child]:h-1.5 [&>span>button]:h-3.5 [&>span>button]:w-3.5"
              />
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Rendering Settings Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="flex items-center gap-1.5">
            <PaletteIcon className="h-4 w-4" /> Rendering
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-3 space-y-3 mb-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="show-shadows" className="text-sm">Show Shadows</Label>
            <Switch id="show-shadows" checked={showShadows} onCheckedChange={onSetShowShadows} 
               className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-input h-4 w-7 [&>span]:h-3 [&>span]:w-3 [&>span[data-state=checked]]:translate-x-3.5"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lighting-mode" className="text-sm">Lighting</Label>
            <Select value={lightingMode} onValueChange={(value) => onSetLightingMode(value as LightingMode)}>
              <SelectTrigger id="lighting-mode" className="h-9 text-xs">
                <SelectValue placeholder="Select lighting" />
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="Realistic Solar">Realistic Solar</SelectItem>
                <SelectItem value="Ambient Glow">Ambient Glow</SelectItem>
                <SelectItem value="Dramatic Edge">Dramatic Edge</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </PopoverContent>
      </Popover>

      {/* Presets Select */}
      <Select onValueChange={(key) => onLoadPreset(key)}>
        <SelectTrigger className="w-[160px] h-9 text-xs">
          <SelectValue placeholder="Load Preset..." />
        </SelectTrigger>
        <SelectContent className="text-xs">
          {Object.entries(PRESET_SCENARIOS).map(([key, scenario]) => (
            <SelectItem key={key} value={key}>{scenario.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {/* Save/Load Buttons */}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onSaveState} className="h-9 flex items-center gap-1.5"><SaveIcon className="h-4 w-4"/>Save</Button>
        <Button size="sm" variant="outline" onClick={onLoadState} className="h-9 flex items-center gap-1.5"><FolderOpen className="h-4 w-4"/>Load</Button>
      </div>

       {/* Add Real Object Select - Kept simple for now */}
      <Select onValueChange={(value) => handleAddRealObject(value as keyof typeof REAL_OBJECT_DEFINITIONS)}>
          <SelectTrigger className="w-[160px] h-9 text-xs">
              <SelectValue placeholder="Add Real Object..." />
          </SelectTrigger>
          <SelectContent className="text-xs">
              {Object.entries(REAL_OBJECT_DEFINITIONS).map(([key, def]) => (
                  <SelectItem key={key} value={key}>{def.name}</SelectItem>
              ))}
          </SelectContent>
      </Select>

    </div>
  );
};

export default ControlPanel;
