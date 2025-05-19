
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
import type { SceneObject, ObjectType, AISuggestion, Vector3 } from '@/types/spacetime';
import { suggestParameters, SuggestParametersInput } from '@/ai/flows/suggest-parameters';
import { useToast } from '@/hooks/use-toast';
import { MIN_SIMULATION_SPEED, MAX_SIMULATION_SPEED, DEFAULT_SIMULATION_SPEED, DEFAULT_TRAJECTORY_LENGTH } from '@/lib/constants';
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
      setEditingObjectType(null); // Clear editing mode if an object is selected
    } else if (!editingObjectType) { // No selection, not in add mode
      setFormInitialData(undefined);
    }
    // If editingObjectType is set, formInitialData will be set by handleAddObjectClick or applyAISuggestion
  }, [selectedObject, editingObjectType]);


  const handleAddObjectClick = (type: ObjectType) => {
    props.onSelectObject(null); // Deselect any current object
    setEditingObjectType(type);
    // Set initial data for the form based on type, including default AI suggestion values if available
    const defaultMass = type === 'massive' ? 1000 : 1;
    const defaultRadius = type === 'massive' ? 10 : 2;
    const defaultColor = type === 'massive' ? '#FFD700' : '#00BFFF';
    const baseInitialData = { 
      mass: defaultMass, 
      radius: defaultRadius, 
      color: defaultColor,
      position: {x:0,y:0,z:0}, 
      velocity: {x:0,y:0,z:0}
    };
    setFormInitialData(baseInitialData);
    setAiSuggestion(null); // Clear AI suggestions when starting a new object
  };

  const handleObjectFormSubmit = (data: Partial<SceneObject>) => {
    if (data.id) { // Editing existing object
      props.onUpdateObject(data as SceneObject);
      toast({ title: "Object Updated", description: `${data.name} properties saved.` });
    } else { // Adding new object
      const newId = `obj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const fullObjectData = { ...data, id: newId, type: editingObjectType! } as SceneObject;
      props.onAddObject(fullObjectData);
      toast({ title: "Object Added", description: `${data.name} added to the scene.` });
    }
    setEditingObjectType(null); // Close form
    setFormInitialData(undefined); // Clear form data
    // props.onSelectObject(null); // Deselect object after submit to clear form, or select new one
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
    const suggestedData: Partial<SceneObject> = {
        ...baseData, // Keep existing properties like name, color, radius, type, id
        mass: aiSuggestion.suggestedMass,
        velocity: { x: aiSuggestion.suggestedVelocity, y: baseData.velocity?.y || 0, z: baseData.velocity?.z || 0 }, // Apply to X, keep Y/Z or default
        // If form is for a new object, ensure type is set
        ...(editingObjectType && !baseData.type && { type: editingObjectType }),
    };

    if (editingObjectType || selectedObject) {
      // If form is open (either for new or editing), update formInitialData to trigger re-render of ObjectForm
      setFormInitialData(suggestedData);
      toast({ title: "AI Suggestion Applied", description: "Parameters updated in the form. Review and save." });
    }
    // No need to call onUpdateObject directly here, user saves via form
    setAiSuggestion(null); // Clear after applying
  };


  return (
    <div className="p-4 h-full flex flex-col bg-sidebar text-sidebar-foreground rounded-lg shadow-lg">
      <h2 className="text-2xl font-semibold mb-4 text-sidebar-primary-foreground">Spacetime Explorer</h2>
      <Separator className="mb-4 bg-sidebar-border" />
      <ScrollArea className="flex-grow pr-2">
        <Accordion type="multiple" defaultValue={['item-1', 'item-2', 'item-3', 'item-4']} className="w-full">
          {/* Object Management */}
          <AccordionItem value="item-1">
            <AccordionTrigger className="hover:no-underline text-sidebar-accent-foreground">
              <Settings2 className="mr-2 h-5 w-5" /> Object Management
            </AccordionTrigger>
            <AccordionContent className="pt-2 space-y-4">
              <div className="flex space-x-2">
                <Button onClick={() => handleAddObjectClick('massive')} className="flex-1 bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground"><PlusCircle className="mr-2 h-4 w-4" /> Add Massive</Button>
                <Button onClick={() => handleAddObjectClick('orbiter')} className="flex-1 bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground"><PlusCircle className="mr-2 h-4 w-4" /> Add Orbiter</Button>
              </div>
              
              {(editingObjectType || selectedObject) && (
                <Card className="bg-card text-card-foreground border-sidebar-border">
                  <CardHeader>
                    <CardTitle>{editingObjectType ? `Add New ${editingObjectType === 'massive' ? 'Massive' : 'Orbiter'} Object` : `Edit: ${selectedObject?.name}`}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ObjectForm
                      key={selectedObject?.id || editingObjectType || 'new-object-form'} 
                      objectType={editingObjectType || selectedObject!.type}
                      initialData={formInitialData} // Pass state that can be updated by AI
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
              <div className="max-h-40 space-y-1">
                {props.objects.map(obj => (
                  <div key={obj.id} 
                       className={`flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-sidebar-accent/80
                                   ${props.selectedObjectId === obj.id ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'bg-sidebar-accent/20'}`}
                       onClick={() => { props.onSelectObject(obj.id); setEditingObjectType(null); /* selectedObject effect will setFormInitialData */ }}>
                    <span className="truncate" style={{color: obj.color, fontWeight: props.selectedObjectId === obj.id ? 'bold' : 'normal'}}>{obj.name} ({obj.type}, M: {obj.mass.toFixed(1)})</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-sidebar-destructive-foreground hover:bg-destructive/30" onClick={(e) => { e.stopPropagation(); props.onRemoveObject(obj.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Simulation Controls */}
          <AccordionItem value="item-2">
            <AccordionTrigger className="hover:no-underline text-sidebar-accent-foreground">
              <Play className="mr-2 h-5 w-5" /> Simulation Controls
            </AccordionTrigger>
            <AccordionContent className="pt-2 space-y-4">
              <div className="flex space-x-2">
                <Button onClick={() => props.onSetSimulationStatus('running')} disabled={props.simulationStatus === 'running'} className="flex-1 bg-green-500 hover:bg-green-600"><Play className="mr-2 h-4 w-4" /> Start</Button>
                <Button onClick={() => props.onSetSimulationStatus('paused')} disabled={props.simulationStatus !== 'running'} className="flex-1 bg-yellow-500 hover:bg-yellow-600"><Pause className="mr-2 h-4 w-4" /> Pause</Button>
              </div>
              <Button onClick={props.onResetSimulation} variant="outline" className="w-full border-sidebar-primary text-sidebar-primary hover:bg-sidebar-primary/10"><SkipForward className="mr-2 h-4 w-4" /> Reset Simulation</Button>
              
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

          {/* AI Suggestions */}
          <AccordionItem value="item-3">
            <AccordionTrigger className="hover:no-underline text-sidebar-accent-foreground">
              <Lightbulb className="mr-2 h-5 w-5" /> AI Suggestions
            </AccordionTrigger>
            <AccordionContent className="pt-2 space-y-4">
              <Button onClick={handleAISuggest} disabled={isAISuggesting || !(editingObjectType || selectedObject)} className="w-full bg-sidebar-accent hover:bg-sidebar-accent/90 text-sidebar-accent-foreground">
                {isAISuggesting ? "Thinking..." : "Suggest Parameters"}
              </Button>
              {isAISuggesting && <p className="text-sm text-center text-sidebar-muted-foreground">AI is generating suggestions...</p>}
              {aiSuggestion && (
                <Card className="bg-card text-card-foreground border-sidebar-border">
                  <CardHeader>
                    <CardTitle>AI Suggested Parameters</CardTitle>
                    <CardDescription className="text-muted-foreground">{aiSuggestion.explanation}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p><strong>Mass:</strong> {aiSuggestion.suggestedMass.toFixed(2)}</p>
                    <p><strong>Velocity (X):</strong> {aiSuggestion.suggestedVelocity.toFixed(2)}</p>
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
