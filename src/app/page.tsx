// src/app/page.tsx
'use client';

import React, { useState, useCallback } from 'react';
import { SidebarProvider, Sidebar, SidebarInset, SidebarHeader, SidebarContent, SidebarTrigger } from '@/components/ui/sidebar';
import SpaceTimeCanvas from '@/components/spacetime-explorer/SpaceTimeCanvas';
import ControlPanel from '@/components/spacetime-explorer/ControlPanel';
import type { SceneObject, MassiveObject, OrbiterObject } from '@/types/spacetime';
import { DEFAULT_SIMULATION_SPEED, DEFAULT_TRAJECTORY_LENGTH } from '@/lib/constants';
import { PanelLeft } from 'lucide-react'; // Sidebar toggle icon

export default function SpacetimeExplorerPage() {
  const [objects, setObjects] = useState<SceneObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [simulationStatus, setSimulationStatus] = useState<'stopped' | 'running' | 'paused'>('stopped');
  const [simulationSpeed, setSimulationSpeed] = useState<number>(DEFAULT_SIMULATION_SPEED);
  const [showTrajectories, setShowTrajectories] = useState<boolean>(true);
  const [trajectoryLength, setTrajectoryLength] = useState<number>(DEFAULT_TRAJECTORY_LENGTH);

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
    // This could also reset objects to initial states if those are stored
    // For now, just stops simulation and could clear dynamic data like trajectories if needed by canvas
    setSimulationStatus('stopped');
    // Optionally, reset object positions/velocities to some initial configuration or clear them
    // setObjects([]); // Example: Clears all objects
    // setSelectedObjectId(null);
  }, []);

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar
        collapsible="icon"
        className="max-w-sm border-r border-sidebar-border"
        variant="sidebar"
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
            <SidebarTrigger className="md:hidden"> {/* Only show trigger on mobile if sidebar is collapsible off-canvas */}
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
              onObjectSelected={handleSelectObject} // Optional for canvas-based selection
              showTrajectories={showTrajectories}
              trajectoryLength={trajectoryLength}
            />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

    