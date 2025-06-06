
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
import ObjectDetailsPanel from '@/components/spacetime-explorer/ObjectDetailsPanel'; // New Import

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
  const [objects, setObjects] = useState<SceneObject[]>(PRESET_SCENARIOS.realSolarSystem.objects.map(obj => ({...obj, id: `${obj.id}_${Date.now()}` })));
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [simulationStatus, setSimulationStatus] = useState<'stopped' | 'running' | 'paused'>('stopped');
  const [simulationSpeed, setSimulationSpeed] = useState<number>(DEFAULT_SIMULATION_SPEED);
  const [showTrajectories, setShowTrajectories] = useState<boolean>(true);
  const [trajectoryLength, setTrajectoryLength] = useState<number>(DEFAULT_TRAJECTORY_LENGTH);
  const [showShadows, setShowShadows] = useState<boolean>(true);
  const [lightingMode, setLightingMode] = useState<LightingMode>("Realistic Solar");
  const { toast } = useToast();
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(false);
  const [liveSelectedObjectData, setLiveSelectedObjectData] = useState<SceneObject | null>(null);

  const selectedObjectData = objects.find(obj => obj.id === selectedObjectId);

  useEffect(() => {
    if (selectedObjectId && selectedObjectData) {
      setIsDetailsPanelOpen(true);
      if (simulationStatus !== 'running') { // If paused or stopped, use data from main 'objects' array
        setLiveSelectedObjectData(selectedObjectData);
      }
      // If running, liveSelectedObjectData will be updated by onSelectedObjectUpdate from SpaceTimeCanvas
    } else {
      setIsDetailsPanelOpen(false);
      setLiveSelectedObjectData(null);
    }
  }, [selectedObjectId, selectedObjectData, simulationStatus]);

  const handleDetailsPanelClose = () => {
    setIsDetailsPanelOpen(false);
    setSelectedObjectId(null); 
  };

  const handleSelectedObjectUpdate = useCallback((updatedState: SceneObject) => {
    if (updatedState.id === selectedObjectId) { // Ensure the update is for the currently selected object
        setLiveSelectedObjectData(updatedState);
    }
  }, [selectedObjectId]);


  const handleAddObject = useCallback((object: SceneObject) => {
    setObjects(prev => [...prev, object]);
  }, []);

  const handleUpdateObject = useCallback((updatedObject: SceneObject) => {
    setObjects(prev => prev.map(obj => obj.id === updatedObject.id ? updatedObject : obj));
    // If the updated object is the selected one, also update liveSelectedObjectData if not running
    if (updatedObject.id === selectedObjectId && simulationStatus !== 'running') {
      setLiveSelectedObjectData(updatedObject);
    }
  }, [selectedObjectId, simulationStatus]);

  const handleRemoveObject = useCallback((objectId: string) => {
    setObjects(prev => prev.filter(obj => obj.id !== objectId));
    if (selectedObjectId === objectId) {
      setSelectedObjectId(null);
      setLiveSelectedObjectData(null);
      setIsDetailsPanelOpen(false);
    }
  }, [selectedObjectId]);

  const handleSelectObject = useCallback((objectId: string | null) => {
    setSelectedObjectId(objectId);
    if (!objectId) {
      setIsDetailsPanelOpen(false);
      setLiveSelectedObjectData(null);
    }
  }, []);

  const handleResetSimulation = useCallback(() => {
    setSimulationStatus('stopped');
    const currentPreset = PRESET_SCENARIOS.realSolarSystem; 
    setObjects(currentPreset.objects.map(obj => ({...obj, id: `${obj.id}_${Date.now()}` })));
    setSelectedObjectId(null);
    setLiveSelectedObjectData(null);
    setIsDetailsPanelOpen(false);
  }, []);

  const handleObjectsCollidedAndMerged = useCallback((absorbedObjectId: string, absorberObjectId: string, absorbedObjectMass: number) => {
    setObjects(prevObjects => {
      const absorberObject = prevObjects.find(obj => obj.id === absorberObjectId);
      
      if (!absorberObject) return prevObjects;

      const newAbsorberMass = (absorberObject.mass || 0) + absorbedObjectMass;
      const updatedObjects = prevObjects
        .filter(obj => obj.id !== absorbedObjectId)
        .map(obj => 
          obj.id === absorberObjectId 
            ? { ...obj, mass: newAbsorberMass } 
            : obj
        );
      
      // Update liveSelectedObjectData if the absorber was selected
      if (absorberObjectId === selectedObjectId) {
        const updatedAbsorber = updatedObjects.find(o => o.id === absorberObjectId);
        if (updatedAbsorber) setLiveSelectedObjectData(updatedAbsorber);
      }
      return updatedObjects;
    });

    if (selectedObjectId === absorbedObjectId) {
      setSelectedObjectId(null);
      setLiveSelectedObjectData(null);
      setIsDetailsPanelOpen(false);
    }
    
    // Find names from original objects array for toast, as it might be slightly delayed
    const originalAbsorber = objects.find(o => o.id === absorberObjectId);
    const originalAbsorbed = objects.find(o => o.id === absorbedObjectId);
    toast({ 
      title: "Cosmic Collision!", 
      description: `${originalAbsorbed?.name || 'An object'} was absorbed by ${originalAbsorber?.name || 'another object'}. Mass transferred.` 
    });

  }, [selectedObjectId, toast, objects]);

  const handleSaveState = useCallback(() => {
    try {
      const stateToSave: SavedSimulationState = {
        objects,
        simulationSpeed,
        showTrajectories,
        trajectoryLength,
        lightingMode,
        showShadows,
      };
      localStorage.setItem(LOCAL_STORAGE_SAVE_KEY, JSON.stringify(stateToSave));
      toast({ title: "Simulation Saved", description: "Current state saved to local storage." });
    } catch (error) {
      console.error("Error saving state:", error);
      toast({ title: "Save Failed", description: "Could not save simulation state.", variant: "destructive" });
    }
  }, [objects, simulationSpeed, showTrajectories, trajectoryLength, lightingMode, showShadows, toast]);

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
        setSimulationStatus('stopped');
        setSelectedObjectId(null);
        setLiveSelectedObjectData(null);
        setIsDetailsPanelOpen(false);
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
      setObjects(preset.objects.map(obj => ({...obj, id: `${obj.id}_${Date.now()}` })));
      setSimulationStatus('stopped');
      setSelectedObjectId(null);
      setLiveSelectedObjectData(null);
      setIsDetailsPanelOpen(false);
      toast({ title: "Preset Loaded", description: `"${preset.name}" scenario is ready.` });
    } else {
      toast({ title: "Preset Error", description: "Could not load the selected preset.", variant: "destructive" });
    }
  }, [toast]);

  const displayObjectForDetailsPanel = simulationStatus === 'running' && liveSelectedObjectData && liveSelectedObjectData.id === selectedObjectId
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
          <div className="w-10 h-10"> </div>
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

    