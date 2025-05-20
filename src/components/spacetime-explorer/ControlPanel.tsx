
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
import { PlusCircle, Trash2, Play, Pause, SkipForward, Settings2, Lightbulb, Check, X, Library, Sun, Orbit, MoonIcon, SigmaSquare, RefreshCw } from 'lucide-react';
import ObjectForm from './ObjectForm';
import type { SceneObject, ObjectType, AISuggestion, Vector3, MassiveObject } from '@/types/spacetime';
import { suggestParameters, SuggestParametersInput } from '@/ai/flows/suggest-parameters';
// import { generateTexture } from '@/ai/flows/generate-texture-flow'; // Removed AI texture generation
import { useToast } from '@/hooks/use-toast';
import {
  MIN_SIMULATION_SPEED, MAX_SIMULATION_SPEED, DEFAULT_SIMULATION_SPEED,
  DEFAULT_TRAJECTORY_LENGTH, DEFAULT_ORBITER_OBJECT_RADIUS,
  G_CONSTANT, DEFAULT_ORBITAL_DISTANCE_OFFSET, DEFAULT_MASSIVE_OBJECT_RADIUS,
  DEFAULT_MASSIVE_OBJECT_COLOR, DEFAULT_ORBITER_OBJECT_COLOR
} from '@/lib/constants';
import { REAL_OBJECT_DEFINITIONS } from '@/lib/real-objects';
import { Switch } from '@/components/ui/switch';

