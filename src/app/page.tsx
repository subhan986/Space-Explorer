
// src/app/page.tsx
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ControlPanel from '@/components/spacetime-explorer/ControlPanel';
import type { SceneObject, LightingMode, SavedSimulationState } from '@/types/spacetime';
import { PRESET_SCENARIOS } from '@/lib/preset-scenarios';
import { DEFAULT_SIMULATION_SPEED, DEFAULT_TRAJECTORY_LENGTH } from '@/lib/constants';
import { Palette, Settings } from 'lucide-react'; // Added Settings icon
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'; // Added more Sheet components
import UICustomizer from '@/components/ui-customizer/UICustomizer';
import { CustomizationProvider } from '@/contexts/CustomizationContext';
import ObjectDetailsPanel from '@/components/spacetime-explorer/ObjectDetailsPanel';
import ObjectManagementPanel from '@/components/spacetime-explorer/ObjectManagementPanel';


const SpaceTimeCanvas = dynamic(() => import('@/components/spacetime-explorer/SpaceTimeCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-background">
      <Skeleton className="w-3/4 h-3/4" />
      <p className="absolute text-foreground text-lg">Loading 3D Visualization...</p>
    </div>
  ),
});

const LOCAL_STORAGE_SAVE_KEY = 'spacetimeExplorerSaveState';

