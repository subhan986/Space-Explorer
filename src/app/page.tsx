
// src/app/page.tsx
'use client';

import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { SidebarProvider, Sidebar, SidebarInset, SidebarContent, SidebarTrigger } from '@/components/ui/sidebar';
import ControlPanel from '@/components/spacetime-explorer/ControlPanel';
import type { SceneObject, LightingMode } from '@/types/spacetime';
import { DEFAULT_SIMULATION_SPEED, DEFAULT_TRAJECTORY_LENGTH } from '@/lib/constants';
import { Settings, Palette } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import UICustomizer from '@/components/ui-customizer/UICustomizer';

const SpaceTimeCanvas = dynamic(() => import('@/components/spacetime-explorer/SpaceTimeCanvas'), {
  ssr: false, 
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-background">
      <Skeleton className="w-3/4 h-3/4" />
      <p className="absolute text-foreground text-lg">Loading 3D Visualization...</p>
    </div>
  ),
});

export default function SpacetimeExplorerPage() {
  const [objects, setObjects] = useState<SceneObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [simulationStatus, setSimulationStatus] = useState<'stopped' | 'running' | 'paused'>('stopped');
  const [simulationSpeed, setSimulationSpeed] = useState<number>(DEFAULT_SIMULATION_SPEED);
  const [showTrajectories, setShowTrajectories] = useState<boolean>(true);
  const [trajectoryLength, setTrajectoryLength] = useState<number>(DEFAULT_TRAJECTORY_LENGTH);
  const [showShadows, setShowShadows] = useState<boolean>(true);
  const [lightingMode, setLightingMode] = useState<LightingMode>("Realistic Solar");
  const { toast } = useToast();
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);

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
  }, []);

  const handleObjectsCollidedAndMerged = useCallback((absorbedObjectId: string, absorberObjectId: string, absorbedObjectMass: number) => {
    setObjects(prevObjects => {
      const absorberObject = prevObjects.find(obj => obj.id === absorberObjectId);
      
      if (!absorberObject) return prevObjects;

      const newAbsorberMass = (absorberObject.mass || 0) + absorbedObjectMass;

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
        collapsible="offcanvas"
        className="max-w-sm" 
        variant="floating" 
      >
        <SidebarContent className="p-0">
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
          />
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="flex flex-col h-screen bg-background">
        <header className="p-2 border-b border-border flex items-center justify-between gap-2 h-auto sticky top-0 bg-background z-10">
          {/* Left side: UI Customizer Trigger */}
          <Sheet open={isCustomizerOpen} onOpenChange={setIsCustomizerOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-md border-2 border-primary hover:bg-primary/10 active:bg-primary/20">
                <Palette className="h-5 w-5 text-primary" />
                <span className="sr-only">Open UI Customizer</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-full max-w-xs sm:max-w-sm p-0 flex flex-col overflow-y-auto">
              <UICustomizer />
            </SheetContent>
          </Sheet>

          {/* Center: App Title */}
          <h1 className="text-lg font-semibold text-foreground flex-1 text-center truncate px-2">
            Spacetime Explorer
          </h1>

          {/* Right side: Main Control Panel Sidebar Trigger */}
          <SidebarTrigger className="rounded-full">
            <Settings />
          </SidebarTrigger>
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
              showShadows={showShadows}
              lightingMode={lightingMode}
            />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
