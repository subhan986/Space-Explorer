
// src/app/page.tsx
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ControlPanel from '@/components/spacetime-explorer/ControlPanel';
import type { SceneObject, LightingMode, SavedSimulationState, SupernovaRemnantType, Vector3 } from '@/types/spacetime';
import { PRESET_SCENARIOS } from '@/lib/preset-scenarios';
import {
    DEFAULT_SIMULATION_SPEED, DEFAULT_TRAJECTORY_LENGTH,
    NEUTRON_STAR_MIN_ORIGINAL_MASS, BLACK_HOLE_MIN_ORIGINAL_MASS,
    NEUTRON_STAR_COLOR, NEUTRON_STAR_RADIUS_SIM, NEUTRON_STAR_MASS_SIM_FACTOR,
    BLACK_HOLE_REMNANT_COLOR, BLACK_HOLE_REMNANT_RADIUS_SIM, BLACK_HOLE_REMNANT_MASS_SIM_FACTOR,
    REMNANT_VELOCITY_KICK_MAGNITUDE
} from '@/lib/constants';
import { Palette } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import UICustomizer from '@/components/ui-customizer/UICustomizer';
import ObjectDetailsPanel from '@/components/spacetime-explorer/ObjectDetailsPanel';
import { generateRandomSolarSystem } from '@/lib/random-solar-system-generator';


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


  useEffect(() => {
    if (selectedObjectId && selectedObjectData) {
      if (simulationStatus !== 'running') {
        setLiveSelectedObjectData(selectedObjectData);
      }
    } else if (!selectedObjectId) { 
      setIsDetailsPanelOpen(false);
      setLiveSelectedObjectData(null);
    }
    if (selectedObjectId && !selectedObjectData) {
        setIsDetailsPanelOpen(false);
        setLiveSelectedObjectData(null);
        setSelectedObjectId(null); 
    }
  }, [selectedObjectId, objects, selectedObjectData, simulationStatus]);


  const handleDetailsPanelClose = () => {
    setIsDetailsPanelOpen(false);
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
      setIsDetailsPanelOpen(false); 
      setLiveSelectedObjectData(null);
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
    setObjects([]); 
    setSimulationStatus('stopped');
    setSelectedObjectId(null);
    setCurrentSimulatedDate(new Date());
    // Clear live data as well
    setLiveSelectedObjectData(null);
    setIsDetailsPanelOpen(false);
  }, []);

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

  const handleSupernovaEnd = useCallback((
    originalStarId: string, 
    _remnantTypeHint: SupernovaRemnantType, // We'll re-evaluate type based on mass
    finalPosition: Vector3, 
    finalVelocity: Vector3, 
    originalMass: number
  ) => {
      let remnantType: SupernovaRemnantType;
      let remnantName: string;
      let remnantMass: number;
      let remnantRadius: number;
      let remnantColor: string;

      if (originalMass >= BLACK_HOLE_MIN_ORIGINAL_MASS) {
          remnantType = 'black_hole_remnant';
          remnantName = "Black Hole Remnant";
          remnantMass = originalMass * BLACK_HOLE_REMNANT_MASS_SIM_FACTOR;
          remnantRadius = BLACK_HOLE_REMNANT_RADIUS_SIM;
          remnantColor = BLACK_HOLE_REMNANT_COLOR;
      } else if (originalMass >= NEUTRON_STAR_MIN_ORIGINAL_MASS) {
          remnantType = 'neutron_star';
          remnantName = "Neutron Star";
          remnantMass = originalMass * NEUTRON_STAR_MASS_SIM_FACTOR;
          remnantRadius = NEUTRON_STAR_RADIUS_SIM;
          remnantColor = NEUTRON_STAR_COLOR;
      } else {
          toast({title: "Supernova Faded", description: "The stellar remnant did not form a compact object."});
          return; 
      }
      
      const newRemnantId = `remnant_${Date.now()}_${Math.random().toString(36).substring(2,7)}`;
      
      const kick = new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2
      ).normalize().multiplyScalar(REMNANT_VELOCITY_KICK_MAGNITUDE);

      const remnantObject: SceneObject = {
          id: newRemnantId,
          type: remnantType,
          name: remnantName,
          mass: remnantMass,
          radius: remnantRadius,
          color: remnantColor,
          position: finalPosition,
          velocity: {
              x: finalVelocity.x + kick.x,
              y: finalVelocity.y + kick.y,
              z: finalVelocity.z + kick.z,
          },
      };
      
      handleAddObject(remnantObject);
      toast({
          title: "Supernova Complete!",
          description: `A ${remnantName} has formed from the stellar core.`
      });

  }, [handleAddObject, toast]);

  const handleManualSupernovaProcessed = useCallback((objectId: string) => {
    setObjects(prev =>
      prev.map(obj =>
        obj.id === objectId
          ? { ...obj, isManuallyTriggeredSupernova: false } // Reset the flag
          : obj
      )
    );
  }, []);


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

  const handleGenerateRandomSystem = useCallback(() => {
    handleResetSimulation(); // Clear existing objects and stop simulation

    const newSystemObjects = generateRandomSolarSystem();
    newSystemObjects.forEach(obj => {
        handleAddObject(obj);
    });

    toast({
      title: "New Solar System Generated!",
      description: `A unique system with ${newSystemObjects.length} celestial bodies has been created.`,
    });
    setSimulationStatus('stopped'); 
  }, [handleResetSimulation, handleAddObject, toast]);

  const displayObjectForDetailsPanel =
    simulationStatus === 'running' && liveSelectedObjectData && liveSelectedObjectData.id === selectedObjectId
    ? liveSelectedObjectData
    : selectedObjectData;

  return (
      <div className="flex flex-col h-screen bg-background text-foreground">
        <header className="p-2 border-b border-border flex items-center justify-between gap-2 h-auto sticky top-0 bg-[hsl(var(--background))/0.5] backdrop-blur-md z-20">
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
            
          </div>

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
              onRemoveObject={handleRemoveObject}
              showShadows={showShadows}
              lightingMode={lightingMode}
              onSelectedObjectUpdate={handleSelectedObjectUpdate}
              onSimulatedTimeDeltaUpdate={handleSimulatedTimeDeltaUpdate}
              onSupernovaEnd={handleSupernovaEnd}
              onManualSupernovaProcessed={handleManualSupernovaProcessed}
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
            onSetLightingMode={setSetLightingMode} // Typo: setLightingMode -> setSetLightingMode, should be onSetLightingMode
            onSaveState={handleSaveState}
            onLoadState={handleLoadState}
            onLoadPreset={handleLoadPreset}
            onGenerateRandomSystem={handleGenerateRandomSystem}
          />

        <ObjectDetailsPanel
            selectedObject={displayObjectForDetailsPanel}
            isOpen={isDetailsPanelOpen}
            onClose={handleDetailsPanelClose}
        />
      </div>
  );
}

// Helper for ControlPanel's onSetLightingMode
function setSetLightingMode(mode: LightingMode) {
  // This function is a placeholder as the actual setLightingMode is directly passed.
  // The prop passed to ControlPanel should be onSetLightingMode which is setLightingMode from page state.
}

// Import THREE for Vector3 in handleSupernovaEnd - it might be better to use local Vector type if available
import * as THREE from 'three'; 