interface ControlPanelProps {
  objects: SceneObject[];
  selectedObjectId: string | null;
  simulationStatus: 'stopped' | 'running' | 'paused';
  simulationSpeed: number;
  showTrajectories: boolean;
  trajectoryLength: number;
  onAddObject: (object: SceneObject) => void;
  onUpdateObject: (object: SceneObject) => void;
  onRemoveObject: (objectId: string) => void;
  onSelectObject: (objectId: string | null) => void;
  onSetSimulationStatus: (status: 'stopped' | 'running' | 'paused') => void;
  onSetSimulationSpeed: (speed: number) => void;
  onResetSimulation: () => void;
  onSetShowTrajectories: (show: boolean) => void;
  onSetTrajectoryLength: (length: number) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = (props) => {
  const { toast } = useToast();
  const [editingObjectType, setEditingObjectType] = useState<ObjectType | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [isAISuggesting, setIsAISuggesting] = useState(false);
  const [formInitialData, setFormInitialData] = useState<Partial<SceneObject> | undefined>(undefined);
  // const [generatingTextures, setGeneratingTextures] = useState<Record<string, boolean>>({}); // Removed


  const selectedObject = props.objects.find(obj => obj.id === props.selectedObjectId);

  useEffect(() => {
    if (selectedObject) {
      setFormInitialData(selectedObject);
      setEditingObjectType(null); // Clear editing type if an object is selected
    } else if (!editingObjectType) { // If no object selected and not actively adding new
      setFormInitialData(undefined);
    }
    // Only depend on selectedObject and editingObjectType to avoid re-renders from formInitialData itself
  }, [selectedObject, editingObjectType]);


  const handleAddObjectClick = (type: ObjectType) => {
    props.onSelectObject(null); // Deselect any currently selected object
    setEditingObjectType(type); // Set the type of object to be added

    // Define base initial data for new objects
    let baseInitialData: Partial<SceneObject> = {
      mass: type === 'massive' ? 1000 : 1, // Default mass based on type
      radius: type === 'massive' ? DEFAULT_MASSIVE_OBJECT_RADIUS : DEFAULT_ORBITER_OBJECT_RADIUS,
      color: type === 'massive' ? DEFAULT_MASSIVE_OBJECT_COLOR : DEFAULT_ORBITER_OBJECT_COLOR,
      position: { x: 0, y: 0, z: 0 }, // Default position at origin
      velocity: { x: 0, y: 0, z: 0 }, // Default velocity zero
    };

    // If adding an orbiter, try to place it in orbit around the most massive object
    if (type === 'orbiter') {
      const massiveObjects = props.objects.filter(obj => obj.type === 'massive') as MassiveObject[];
      let centralBody: MassiveObject | null = null;
      if (massiveObjects.length > 0) {
        // Find the most massive object to orbit around
        centralBody = massiveObjects.reduce((prev, current) => (prev.mass > current.mass) ? prev : current);
      }

      if (centralBody) {
        const actualCentralBodyRadius = centralBody.radius || DEFAULT_MASSIVE_OBJECT_RADIUS;
        const actualOrbiterRadius = DEFAULT_ORBITER_OBJECT_RADIUS; // Use default for new orbiter
        // Ensure clearance is significant, especially for large central bodies
        const dynamicClearanceOffset = Math.max(DEFAULT_ORBITAL_DISTANCE_OFFSET, actualCentralBodyRadius * 1.0);
        const distance = actualCentralBodyRadius + actualOrbiterRadius + dynamicClearanceOffset;
        
        const centralBodyPos = centralBody.position || { x: 0, y: 0, z: 0 };
        const centralBodyVel = centralBody.velocity || { x: 0, y: 0, z: 0 };

        // Initial position offset in X for a horizontal orbit in XZ plane
        baseInitialData.position = {
          x: centralBodyPos.x + distance,
          y: centralBodyPos.y,
          z: centralBodyPos.z,
        };

        // Calculate orbital speed for a circular orbit: v = sqrt(G * M / r)
        let orbitalSpeed = 0;
        if (centralBody.mass > 0 && distance > 0) {
           orbitalSpeed = Math.sqrt((G_CONSTANT * centralBody.mass) / distance);
        }
        if (!isFinite(orbitalSpeed)) { // Prevent NaN/Infinity issues
          orbitalSpeed = 0;
        }
        
        // Initial velocity in Z for a horizontal orbit, relative to central body's velocity
        baseInitialData.velocity = {
          x: centralBodyVel.x,
          y: centralBodyVel.y,
          z: centralBodyVel.z + orbitalSpeed,
        };
      }
    }
    setFormInitialData(baseInitialData); // Set this initial data for the form
    setAiSuggestion(null); // Clear any previous AI suggestions
  };

  const handleObjectFormSubmit = (data: Partial<SceneObject>) => {
    if (data.id) { // If ID exists, it's an update
      props.onUpdateObject(data as SceneObject);
      toast({ title: "Object Updated", description: `${data.name} properties saved.` });
    } else { // No ID, it's a new object
      const newId = `obj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const fullObjectData = { ...data, id: newId, type: editingObjectType! } as SceneObject;
      props.onAddObject(fullObjectData);
      toast({ title: "Object Added", description: `${data.name} added to the scene.` });
    }
    setEditingObjectType(null); // Reset editing state
    setFormInitialData(undefined); // Clear form data
  };

  const handleAISuggest = async () => {
    setIsAISuggesting(true);
    setAiSuggestion(null);
    try {
      const input: SuggestParametersInput = {
        scenarioDescription: "User is setting up a 3D gravity simulation.",
      };
      // Determine if we are suggesting for a new object or an existing one
      const targetForAISuggestion = formInitialData || selectedObject;

      if (targetForAISuggestion) {
        input.currentMass = targetForAISuggestion.mass;
        if (targetForAISuggestion.velocity) {
          const v = targetForAISuggestion.velocity;
          // Use magnitude of velocity vector for suggestion context if available
          input.currentVelocity = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
        }
      }

      const result = await suggestParameters(input);
      setAiSuggestion(result);
      toast({ title: "AI Suggestion Ready", description: "Parameters suggested by AI." });
    } catch (error) {
      console.error("AI suggestion error:", error);
      toast({ variant: "destructive", title: "AI Error", description: "Could not get suggestions." });
    } finally {
      setIsAISuggesting(false);
    }
  };

 const applyAISuggestion = () => {
    if (!aiSuggestion) return;
    const baseData = formInitialData || selectedObject || {}; // Use current form data or selected object data
    let newVelocity: Vector3;
    const currentVel = baseData.velocity || { x: 0, y: 0, z: 0 };

    // Apply suggested velocity magnitude based on context
    if (editingObjectType === 'orbiter' && !selectedObject) { // New orbiter being added
      // For new orbiters, AI often suggests velocity relative to an orbit, so add to Z
      newVelocity = { x: currentVel.x, y: currentVel.y, z: currentVel.z + aiSuggestion.suggestedVelocity };
    } else { // Editing existing object or new massive object
      // For others, apply primarily to X or as a general magnitude change
      newVelocity = { x: currentVel.x + aiSuggestion.suggestedVelocity, y: currentVel.y, z: currentVel.z };
    }

    const suggestedData: Partial<SceneObject> = {
        ...baseData, // Keep other properties
        mass: aiSuggestion.suggestedMass,
        velocity: newVelocity,
        // If it's a new object, ensure its type is set from editingObjectType
        ...(editingObjectType && !baseData.type && { type: editingObjectType }),
    };
    // Update formInitialData to pre-fill the form with suggestions
    if (editingObjectType || selectedObject) { // Ensure form is active for new or editing
      setFormInitialData(suggestedData);
      toast({ title: "AI Suggestion Applied", description: "Parameters updated in the form. Review and save." });
    }
    setAiSuggestion(null); // Clear suggestion after applying
  };

  const handleAddRealObject = async (objectKey: keyof typeof REAL_OBJECT_DEFINITIONS) => {
    const definition = REAL_OBJECT_DEFINITIONS[objectKey];
    if (!definition) return;

    const newId = `${definition.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    let position: Vector3 = definition.basePosition || { x: 0, y: 0, z: 0 };
    let velocity: Vector3 = definition.baseVelocity || { x: 0, y: 0, z: 0 };

    if (definition.type === 'orbiter' && definition.orbits) {
      let centralBody: SceneObject | null = null;
      // Prioritize specific central bodies by name if they exist
      if (definition.orbits === 'Sun') {
        centralBody = props.objects.find(obj => obj.name === 'Sun' && obj.type === 'massive') || null;
      } else if (definition.orbits === 'Earth') {
         // Moon orbits Earth. Earth might be an orbiter itself (around Sun) or a massive central body.
         centralBody = props.objects.find(obj => obj.name === 'Earth' && (obj.type === 'orbiter' || obj.type === 'massive')) || null;
         // If Earth not found, Moon might be added relative to Sun if Earth isn't there yet
         if (!centralBody) {
            centralBody = props.objects.find(obj => obj.name === 'Sun' && obj.type === 'massive') || null;
         }
      }
      
      // Fallback: orbit the most massive object if specific parent not found but other massive objects exist
      if (!centralBody && props.objects.filter(o => o.type === 'massive').length > 0) {
        centralBody = props.objects
          .filter(obj => obj.type === 'massive')
          .reduce((prev, current) => (prev.mass > current.mass ? prev : current));
      } else if (!centralBody && props.objects.length > 0) { // If no massive, orbit most massive of any type
         centralBody = props.objects
          .reduce((prev, current) => (prev.mass > current.mass ? prev : current));
      }

      if (centralBody) {
        const actualCentralBodyRadius = centralBody.radius || DEFAULT_MASSIVE_OBJECT_RADIUS;
        const actualOrbiterRadius = definition.radius; // Radius from definition
        // Dynamic clearance based on central body size and orbiter size
        const dynamicClearanceOffset = Math.max(DEFAULT_ORBITAL_DISTANCE_OFFSET, actualCentralBodyRadius * 1.2, definition.radius * 2);
        const distance = actualCentralBodyRadius + actualOrbiterRadius + dynamicClearanceOffset;
        
        const centralBodyPos = centralBody.position || { x: 0, y: 0, z: 0 };
        const centralBodyVel = centralBody.velocity || { x: 0, y: 0, z: 0 };

        position = {
          x: centralBodyPos.x + distance, // Offset in X for horizontal orbit
          y: centralBodyPos.y,
          z: centralBodyPos.z,
        };

        let orbitalSpeed = 0;
        if (centralBody.mass > 0 && distance > 0) {
          orbitalSpeed = Math.sqrt((G_CONSTANT * centralBody.mass) / distance);
        }
        if (!isFinite(orbitalSpeed)) orbitalSpeed = 0; // Safety check
        
        velocity = {
          x: centralBodyVel.x,
          y: centralBodyVel.y,
          z: centralBodyVel.z + orbitalSpeed, // Velocity in Z for horizontal orbit
        };
      }
    }

    const newObject: SceneObject = {
      ...definition, // Spread definition first to get type, mass, radius, color etc.
      id: newId,
      position, // Calculated or base position
      velocity, // Calculated or base velocity
      // textureUrl is now part of definition, if specified (e.g. for Moon's placeholder)
    } as SceneObject; // Cast to SceneObject as definition is Partial

    props.onAddObject(newObject);
    toast({ title: "Real Object Added", description: `${definition.name} added to the scene.` });

    // AI Texture generation removed
  };


  return (
    <div className="h-full flex flex-col bg-sidebar text-sidebar-foreground rounded-lg shadow-lg overflow-hidden">
      <div className="p-4">
        <h2 className="text-2xl font-semibold mb-4 text-sidebar-foreground">Spacetime Explorer</h2>
        <Separator className="mb-4 bg-sidebar-border" />
      </div>
      <ScrollArea className="flex-grow p-4 pt-0">
        <Accordion type="multiple" defaultValue={['item-1', 'item-2', 'item-3', 'item-4']} className="w-full">

          <AccordionItem value="item-1" className="border-b-0">
            <AccordionTrigger className="hover:no-underline py-3 text-sidebar-foreground">
              <Settings2 className="mr-2 h-5 w-5" /> Object Management
            </AccordionTrigger>
            <AccordionContent className="pt-2 space-y-4">
              <div className="flex flex-col space-y-2">
                <Button size="sm" onClick={() => handleAddObjectClick('massive')} className="w-full bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground"><PlusCircle className="mr-2 h-4 w-4" /> Add Massive</Button>
                <Button size="sm" onClick={() => handleAddObjectClick('orbiter')} className="w-full bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground"><PlusCircle className="mr-2 h-4 w-4" /> Add Orbiter</Button>
              </div>

              {(editingObjectType || selectedObject) && (
                <Card className="bg-card text-card-foreground border-sidebar-border">
                  <CardHeader>
                    <CardTitle className="text-sidebar-foreground">{editingObjectType ? `Add New ${editingObjectType === 'massive' ? 'Massive' : 'Orbiter'} Object` : `Edit: ${selectedObject?.name}`}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 py-4 pt-0">
                    <ObjectForm
                      key={selectedObject?.id || editingObjectType || 'new-object-form'} // Key ensures form re-renders with new initialData
                      objectType={editingObjectType || selectedObject!.type} // Pass current type
                      initialData={formInitialData} // Pass current form data
                      onSubmit={handleObjectFormSubmit}
                      onCancel={() => { setEditingObjectType(null); props.onSelectObject(null); setFormInitialData(undefined); }}
                      submitButtonText={selectedObject ? "Update Object" : "Add Object"}
                    />
                  </CardContent>
                </Card>
              )}

              <Separator className="my-4 bg-sidebar-border" />
              <Label className="text-sidebar-foreground/80">Scene Objects:</Label>
              {props.objects.length === 0 && <p className="text-sm text-sidebar-muted-foreground">No objects in scene.</p>}
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {props.objects.map(obj => (
                  <div key={obj.id}
                       className={`flex items-center justify-between p-2 rounded-md cursor-pointer
                                   hover:bg-sidebar-accent hover:text-sidebar-accent-foreground
                                   ${props.selectedObjectId === obj.id
                                     ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                     : 'bg-sidebar-background text-sidebar-foreground hover:bg-opacity-75'}`}
                       onClick={() => { props.onSelectObject(obj.id); setEditingObjectType(null); }}>
                    <div className="flex items-center truncate">
                       {/* Removed generatingTextures check */}
                       <span className="truncate" style={{color: props.selectedObjectId === obj.id ? 'hsl(var(--sidebar-accent-foreground))' : obj.color, fontWeight: props.selectedObjectId === obj.id ? 'bold' : 'normal'}}>{obj.name} ({obj.type}, M: {obj.mass.toFixed(1)})</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-sidebar-destructive-foreground hover:bg-destructive/30 flex-shrink-0" onClick={(e) => { e.stopPropagation(); props.onRemoveObject(obj.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-2" className="border-b-0">
            <AccordionTrigger className="hover:no-underline py-3 text-sidebar-foreground">
              <Play className="mr-2 h-5 w-5" /> Simulation Controls
            </AccordionTrigger>
            <AccordionContent className="pt-2 space-y-4">
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

              <div className="space-y-2">
                <Label htmlFor="simSpeed" className="text-sidebar-foreground/80">Speed: {props.simulationSpeed.toFixed(1)}x</Label>
                <Slider
                  id="simSpeed"
                  min={MIN_SIMULATION_SPEED} max={MAX_SIMULATION_SPEED} step={0.1}
                  value={[props.simulationSpeed]}
                  onValueChange={(val) => props.onSetSimulationSpeed(val[0])}
                  className="[&>span:first-child]:h-2 [&>span>span]:bg-sidebar-primary [&>span>button]:bg-sidebar-primary-foreground [&>span>button]:border-sidebar-primary"
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <Label htmlFor="show-trajectories" className="text-sidebar-foreground/80">Show Trajectories</Label>
                <Switch id="show-trajectories" checked={props.showTrajectories} onCheckedChange={props.onSetShowTrajectories}
                  className="data-[state=checked]:bg-sidebar-primary data-[state=unchecked]:bg-input"
                />
              </div>
              {props.showTrajectories && (
                <div className="space-y-2">
                  <Label htmlFor="trajectoryLength" className="text-sidebar-foreground/80">Trajectory Length: {props.trajectoryLength}</Label>
                  <Slider
                    id="trajectoryLength"
                    min={50} max={500} step={10}
                    value={[props.trajectoryLength]}
                    onValueChange={(val) => props.onSetTrajectoryLength(val[0])}
                    className="[&>span:first-child]:h-2 [&>span>span]:bg-sidebar-primary [&>span>button]:bg-sidebar-primary-foreground [&>span>button]:border-sidebar-primary"
                  />
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-4" className="border-b-0">
            <AccordionTrigger className="hover:no-underline py-3 text-sidebar-foreground">
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
                <Button size="sm" onClick={() => handleAddRealObject('BLACK_HOLE')} className="w-full bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground">
                    <SigmaSquare className="mr-2 h-4 w-4" /> Add Black Hole
                </Button>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-3" className="border-b-0">
            <AccordionTrigger className="hover:no-underline py-3 text-sidebar-foreground">
              <Lightbulb className="mr-2 h-5 w-5" /> AI Suggestions
            </AccordionTrigger>
            <AccordionContent className="pt-2 space-y-4">
              <Button
                size="sm"
                onClick={handleAISuggest}
                disabled={isAISuggesting || !(editingObjectType || selectedObject)} // Disable if AI is thinking or no object context
                className="w-full bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground"
              >
                {isAISuggesting ? "Thinking..." : "Suggest Parameters"}
              </Button>
              {isAISuggesting && <p className="text-sm text-center text-sidebar-muted-foreground">AI is generating suggestions...</p>}
              {aiSuggestion && (
                <Card className="bg-card text-card-foreground border-sidebar-border">
                  <CardHeader>
                    <CardTitle className="text-sidebar-foreground">AI Suggested Parameters</CardTitle>
                    <CardDescription className="text-sidebar-muted-foreground">{aiSuggestion.explanation}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p><strong>Mass:</strong> {aiSuggestion.suggestedMass.toFixed(2)}</p>
                    <p><strong>Velocity (Magnitude):</strong> {aiSuggestion.suggestedVelocity.toFixed(2)}</p>
                    <div className="flex justify-end space-x-2 pt-2">
                       <Button variant="outline" size="sm" onClick={() => setAiSuggestion(null)} className="border-sidebar-ring text-sidebar-ring hover:bg-sidebar-ring/10">
                         <X className="mr-1 h-4 w-4" /> Dismiss
                       </Button>
                       <Button size="sm" onClick={applyAISuggestion} className="bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground">
                         <Check className="mr-1 h-4 w-4" /> Apply
                       </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              <p className="text-xs text-sidebar-muted-foreground">
                {editingObjectType ? `AI will suggest parameters for the new ${editingObjectType} object.` :
                 selectedObject ? `AI will suggest parameters based on '${selectedObject.name}'.` :
                 "Select an object or start adding one to get AI suggestions."}
              </p>
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </ScrollArea>
    </div>
  );
};

export default ControlPanel;
