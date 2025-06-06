
// src/app/page.tsx
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ControlPanel from '@/components/spacetime-explorer/ControlPanel';
import type { SceneObject, LightingMode, SavedSimulationState } from '@/types/spacetime';
import { PRESET_SCENARIOS } from '@/lib/preset-scenarios';
import { DEFAULT_SIMULATION_SPEED, DEFAULT_TRAJECTORY_LENGTH } from '@/lib/constants';
import { Palette } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import UICustomizer from '@/components/ui-customizer/UICustomizer';
import { CustomizationProvider } from '@/contexts/CustomizationContext';
import ObjectDetailsPanel from '@/components/spacetime-explorer/ObjectDetailsPanel';

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

  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(false);
  const [liveSelectedObjectData, setLiveSelectedObjectData] = useState<SceneObject | null>(null);

  const selectedObjectData = objects.find(obj => obj.id === selectedObjectId);

  // Effect to sync liveSelectedObjectData when sim is not running, or close panel if object becomes invalid
  useEffect(() => {
    if (selectedObjectId && selectedObjectData) {
      // Panel opening is now primarily handled by handleSelectObject.
      // This effect ensures live data is correct when sim is not running.
      if (simulationStatus !== 'running') {
        setLiveSelectedObjectData(selectedObjectData);
      }
    } else {
      // If object is deselected or no longer valid in 'objects' array, ensure panel is closed and live data cleared.
      setIsDetailsPanelOpen(false);
      setLiveSelectedObjectData(null);
    }
  }, [selectedObjectId, objects, selectedObjectData, simulationStatus, setIsDetailsPanelOpen, setLiveSelectedObjectData]);


  const handleDetailsPanelClose = () => {
    setIsDetailsPanelOpen(false);
    // Do NOT clear selectedObjectId here, so editor can remain open if desired
  };

  const handleSelectedObjectUpdate = useCallback((updatedState: SceneObject) => {
    // This callback is from SpaceTimeCanvas, updating for live data display
    if (updatedState.id === selectedObjectId) {
        setLiveSelectedObjectData(updatedState);
    }
  }, [selectedObjectId, setLiveSelectedObjectData]);


  const handleAddObject = useCallback((object: SceneObject) => {
    setObjects(prev => [...prev, object]);
  }, [setObjects]);

  const handleUpdateObject = useCallback((updatedObject: SceneObject) => {
    setObjects(prev => prev.map(obj => obj.id === updatedObject.id ? updatedObject : obj));
    if (updatedObject.id === selectedObjectId && simulationStatus !== 'running') {
      setLiveSelectedObjectData(updatedObject);
    }
  }, [selectedObjectId, simulationStatus, setObjects, setLiveSelectedObjectData]);

  const handleRemoveObject = useCallback((objectId: string) => {
    setObjects(prev => prev.filter(obj => obj.id !== objectId));
    if (selectedObjectId === objectId) {
      setSelectedObjectId(null); // This will trigger useEffect to close panel & clear live data
      // No need to explicitly call setIsDetailsPanelOpen(false) or setLiveSelectedObjectData(null) here,
      // as the useEffect dependent on selectedObjectId will handle it.
    }
  }, [selectedObjectId, setSelectedObjectId, setObjects]);

  const handleSelectObject = useCallback((objectId: string | null) => {
    setSelectedObjectId(objectId);
    if (objectId) {
      const objectData = objects.find(obj => obj.id === objectId);
      if (objectData) {
        setLiveSelectedObjectData(objectData); // Pre-populate with static data for immediate display
        setIsDetailsPanelOpen(true); // Explicitly open panel on selection
      } else {
        // Object ID was given, but it's not found (e.g., removed just before selection attempt)
        setIsDetailsPanelOpen(false);
        setLiveSelectedObjectData(null);
        setSelectedObjectId(null); // Clear the invalid ID
      }
    } else {
      // Deselecting
      setIsDetailsPanelOpen(false);
      setLiveSelectedObjectData(null);
    }
  }, [objects, setIsDetailsPanelOpen, setSelectedObjectId, setLiveSelectedObjectData]);

  const handleResetSimulation = useCallback(() => {
    setSimulationStatus('stopped');
    setObjects([]); // Clears objects
    setSelectedObjectId(null);
    // setLiveSelectedObjectData(null); // Handled by useEffect
    // setIsDetailsPanelOpen(false); // Handled by useEffect
    setCurrentSimulatedDate(new Date());
  }, [setObjects, setSelectedObjectId, setCurrentSimulatedDate, setSimulationStatus]);

  const handleSimulatedTimeDeltaUpdate = useCallback((simDaysDelta: number) => {
    setCurrentSimulatedDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setDate(newDate.getDate() + simDaysDelta);
      return newDate;
    });
  }, [setCurrentSimulatedDate]);


  const handleObjectsCollidedAndMerged = useCallback((absorbedObjectId: string, absorberObjectId: string, absorbedObjectMass: number) => {
    // Store original names for toast message before state updates
    const originalAbsorber = objects.find(o => o.id === absorberObjectId);
    const originalAbsorbed = objects.find(o => o.id === absorbedObjectId);

    setObjects(prevObjects => {
      const currentAbsorberObject = prevObjects.find(obj => obj.id === absorberObjectId);
      if (!currentAbsorberObject) return prevObjects; // Should not happen if logic is correct

      const newAbsorberMass = (currentAbsorberObject.mass || 0) + absorbedObjectMass;
      const updatedObjects = prevObjects
        .filter(obj => obj.id !== absorbedObjectId)
        .map(obj =>
          obj.id === absorberObjectId
            ? { ...obj, mass: newAbsorberMass }
            : obj
        );
      
      // If the absorber is the currently selected object and sim is not running, update live data
      if (absorberObjectId === selectedObjectId && simulationStatus !== 'running') {
        const updatedAbsorberForLiveData = updatedObjects.find(o => o.id === absorberObjectId);
        if (updatedAbsorberForLiveData) setLiveSelectedObjectData(updatedAbsorberForLiveData);
      }
      return updatedObjects;
    });

    // If the absorbed object was selected, deselect it.
    // The useEffect for selectedObjectId will handle closing the panel.
    if (selectedObjectId === absorbedObjectId) {
      setSelectedObjectId(null);
    }
    
    toast({
      title: "Cosmic Collision!",
      description: `${originalAbsorbed?.name || 'An object'} was absorbed by ${originalAbsorber?.name || 'another object'}. Mass transferred.`
    });

  }, [selectedObjectId, toast, objects, simulationStatus, setObjects, setSelectedObjectId, setLiveSelectedObjectData]);

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
        setSelectedObjectId(null); // Triggers useEffect to close panel & clear live data
        toast({ title: "Simulation Loaded", description: "Saved state loaded from local storage." });
      } else {
        toast({ title: "Load Failed", description: "No saved simulation state found.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error loading state:", error);
      toast({ title: "Load Failed", description: "Could not load simulation state.", variant: "destructive" });
    }
  }, [toast, setObjects, setSimulationSpeed, setShowTrajectories, setTrajectoryLength, setLightingMode, setShowShadows, setCurrentSimulatedDate, setSimulationStatus, setSelectedObjectId]);

  const handleLoadPreset = useCallback((presetKey: string) => {
    const preset = PRESET_SCENARIOS[presetKey];
    if (preset) {
      // Ensure unique IDs for preset objects to avoid key conflicts if loaded multiple times
      setObjects(preset.objects.map(obj => ({...obj, id: `${obj.id}_${Date.now()}_${Math.random().toString(36).substring(2,7)}` })));
      setSimulationStatus('stopped');
      setSelectedObjectId(null); // Triggers useEffect to close panel & clear live data
      setCurrentSimulatedDate(new Date());
      toast({ title: "Preset Loaded", description: `"${preset.name}" scenario is ready.` });
    } else {
      toast({ title: "Preset Error", description: "Could not load the selected preset.", variant: "destructive" });
    }
  }, [toast, setObjects, setSimulationStatus, setSelectedObjectId, setCurrentSimulatedDate]);

  // Determine which object data to display in the details panel
  // Prioritize liveSelectedObjectData if the simulation is running and the IDs match.
  // Otherwise, use the selectedObjectData from the main 'objects' array (which is static when sim is running).
  const displayObjectForDetailsPanel = 
    simulationStatus === 'running' && liveSelectedObjectData && liveSelectedObjectData.id === selectedObjectId
    ? liveSelectedObjectData
    : selectedObjectData;

  return (
    <CustomizationProvider>
      <div className="flex flex-col h-screen bg-background text-foreground">
        <header className="p-2 border-b border-border flex items-center justify-between gap-2 h-auto sticky top-0 bg-background z-20">
          <Sheet open={isCustomizerOpen} onOpenChange={setIsCustomizerOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-md border-2 border-primary hover:bg-primary/10 active:bg-primary/20">
                <Palette className="h-5 w-5 text-primary" />
                <span className="sr-only">Open UI Customizer</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-full max-w-xs sm:max-w-sm p-0 flex flex-col overflow-y-auto z-50">
              <UICustomizer />
            </SheetContent>
          </Sheet>

          <h1 className="text-md md:text-lg font-semibold text-foreground flex-1 text-center truncate px-2">
            Spacetime Explorer
          </h1>
          <div className="w-10 h-10"> {/* Spacer to balance the left icon button */} </div>
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
            objects={objects}
            selectedObjectId={selectedObjectId}
            simulationStatus={simulationStatus}
            simulationSpeed={simulationSpeed}
            showTrajectories={showTrajectories}
            trajectoryLength={trajectoryLength}
            showShadows={showShadows}
            lightingMode={lightingMode}
            currentSimulatedDate={currentSimulatedDate}
            onAddObject={handleAddObject}
            onUpdateObject={handleUpdateObject}
            onRemoveObject={handleRemoveObject}
            onSelectObject={handleSelectObject}
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