export default function SpacetimeExplorerPage() {
  const [objects, setObjects] = useState<SceneObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [simulationStatus, setSimulationStatus] = useState<'stopped' | 'running' | 'paused'>('stopped');
  const [simulationSpeed, setSimulationSpeed] = useState<number>(DEFAULT_SIMULATION_SPEED);
  const [showTrajectories, setShowTrajectories] = useState<boolean>(true);
  const [trajectoryLength, setTrajectoryLength] = useState<number>(DEFAULT_TRAJECTORY_LENGTH);
  const [showShadows, setShowShadows] = useState<boolean>(true);
  const [lightingMode, setLightingMode] = useState<LightingMode>("Realistic Solar");
  const [currentSimulatedDate, setCurrentSimulatedDate] = useState<Date>(new Date());
  const { toast } = useToast();
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [isControlsPanelOpen, setIsControlsPanelOpen] = useState(false);


  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(false);
  const [liveSelectedObjectData, setLiveSelectedObjectData] = useState<SceneObject | null>(null);

  const selectedObjectData = objects.find(obj => obj.id === selectedObjectId);

  useEffect(() => {
    if (selectedObjectId && selectedObjectData) {
      if (simulationStatus !== 'running') {
        setLiveSelectedObjectData(selectedObjectData);
      }
      // Note: setIsDetailsPanelOpen(true) is now handled by handleSelectObject
    } else {
      setIsDetailsPanelOpen(false);
      setLiveSelectedObjectData(null);
    }
  }, [selectedObjectId, objects, selectedObjectData, simulationStatus]);


  const handleDetailsPanelClose = () => {
    setIsDetailsPanelOpen(false);
    // Do NOT clear selectedObjectId here, so editor can remain open if desired
  };

  const handleSelectedObjectUpdate = useCallback((updatedState: SceneObject) => {
    if (updatedState.id === selectedObjectId) {
        setLiveSelectedObjectData(updatedState);
    }
  }, [selectedObjectId]);


  const handleAddObject = useCallback((object: SceneObject) => {
    setObjects(prev => [...prev, object]);
  }, []);

  const handleUpdateObject = useCallback((updatedObject: SceneObject) => {
    setObjects(prev => prev.map(obj => obj.id === updatedObject.id ? updatedObject : obj));
    if (updatedObject.id === selectedObjectId && simulationStatus !== 'running') {
      setLiveSelectedObjectData(updatedObject);
    }
  }, [selectedObjectId, simulationStatus]);

  const handleRemoveObject = useCallback((objectId: string) => {
    setObjects(prev => prev.filter(obj => obj.id !== objectId));
    if (selectedObjectId === objectId) {
      setSelectedObjectId(null); 
    }
  }, [selectedObjectId]);

  const handleSelectObject = useCallback((objectId: string | null) => {
    setSelectedObjectId(objectId);
    if (objectId) {
      const objectData = objects.find(obj => obj.id === objectId);
      if (objectData) {
        setLiveSelectedObjectData(objectData); 
        setIsDetailsPanelOpen(true); 
      } else {
        setIsDetailsPanelOpen(false);
        setLiveSelectedObjectData(null);
        setSelectedObjectId(null); 
      }
    } else {
      setIsDetailsPanelOpen(false);
      setLiveSelectedObjectData(null);
    }
  }, [objects]);

  const handleResetSimulation = useCallback(() => {
    setSimulationStatus('stopped');
    // setObjects([]); // Objects are no longer cleared on reset
    setSelectedObjectId(null);
    setCurrentSimulatedDate(new Date());
  }, [setSelectedObjectId, setCurrentSimulatedDate, setSimulationStatus]);

  const handleSimulatedTimeDeltaUpdate = useCallback((simDaysDelta: number) => {
    setCurrentSimulatedDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setDate(newDate.getDate() + simDaysDelta);
      return newDate;
    });
  }, []);


  const handleObjectsCollidedAndMerged = useCallback((absorbedObjectId: string, absorberObjectId: string, absorbedObjectMass: number) => {
    const originalAbsorber = objects.find(o => o.id === absorberObjectId);
    const originalAbsorbed = objects.find(o => o.id === absorbedObjectId);

    setObjects(prevObjects => {
      const currentAbsorberObject = prevObjects.find(obj => obj.id === absorberObjectId);
      if (!currentAbsorberObject) return prevObjects; 

      const newAbsorberMass = (currentAbsorberObject.mass || 0) + absorbedObjectMass;
      const updatedObjects = prevObjects
        .filter(obj => obj.id !== absorbedObjectId)
        .map(obj =>
          obj.id === absorberObjectId
            ? { ...obj, mass: newAbsorberMass }
            : obj
        );
      
      if (absorberObjectId === selectedObjectId && simulationStatus !== 'running') {
        const updatedAbsorberForLiveData = updatedObjects.find(o => o.id === absorberObjectId);
        if (updatedAbsorberForLiveData) setLiveSelectedObjectData(updatedAbsorberForLiveData);
      }
      return updatedObjects;
    });

    if (selectedObjectId === absorbedObjectId) {
      setSelectedObjectId(null);
    }
    
    toast({
      title: "Cosmic Collision!",
      description: `${originalAbsorbed?.name || 'An object'} was absorbed by ${originalAbsorber?.name || 'another object'}. Mass transferred.`
    });

  }, [selectedObjectId, toast, objects, simulationStatus]);

  const handleSaveState = useCallback(() => {
    try {
      const stateToSave: SavedSimulationState = {
        objects,
        simulationSpeed,
        showTrajectories,
        trajectoryLength,
        lightingMode,
        showShadows,
        simulatedDate: currentSimulatedDate.toISOString(),
      };
      localStorage.setItem(LOCAL_STORAGE_SAVE_KEY, JSON.stringify(stateToSave));
      toast({ title: "Simulation Saved", description: "Current state saved to local storage." });
    } catch (error) {
      console.error("Error saving state:", error);
      toast({ title: "Save Failed", description: "Could not save simulation state.", variant: "destructive" });
    }
  }, [objects, simulationSpeed, showTrajectories, trajectoryLength, lightingMode, showShadows, currentSimulatedDate, toast]);

  const handleLoadState = useCallback(() => {
    try {
      const savedStateString = localStorage.getItem(LOCAL_STORAGE_SAVE_KEY);
      if (savedStateString) {
        const savedState: SavedSimulationState = JSON.parse(savedStateString);
        setObjects(savedState.objects);
        setSimulationSpeed(savedState.simulationSpeed);
        setShowTrajectories(savedState.showTrajectories);
        setTrajectoryLength(savedState.trajectoryLength);
        setLightingMode(savedState.lightingMode);
        setShowShadows(savedState.showShadows);
        setCurrentSimulatedDate(savedState.simulatedDate ? new Date(savedState.simulatedDate) : new Date());
        setSimulationStatus('stopped');
        setSelectedObjectId(null); 
        toast({ title: "Simulation Loaded", description: "Saved state loaded from local storage." });
      } else {
        toast({ title: "Load Failed", description: "No saved simulation state found.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error loading state:", error);
      toast({ title: "Load Failed", description: "Could not load simulation state.", variant: "destructive" });
    }
  }, [toast]);

  const handleLoadPreset = useCallback((presetKey: string) => {
    const preset = PRESET_SCENARIOS[presetKey];
    if (preset) {
      setObjects(preset.objects.map(obj => ({...obj, id: `${obj.id}_${Date.now()}_${Math.random().toString(36).substring(2,7)}` })));
      setSimulationStatus('stopped');
      setSelectedObjectId(null); 
      setCurrentSimulatedDate(new Date());
      toast({ title: "Preset Loaded", description: `"${preset.name}" scenario is ready.` });
    } else {
      toast({ title: "Preset Error", description: "Could not load the selected preset.", variant: "destructive" });
    }
  }, [toast]);

  const displayObjectForDetailsPanel = 
    simulationStatus === 'running' && liveSelectedObjectData && liveSelectedObjectData.id === selectedObjectId
    ? liveSelectedObjectData
    : selectedObjectData;

  return (
    <CustomizationProvider>
      <div className="flex flex-col h-screen bg-background text-foreground">
        <header className="p-2 border-b border-border flex items-center justify-between gap-2 h-auto sticky top-0 bg-background z-20">
          <div className="flex gap-2">
            <Sheet open={isCustomizerOpen} onOpenChange={setIsCustomizerOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full border-2 border-primary hover:bg-primary/10 active:bg-primary/20">
                  <Palette className="h-5 w-5 text-primary" />
                  <span className="sr-only">Open UI Customizer</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-full max-w-xs sm:max-w-sm p-0 flex flex-col overflow-y-auto z-50">
                <UICustomizer />
              </SheetContent>
            </Sheet>
            
            {/* Button to open Control Panel Sheet */}
            <Sheet open={isControlsPanelOpen} onOpenChange={setIsControlsPanelOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full border-2 border-secondary hover:bg-secondary/10 active:bg-secondary/20">
                  <Settings className="h-5 w-5 text-secondary" />
                  <span className="sr-only">Open Controls Panel</span>
                </Button>
              </SheetTrigger>
              <SheetContent 
                side="left" 
                className="w-full max-w-md p-0 flex flex-col overflow-y-auto z-40 bg-card text-card-foreground" // Ensure z-index is appropriate
                style={{marginTop: '3.5rem', height: 'calc(100vh - 3.5rem)'}} // Position below header
              >
                 <SheetHeader className="p-4 border-b sticky top-0 bg-card z-10">
                    <SheetTitle className="text-card-foreground">Spacetime Controls</SheetTitle>
                    <SheetDescription className="text-muted-foreground">
                    Adjust simulation parameters and manage celestial objects.
                    </SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto p-1"> {/* Make this part scrollable */}
                    <ObjectManagementPanel
                        objects={objects}
                        selectedObjectId={selectedObjectId}
                        onAddObject={handleAddObject}
                        onUpdateObject={handleUpdateObject}
                        onRemoveObject={handleRemoveObject}
                        onSelectObject={handleSelectObject}
                        onClose={() => setIsControlsPanelOpen(false)} // Assuming ObjectManagementPanel has a way to call this
                    />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <h1 className="text-md md:text-lg font-semibold text-foreground flex-1 text-center truncate px-2">
            Spacetime Explorer
          </h1>
          <div className="w-10 h-10"> {/* Spacer to balance the left icon buttons */} </div>
        </header>

        <main className="flex-1 overflow-hidden relative">
            <SpaceTimeCanvas
              objects={objects}
              selectedObjectId={selectedObjectId}
              simulationStatus={simulationStatus}
              simulationSpeed={simulationSpeed}
              onObjectSelected={handleSelectObject}
              showTrajectories={showTrajectories}
              trajectoryLength={trajectoryLength}
              onObjectsCollidedAndMerged={handleObjectsCollidedAndMerged}
              showShadows={showShadows}
              lightingMode={lightingMode}
              onSelectedObjectUpdate={handleSelectedObjectUpdate}
              onSimulatedTimeDeltaUpdate={handleSimulatedTimeDeltaUpdate}
            />
        </main>

        <ControlPanel
            objects={objects} // Still pass objects for context if needed by Load Preset, Add Real Object etc.
            selectedObjectId={selectedObjectId} // For context if any control depends on selection
            simulationStatus={simulationStatus}
            simulationSpeed={simulationSpeed}
            showTrajectories={showTrajectories}
            trajectoryLength={trajectoryLength}
            showShadows={showShadows}
            lightingMode={lightingMode}
            currentSimulatedDate={currentSimulatedDate}
            onAddObject={handleAddObject} // May still be needed for "Add Real Object" directly from bar
            onUpdateObject={handleUpdateObject} // If any direct update is possible from bar
            onRemoveObject={handleRemoveObject} // If direct removal is possible
            onSelectObject={handleSelectObject} // If selection can be changed from bar
            onSetSimulationStatus={setSimulationStatus}
            onSetSimulationSpeed={setSimulationSpeed}
            onResetSimulation={handleResetSimulation}
            onSetShowTrajectories={setShowTrajectories}
            onSetTrajectoryLength={setTrajectoryLength}
            onSetShowShadows={setShowShadows}
            onSetLightingMode={setLightingMode}
            onSaveState={handleSaveState}
            onLoadState={handleLoadState}
            onLoadPreset={handleLoadPreset}
          />

        <ObjectDetailsPanel
            selectedObject={displayObjectForDetailsPanel}
            isOpen={isDetailsPanelOpen}
            onClose={handleDetailsPanelClose}
        />
      </div>
    </CustomizationProvider>
  );
}

