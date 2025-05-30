
// src/components/spacetime-explorer/ControlPanel.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PlusCircle, Trash2, Play, Pause, SkipForward, Settings2, Library, Sun, Orbit, MoonIcon, SigmaSquare, RefreshCw, Paintbrush, Zap, Rocket, Sparkles, Circle, Aperture, Target, DraftingCompass, SaveIcon, BookOpenCheck, FolderOpen } from 'lucide-react';
import ObjectForm from './ObjectForm';
import type { SceneObject, ObjectType, Vector3, MassiveObject, LightingMode } from '@/types/spacetime';
import { PRESET_SCENARIOS } from '@/lib/preset-scenarios';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
// Removed: import SpacecraftDesigner2D from './SpacecraftDesigner2D'; // This component was removed earlier


import { useToast } from '@/hooks/use-toast';
import {
  MIN_SIMULATION_SPEED, MAX_SIMULATION_SPEED,
  DEFAULT_TRAJECTORY_LENGTH, DEFAULT_ORBITER_OBJECT_RADIUS,
  G_CONSTANT, DEFAULT_ORBITAL_DISTANCE_OFFSET, DEFAULT_MASSIVE_OBJECT_RADIUS,
  DEFAULT_MASSIVE_OBJECT_COLOR, DEFAULT_ORBITER_OBJECT_COLOR
} from '@/lib/constants';
import { REAL_OBJECT_DEFINITIONS } from '@/lib/real-objects';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


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
  const { toast } = useToast();
  const [editingObjectType, setEditingObjectType] = useState<ObjectType | null>(null);
  const [formInitialData, setFormInitialData] = useState<Partial<SceneObject> | undefined>(undefined);
  // const [isDesignerOpen, setIsDesignerOpen] = useState(false); // State for SpacecraftDesigner Sheet was removed

  const selectedObject = props.objects.find(obj => obj.id === props.selectedObjectId);

  useEffect(() => {
    if (selectedObject) {
      setFormInitialData(selectedObject);
      setEditingObjectType(null); 
    } else if (!editingObjectType) { 
      setFormInitialData(undefined);
    }
  }, [selectedObject, editingObjectType]);


  const handleAddObjectClick = (type: ObjectType) => {
    props.onSelectObject(null); 
    setEditingObjectType(type); 

    let baseInitialData: Partial<SceneObject> = {
      mass: type === 'massive' ? 1000 : 1, 
      radius: type === 'massive' ? DEFAULT_MASSIVE_OBJECT_RADIUS : DEFAULT_ORBITER_OBJECT_RADIUS,
      color: type === 'massive' ? DEFAULT_MASSIVE_OBJECT_COLOR : DEFAULT_ORBITER_OBJECT_COLOR,
      position: { x: 0, y: 0, z: 0 }, 
      velocity: { x: 0, y: 0, z: 0 }, 
    };

    if (type === 'orbiter') {
      const massiveObjects = props.objects.filter(obj => obj.type === 'massive') as MassiveObject[];
      let centralBody: MassiveObject | null = null;
      if (massiveObjects.length > 0) {
        centralBody = massiveObjects.reduce((prev, current) => (prev.mass > current.mass) ? prev : current);
      }

      if (centralBody) {
        const actualCentralBodyRadius = centralBody.radius || DEFAULT_MASSIVE_OBJECT_RADIUS;
        const actualOrbiterRadius = DEFAULT_ORBITER_OBJECT_RADIUS;
        
        let dynamicClearanceOffset = Math.max(DEFAULT_ORBITAL_DISTANCE_OFFSET, actualCentralBodyRadius * 0.5);
        dynamicClearanceOffset = Math.max(dynamicClearanceOffset, actualOrbiterRadius * 1.2);

        const distance = actualCentralBodyRadius + actualOrbiterRadius + dynamicClearanceOffset;
        
        const centralBodyPos = centralBody.position || { x: 0, y: 0, z: 0 };
        const centralBodyVel = centralBody.velocity || { x: 0, y: 0, z: 0 };

        baseInitialData.position = {
          x: centralBodyPos.x + distance,
          y: centralBodyPos.y,
          z: centralBodyPos.z,
        };

        let orbitalSpeed = 0;
        if (centralBody.mass > 0 && distance > 0) {
           orbitalSpeed = Math.sqrt((G_CONSTANT * centralBody.mass) / distance);
        }
        if (!isFinite(orbitalSpeed)) { 
          orbitalSpeed = 0;
        }
        
        baseInitialData.velocity = {
          x: centralBodyVel.x,
          y: centralBodyVel.y, 
          z: centralBodyVel.z + orbitalSpeed,
        };
      }
    }
    setFormInitialData(baseInitialData); 
  };

  const handleObjectFormSubmit = (data: Partial<SceneObject>) => {
    if (data.id) { 
      props.onUpdateObject(data as SceneObject);
      toast({ title: "Object Updated", description: `${data.name} properties saved.` });
    } else { 
      const newId = `obj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const fullObjectData = { ...data, id: newId, type: editingObjectType! } as SceneObject;
      props.onAddObject(fullObjectData);
      toast({ title: "Object Added", description: `${data.name} added to the scene.` });
    }
    setEditingObjectType(null); 
    setFormInitialData(undefined); 
  };


 const handleAddRealObject = (objectKey: keyof typeof REAL_OBJECT_DEFINITIONS) => {
    const definition = REAL_OBJECT_DEFINITIONS[objectKey];
    if (!definition) return;

    const newId = `${definition.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    let position: Vector3 = definition.basePosition || { x: 0, y: 0, z: 0 };
    let velocity: Vector3 = definition.baseVelocity || { x: 0, y: 0, z: 0 };

    if (definition.orbits) {
      let centralBody: SceneObject | null = null;
      
      if (definition.orbits === 'Sun') {
        centralBody = props.objects.find(obj => obj.name === 'Sun' && obj.type === 'massive') || null;
      } else if (definition.orbits === 'Earth') {
         centralBody = props.objects.find(obj => obj.name === 'Earth') || null;
      }

      if (!centralBody && props.objects.filter(o => o.type === 'massive' || o.mass > (definition.mass * 10)).length > 0) {
        centralBody = props.objects
          .filter(obj => obj.type === 'massive' || obj.mass > (definition.mass * 10)) 
          .reduce((prev, current) => (prev.mass > current.mass ? prev : current), props.objects[0]); 
      } else if (!centralBody && props.objects.length > 0) {
         const potentialParents = props.objects.filter(obj => obj.id !== newId && obj.mass > definition.mass);
         if(potentialParents.length > 0) {
           centralBody = potentialParents.reduce((prev, current) => (prev.mass > current.mass ? prev : current));
         }
      }

      if (centralBody) {
        const actualCentralBodyRadius = centralBody.radius || DEFAULT_MASSIVE_OBJECT_RADIUS;
        const actualOrbiterRadius = definition.radius; 
        
        let dynamicClearanceOffset = Math.max(DEFAULT_ORBITAL_DISTANCE_OFFSET, actualCentralBodyRadius * 0.5);
        dynamicClearanceOffset = Math.max(dynamicClearanceOffset, actualOrbiterRadius * 1.2);
        const distance = actualCentralBodyRadius + actualOrbiterRadius + dynamicClearanceOffset;
        
        const centralBodyPos = centralBody.position || { x: 0, y: 0, z: 0 };
        const centralBodyVel = centralBody.velocity || { x: 0, y: 0, z: 0 };

        position = {
          x: centralBodyPos.x + distance, 
          y: centralBodyPos.y,
          z: centralBodyPos.z,
        };

        let orbitalSpeed = 0;
        if (centralBody.mass > 0 && distance > 0) {
          orbitalSpeed = Math.sqrt((G_CONSTANT * centralBody.mass) / distance);
        }
        if (!isFinite(orbitalSpeed)) orbitalSpeed = 0; 
        
        velocity = {
          x: centralBodyVel.x,
          y: centralBodyVel.y,
          z: centralBodyVel.z + orbitalSpeed, 
        };

        if (objectKey === 'ISS' && centralBody.name === 'Earth') {
            position = {
                x: centralBodyPos.x,
                y: centralBodyPos.y + distance, 
                z: centralBodyPos.z,
            };
            velocity = {
                x: centralBodyVel.x + orbitalSpeed, 
                y: centralBodyVel.y,
                z: centralBodyVel.z,
            };
        }
      }
    }

    if (objectKey === 'HALLEYS_COMET' && (!definition.orbits || !props.objects.find(o => o.name === definition.orbits))) {
        position = definition.basePosition || {x:0,y:0,z:0}; 
        velocity = definition.baseVelocity || {x:0,y:0,z:0}; 
    }

    const newObject: SceneObject = {
      ...definition, 
      id: newId,
      name: definition.name,
      type: definition.type,
      mass: definition.mass,
      radius: definition.radius,
      color: definition.color,
      position, 
      velocity, 
    };

    props.onAddObject(newObject);
    toast({ title: "Real Object Added", description: `${definition.name} added to the scene.` });
  };

  return (
    <div className="h-full flex flex-col bg-sidebar text-sidebar-foreground rounded-lg shadow-lg overflow-hidden">
      <div className="p-3"> {/* Reduced padding */}
        <h2 className="text-xl font-semibold mb-3 text-sidebar-foreground">Spacetime Explorer</h2> {/* Reduced text size and margin */}
        <Separator className="mb-3 bg-sidebar-border" /> {/* Reduced margin */}
      </div>
      <ScrollArea className="flex-grow p-3 pt-0"> {/* Reduced padding */}
        <Accordion type="multiple" defaultValue={['item-1', 'item-2']} className="w-full"> {/* Changed default open sections */}

          <AccordionItem value="item-1" className="border-b-0">
            <AccordionTrigger className="hover:no-underline py-2 text-sidebar-foreground"> {/* Reduced padding */}
              <Settings2 className="mr-2 h-5 w-5" /> Object Management
            </AccordionTrigger>
            <AccordionContent className="pt-2 space-y-3"> {/* Reduced spacing */}
              <div className="flex flex-col space-y-2">
                <Button size="sm" onClick={() => handleAddObjectClick('massive')} className="w-full bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground"><PlusCircle className="mr-2 h-4 w-4" /> Add Massive</Button>
                <Button size="sm" onClick={() => handleAddObjectClick('orbiter')} className="w-full bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground"><PlusCircle className="mr-2 h-4 w-4" /> Add Orbiter</Button>
              </div>

              {(editingObjectType || selectedObject) && (
                <Card className="bg-card text-card-foreground border-sidebar-border">
                  <CardHeader className="px-2 py-1.5"> {/* Reduced padding */}
                    <CardTitle className="text-sm text-sidebar-foreground">{editingObjectType ? `Add New ${editingObjectType === 'massive' ? 'Massive' : 'Orbiter'} Object` : `Edit: ${selectedObject?.name}`}</CardTitle> {/* Reduced text size */}
                  </CardHeader>
                  <CardContent className="px-3 py-3 pt-0"> {/* Adjusted padding */}
                    <ObjectForm
                      key={selectedObject?.id || editingObjectType || 'new-object-form'} 
                      objectType={editingObjectType || selectedObject!.type} 
                      initialData={formInitialData} 
                      onSubmit={handleObjectFormSubmit}
                      onCancel={() => { setEditingObjectType(null); props.onSelectObject(null); setFormInitialData(undefined); }}
                      submitButtonText={selectedObject ? "Update Object" : "Add Object"}
                    />
                  </CardContent>
                </Card>
              )}

              <Separator className="my-3 bg-sidebar-border" /> {/* Reduced margin */}
              <Label className="text-sidebar-foreground/80 text-sm">Scene Objects:</Label> {/* Ensured text size is appropriate */}
              {props.objects.length === 0 && <p className="text-xs text-sidebar-muted-foreground">No objects in scene.</p>}
              <div className="max-h-32 space-y-1 overflow-y-auto"> {/* Reduced max-h, reduced space-y */}
                {props.objects.map(obj => (
                  <div key={obj.id}
                       className={`flex items-center justify-between p-1.5 rounded-md cursor-pointer {/* Reduced padding */}
                                   hover:bg-sidebar-accent hover:text-sidebar-accent-foreground
                                   ${props.selectedObjectId === obj.id
                                     ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                     : 'bg-sidebar-background text-sidebar-foreground hover:bg-opacity-75'}`}
                       onClick={() => { props.onSelectObject(obj.id); setEditingObjectType(null); }}>
                    <div className="flex items-center truncate">
                       <span className="truncate text-xs" style={{color: props.selectedObjectId === obj.id ? 'hsl(var(--sidebar-accent-foreground))' : obj.color, fontWeight: props.selectedObjectId === obj.id ? 'bold' : 'normal'}}>{obj.name} ({obj.type}, M: {obj.mass.toFixed(1)})</span> {/* Reduced text size */}
                    </div>
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-sidebar-destructive-foreground hover:bg-destructive/30 flex-shrink-0" onClick={(e) => { e.stopPropagation(); props.onRemoveObject(obj.id); }}> {/* Reduced button size */}
                      <Trash2 className="h-3 w-3" /> {/* Reduced icon size */}
                    </Button>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-2" className="border-b-0">
            <AccordionTrigger className="hover:no-underline py-2 text-sidebar-foreground"> {/* Reduced padding */}
              <Play className="mr-2 h-5 w-5" /> Simulation Controls
            </AccordionTrigger>
            <AccordionContent className="pt-2 space-y-3"> {/* Reduced spacing */}
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  onClick={() => props.onSetSimulationStatus('running')}
                  disabled={props.simulationStatus === 'running'}
                  className="flex-1 bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground"
                >
                  <Play className="mr-2 h-4 w-4" /> Start
                </Button>
                <Button
                  size="sm"
                  onClick={() => props.onSetSimulationStatus('paused')}
                  disabled={props.simulationStatus !== 'running'}
                  className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground" 
                >
                  <Pause className="mr-2 h-4 w-4" /> Pause
                </Button>
              </div>
              <Button size="sm" onClick={props.onResetSimulation} variant="outline" className="w-full border-sidebar-primary text-sidebar-primary hover:bg-sidebar-primary/10"><SkipForward className="mr-2 h-4 w-4" /> Reset Simulation</Button>

              <div className="space-y-1.5"> {/* Reduced spacing */}
                <Label htmlFor="simSpeed" className="text-sidebar-foreground/80 text-xs">Speed: {props.simulationSpeed.toFixed(1)}x</Label> {/* Reduced text size */}
                <Slider
                  id="simSpeed"
                  min={MIN_SIMULATION_SPEED} max={MAX_SIMULATION_SPEED} step={0.1}
                  value={[props.simulationSpeed]}
                  onValueChange={(val) => props.onSetSimulationSpeed(val[0])}
                  className="[&>span:first-child]:h-1.5 [&>span>span]:bg-sidebar-primary [&>span>button]:bg-sidebar-primary-foreground [&>span>button]:border-sidebar-primary [&>span>button]:h-4 [&>span>button]:w-4" /* Reduced slider height/thumb */
                />
              </div>
              <div className="flex items-center justify-between pt-1.5"> {/* Reduced padding */}
                <Label htmlFor="show-trajectories" className="text-sidebar-foreground/80 text-xs">Show Trajectories</Label> {/* Reduced text size */}
                <Switch id="show-trajectories" checked={props.showTrajectories} onCheckedChange={props.onSetShowTrajectories}
                  className="data-[state=checked]:bg-sidebar-primary data-[state=unchecked]:bg-input h-4 w-7 [&>span]:h-3 [&>span]:w-3 [&>span[data-state=checked]]:translate-x-3.5" /* Reduced switch size */
                />
              </div>
              {props.showTrajectories && (
                <div className="space-y-1.5"> {/* Reduced spacing */}
                  <Label htmlFor="trajectoryLength" className="text-sidebar-foreground/80 text-xs">Trajectory Length: {props.trajectoryLength}</Label> {/* Reduced text size */}
                  <Slider
                    id="trajectoryLength"
                    min={50} max={500} step={10}
                    value={[props.trajectoryLength]}
                    onValueChange={(val) => props.onSetTrajectoryLength(val[0])}
                    className="[&>span:first-child]:h-1.5 [&>span>span]:bg-sidebar-primary [&>span>button]:bg-sidebar-primary-foreground [&>span>button]:border-sidebar-primary [&>span>button]:h-4 [&>span>button]:w-4" /* Reduced slider height/thumb */
                  />
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-presets" className="border-b-0">
            <AccordionTrigger className="hover:no-underline py-2 text-sidebar-foreground"> {/* Reduced padding */}
              <BookOpenCheck className="mr-2 h-5 w-5" /> Preset Scenarios
            </AccordionTrigger>
            <AccordionContent className="pt-2 space-y-1.5"> {/* Reduced spacing */}
              {Object.entries(PRESET_SCENARIOS).map(([key, scenario]) => (
                <Button
                  key={key}
                  size="sm"
                  variant="outline"
                  onClick={() => props.onLoadPreset(key)}
                  className="w-full border-sidebar-primary text-sidebar-primary hover:bg-sidebar-primary/10 flex-col items-start h-auto py-1.5" /* Reduced padding */
                >
                  <span className="font-semibold text-xs">{scenario.name}</span> {/* Reduced text size */}
                  <span className="text-xs text-sidebar-muted-foreground">{scenario.description}</span>
                </Button>
              ))}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-save-load" className="border-b-0">
            <AccordionTrigger className="hover:no-underline py-2 text-sidebar-foreground"> {/* Reduced padding */}
              <SaveIcon className="mr-2 h-5 w-5" /> Save/Load Simulation
            </AccordionTrigger>
            <AccordionContent className="pt-2 space-y-2">
              <Button
                size="sm"
                onClick={props.onSaveState}
                className="w-full bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground"
              >
                <SaveIcon className="mr-2 h-4 w-4" /> Save Current State
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={props.onLoadState}
                className="w-full border-sidebar-primary text-sidebar-primary hover:bg-sidebar-primary/10"
              >
                <FolderOpen className="mr-2 h-4 w-4" /> Load Saved State
              </Button>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-5" className="border-b-0">
            <AccordionTrigger className="hover:no-underline py-2 text-sidebar-foreground"> {/* Reduced padding */}
              <Paintbrush className="mr-2 h-5 w-5" /> Rendering Tools
            </AccordionTrigger>
            <AccordionContent className="pt-2 space-y-3"> {/* Reduced spacing */}
              <div className="flex items-center justify-between">
                <Label htmlFor="show-shadows" className="text-sidebar-foreground/80 text-xs">Show Shadows</Label> {/* Reduced text size */}
                <Switch id="show-shadows" checked={props.showShadows} onCheckedChange={props.onSetShowShadows}
                  className="data-[state=checked]:bg-sidebar-primary data-[state=unchecked]:bg-input h-4 w-7 [&>span]:h-3 [&>span]:w-3 [&>span[data-state=checked]]:translate-x-3.5" /* Reduced switch size */
                />
              </div>
              <div className="space-y-1.5"> {/* Reduced spacing */}
                <Label htmlFor="lighting-mode" className="text-sidebar-foreground/80 text-xs">Lighting Mode</Label> {/* Reduced text size */}
                <Select value={props.lightingMode} onValueChange={(value) => props.onSetLightingMode(value as LightingMode)}>
                  <SelectTrigger id="lighting-mode" className="w-full bg-input border-sidebar-border text-sidebar-foreground focus:ring-sidebar-ring h-8 text-xs"> {/* Reduced height and text size */}
                    <SelectValue placeholder="Select lighting mode" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-sidebar-border text-popover-foreground text-xs"> {/* Reduced text size */}
                    <SelectItem value="Realistic Solar">Realistic Solar</SelectItem>
                    <SelectItem value="Ambient Glow">Ambient Glow</SelectItem>
                    <SelectItem value="Dramatic Edge">Dramatic Edge</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-4" className="border-b-0">
            <AccordionTrigger className="hover:no-underline py-2 text-sidebar-foreground"> {/* Reduced padding */}
              <Library className="mr-2 h-5 w-5" /> Real Objects
            </AccordionTrigger>
            <AccordionContent className="pt-2 space-y-2">
                <Button size="sm" onClick={() => handleAddRealObject('SUN')} className="w-full bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground">
                    <Sun className="mr-2 h-4 w-4" /> Add Sun
                </Button>
                <Button size="sm" onClick={() => handleAddRealObject('EARTH')} className="w-full bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground">
                    <Orbit className="mr-2 h-4 w-4" /> Add Earth
                </Button>
                <Button size="sm" onClick={() => handleAddRealObject('MOON')} className="w-full bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground">
                    <MoonIcon className="mr-2 h-4 w-4" /> Add Moon
                </Button>
                 <Button size="sm" onClick={() => handleAddRealObject('JUPITER')} className="w-full bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground">
                    <Circle className="mr-2 h-4 w-4" /> Add Jupiter
                </Button>
                <Button size="sm" onClick={() => handleAddRealObject('ISS')} className="w-full bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground">
                    <Rocket className="mr-2 h-4 w-4" /> Add ISS
                </Button>
                <Button size="sm" onClick={() => handleAddRealObject('HALLEYS_COMET')} className="w-full bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground">
                    <Sparkles className="mr-2 h-4 w-4" /> Add Halley's Comet
                </Button>
                <Button size="sm" onClick={() => handleAddRealObject('CERES')} className="w-full bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground">
                    <Circle className="mr-2 h-4 w-4" /> Add Ceres
                </Button>
                <Button size="sm" onClick={() => handleAddRealObject('BLACK_HOLE')} className="w-full bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground">
                    <SigmaSquare className="mr-2 h-4 w-4" /> Add Black Hole
                </Button>
                <Button size="sm" onClick={() => handleAddRealObject('SAGITTARIUS_A_STAR')} className="w-full bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground">
                    <Aperture className="mr-2 h-4 w-4" /> Add Sagittarius A*
                </Button>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </ScrollArea>
    </div>
  );
};

export default ControlPanel;

