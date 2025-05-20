// src/app/page.tsx
'use client';

import React, { useState, useCallback } from 'react';
import { SidebarProvider, Sidebar, SidebarInset, SidebarContent, SidebarTrigger } from '@/components/ui/sidebar';
import SpaceTimeCanvas from '@/components/spacetime-explorer/SpaceTimeCanvas';
import ControlPanel from '@/components/spacetime-explorer/ControlPanel';
import type { SceneObject } from '@/types/spacetime';
import { DEFAULT_SIMULATION_SPEED, DEFAULT_TRAJECTORY_LENGTH } from '@/lib/constants';
import { PanelLeft } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

export default function SpacetimeExplorerPage() {
  const [objects, setObjects] = useState<SceneObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [simulationStatus, setSimulationStatus] = useState<'stopped' | 'running' | 'paused'>('stopped');
  const [simulationSpeed, setSimulationSpeed] = useState<number>(DEFAULT_SIMULATION_SPEED);
  const [showTrajectories, setShowTrajectories] = useState<boolean>(true);
  const [trajectoryLength, setTrajectoryLength] = useState<number>(DEFAULT_TRAJECTORY_LENGTH);
  const { toast } = useToast();

  const handleAddObject = useCallback((object: SceneObject) => {
    setObjects(prev => [...prev, object]);
  }, []);

  const handleUpdateObject = useCallback((updatedObject: SceneObject) => {
    setObjects(prev => prev.map(obj => obj.id === updatedObject.id ? updatedObject : obj));
  }, []);

  const handleRemoveObject = useCallback((objectId: string) => {
    setObjects(prev => prev.filter(obj => obj.id !== objectId));
    if (selectedObjectId === objectId) {
      setSelectedObjectId(null);
    }
  }, [selectedObjectId]);

  const handleSelectObject = useCallback((objectId: string | null) => {
    setSelectedObjectId(objectId);
  }, []);

  const handleResetSimulation = useCallback(() => {
    setSimulationStatus('stopped');
    // Objects will be reset to their initial prop states by SpaceTimeCanvas logic when status is 'stopped'
  }, []);

  const handleObjectsCollidedAndMerged = useCallback((absorbedObjectId: string, absorberObjectId: string, absorbedObjectMass: number) => {
    setObjects(prevObjects => {
      const absorberObject = prevObjects.find(obj => obj.id === absorberObjectId);
      
      // If absorber was already removed in a concurrent merge, do nothing for this specific event
      if (!absorberObject) return prevObjects;

      const newAbsorberMass = (absorberObject.mass || 0) + absorbedObjectMass;

      // Filter out the absorbed object and update the mass of the absorber object
      return prevObjects
        .filter(obj => obj.id !== absorbedObjectId)
        .map(obj => 
          obj.id === absorberObjectId 
            ? { ...obj, mass: newAbsorberMass } 
            : obj
        );
    });

    if (selectedObjectId === absorbedObjectId) {
      setSelectedObjectId(null);
    }
    
    const absorber = objects.find(o => o.id === absorberObjectId);
    const absorbed = objects.find(o => o.id === absorbedObjectId);
    toast({ 
      title: "Cosmic Collision!", 
      description: `${absorbed?.name || 'An object'} was absorbed by ${absorber?.name || 'another object'}. Mass transferred.` 
    });

  }, [selectedObjectId, toast, objects]);


  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar
        collapsible="icon"
        className="max-w-sm" // Removed border-r and border-sidebar-border
        variant="floating" // Changed from "sidebar" to "floating"
      >
        <SidebarContent className="p-0">
          <ControlPanel
            objects={objects}
            selectedObjectId={selectedObjectId}
            simulationStatus={simulationStatus}
            simulationSpeed={simulationSpeed}
            showTrajectories={showTrajectories}
            trajectoryLength={trajectoryLength}
            onAddObject={handleAddObject}
            onUpdateObject={handleUpdateObject}
            onRemoveObject={handleRemoveObject}
            onSelectObject={handleSelectObject}
            onSetSimulationStatus={setSimulationStatus}
            onSetSimulationSpeed={setSimulationSpeed}
            onResetSimulation={handleResetSimulation}
            onSetShowTrajectories={setShowTrajectories}
            onSetTrajectoryLength={setTrajectoryLength}
          />
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="flex flex-col h-screen bg-background">
        <header className="p-2 border-b border-border flex items-center gap-2 h-[var(--sidebar-width-icon)] md:h-auto sticky top-0 bg-background z-10">
            <SidebarTrigger>
                <PanelLeft />
            </SidebarTrigger>
            {/* Adjusted text size for better mobile display */}
            <h1 className="text-md md:text-lg font-semibold text-foreground">3D Visualization Area</h1>
        </header>
        <main className="flex-1 overflow-hidden p-1 md:p-2">
            <SpaceTimeCanvas
              objects={objects}
              simulationStatus={simulationStatus}
              simulationSpeed={simulationSpeed}
              onObjectSelected={handleSelectObject} 
              showTrajectories={showTrajectories}
              trajectoryLength={trajectoryLength}
              onObjectsCollidedAndMerged={handleObjectsCollidedAndMerged}
            />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
