
// src/components/spacetime-explorer/ControlPanel.tsx
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Play, Pause, SkipForward, Settings2, Library, Sun, Orbit, MoonIcon, SigmaSquare, RefreshCw, Paintbrush, Zap, Rocket, Sparkles, Circle, Aperture, Target, DraftingCompass, SaveIcon, BookOpenCheck, FolderOpen, SlidersHorizontal, PaletteIcon, Rewind, FastForward, CalendarDays, BrainCircuit } from 'lucide-react';
import type { SceneObject, ObjectType, LightingMode } from '@/types/spacetime';
import { PRESET_SCENARIOS } from '@/lib/preset-scenarios';
import { REAL_OBJECT_DEFINITIONS } from '@/lib/real-objects';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MIN_SIMULATION_SPEED, MAX_SIMULATION_SPEED } from '@/lib/constants';
import ObjectManagementPanel from './ObjectManagementPanel'; // New component for object management UI
import { format } from 'date-fns';


interface ControlPanelProps {
  objects: SceneObject[];
  selectedObjectId: string | null;
  simulationStatus: 'stopped' | 'running' | 'paused';
  simulationSpeed: number;
  showTrajectories: boolean;
  trajectoryLength: number;
  showShadows: boolean;
  lightingMode: LightingMode;
  currentSimulatedDate: Date;
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
  onGenerateRandomSystem: () => void;
}

const ControlPanel: React.FC<ControlPanelProps> = (props) => {
  const {
    objects, selectedObjectId, simulationStatus, simulationSpeed, showTrajectories, trajectoryLength,
    showShadows, lightingMode, currentSimulatedDate, onAddObject, onUpdateObject, onRemoveObject, onSelectObject,
    onSetSimulationStatus, onSetSimulationSpeed, onResetSimulation, onSetShowTrajectories,
    onSetTrajectoryLength, onSetShowShadows, onSetLightingMode, onSaveState, onLoadState, onLoadPreset,
    onGenerateRandomSystem
  } = props;

  const [isObjectSheetOpen, setIsObjectSheetOpen] = useState(false);

  const handleAddRealObject = (objectKey: keyof typeof REAL_OBJECT_DEFINITIONS) => {
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

  const handleTogglePlayPause = () => {
    if (simulationStatus === 'running') {
      onSetSimulationStatus('paused');
    } else {
      onSetSimulationStatus('running');
    }
  };

  const handleSpeedChange = (increment: number) => {
    let newSpeed = simulationSpeed + increment;
    newSpeed = Math.max(MIN_SIMULATION_SPEED, Math.min(MAX_SIMULATION_SPEED, newSpeed));
    onSetSimulationSpeed(newSpeed);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-auto bg-card text-card-foreground border-t border-border p-3 shadow-lg flex items-center justify-around flex-wrap gap-x-4 gap-y-2 z-10">
      
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
          title={simulationStatus === 'running' ? "Pause Simulation" : "Start Simulation"}
          onClick={handleTogglePlayPause}
          className="h-8 w-8 rounded-full"
        >
          {simulationStatus === 'running' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button size="icon" title="Reset Simulation" onClick={onResetSimulation} className="h-8 w-8 rounded-full">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Time and Speed Display */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          <span>{format(currentSimulatedDate, "yyyy-MM-dd hh:mm a")}</span>
          <span className="mx-1">|</span>
          <span>{simulationSpeed.toFixed(1)} day/s</span>
      </div>

       {/* Speed Adjustment Buttons */}
      <div className="flex items-center gap-1">
        <Button
            size="icon"
            variant="ghost"
            title="Decrease Speed"
            onClick={() => handleSpeedChange(-0.5)}
            className="h-7 w-7 rounded-full"
            disabled={simulationSpeed <= MIN_SIMULATION_SPEED}
        >
            <Rewind className="h-4 w-4" />
        </Button>
        <Button
            size="icon"
            variant="ghost"
            title="Increase Speed"
            onClick={() => handleSpeedChange(0.5)}
            className="h-7 w-7 rounded-full"
            disabled={simulationSpeed >= MAX_SIMULATION_SPEED}
        >
            <FastForward className="h-4 w-4" />
        </Button>
      </div>
      
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
      
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onSaveState} className="h-9 flex items-center gap-1.5"><SaveIcon className="h-4 w-4"/>Save</Button>
        <Button size="sm" variant="outline" onClick={onLoadState} className="h-9 flex items-center gap-1.5"><FolderOpen className="h-4 w-4"/>Load</Button>
      </div>

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
      
      <Button size="sm" onClick={onGenerateRandomSystem} className="h-9 flex items-center gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90">
        <BrainCircuit className="h-4 w-4"/> Generate System
      </Button>

    </div>
  );
};

export default ControlPanel;
