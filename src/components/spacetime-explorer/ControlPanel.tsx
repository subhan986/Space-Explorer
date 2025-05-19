
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
import { PlusCircle, Trash2, Play, Pause, SkipForward, Settings2, Lightbulb, Check, X } from 'lucide-react';
import ObjectForm from './ObjectForm';
import type { SceneObject, ObjectType, AISuggestion, Vector3, MassiveObject } from '@/types/spacetime';
import { suggestParameters, SuggestParametersInput } from '@/ai/flows/suggest-parameters';
import { useToast } from '@/hooks/use-toast';
import {
  MIN_SIMULATION_SPEED, MAX_SIMULATION_SPEED, DEFAULT_SIMULATION_SPEED,
  DEFAULT_TRAJECTORY_LENGTH, DEFAULT_ORBITER_OBJECT_RADIUS,
  G_CONSTANT, DEFAULT_ORBITAL_DISTANCE_OFFSET, DEFAULT_MASSIVE_OBJECT_RADIUS,
  DEFAULT_MASSIVE_OBJECT_COLOR, DEFAULT_ORBITER_OBJECT_COLOR
} from '@/lib/constants';
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
        const dynamicClearanceOffset = Math.max(DEFAULT_ORBITAL_DISTANCE_OFFSET, actualCentralBodyRadius * 1.0);
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
    setAiSuggestion(null); 
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

  const handleAISuggest = async () => {
    setIsAISuggesting(true);
    setAiSuggestion(null);
    try {
      const input: SuggestParametersInput = {
        scenarioDescription: "User is setting up a 3D gravity simulation.",
      };
      const targetForAISuggestion = formInitialData || selectedObject;

      if (targetForAISuggestion) {
        input.currentMass = targetForAISuggestion.mass;
        if (targetForAISuggestion.velocity) {
          const v = targetForAISuggestion.velocity;
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
    const baseData = formInitialData || selectedObject || {};
    let newVelocity: Vector3;
    const currentVel = baseData.velocity || { x: 0, y: 0, z: 0 };

    if (editingObjectType === 'orbiter' && !selectedObject) { 
      newVelocity = { x: currentVel.x, y: currentVel.y, z: aiSuggestion.suggestedVelocity };
    } else { 
      newVelocity = { x: aiSuggestion.suggestedVelocity, y: currentVel.y, z: currentVel.z };
    }

    const suggestedData: Partial<SceneObject> = {
        ...baseData, 
        mass: aiSuggestion.suggestedMass,
        velocity: newVelocity,
        ...(editingObjectType && !baseData.type && { type: editingObjectType }),
    };
    if (editingObjectType || selectedObject) {
      setFormInitialData(suggestedData);
      toast({ title: "AI Suggestion Applied", description: "Parameters updated in the form. Review and save." });
    }
    setAiSuggestion(null); 
  };


  return (
    <div className="h-full flex flex-col bg-sidebar text-sidebar-foreground rounded-lg shadow-lg overflow-hidden">
      <div className="p-4">
        <h2 className="text-2xl font-semibold mb-4 text-sidebar-foreground">Spacetime Explorer</h2>
        <Separator className="mb-4 bg-sidebar-border" />
      </div>
      <ScrollArea className="flex-grow p-4 pt-0">
        <Accordion type="multiple" defaultValue={['item-1', 'item-2', 'item-3']} className="w-full">
          
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
                    <span className="truncate" style={{color: props.selectedObjectId === obj.id ? 'hsl(var(--sidebar-accent-foreground))' : obj.color, fontWeight: props.selectedObjectId === obj.id ? 'bold' : 'normal'}}>{obj.name} ({obj.type}, M: {obj.mass.toFixed(1)})</span>
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

          <AccordionItem value="item-3" className="border-b-0">
            <AccordionTrigger className="hover:no-underline py-3 text-sidebar-foreground">
              <Lightbulb className="mr-2 h-5 w-5" /> AI Suggestions
            </AccordionTrigger>
            <AccordionContent className="pt-2 space-y-4">
              <Button
                size="sm"
                onClick={handleAISuggest}
                disabled={isAISuggesting || !(editingObjectType || selectedObject)}
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


    