// src/components/spacetime-explorer/SpacecraftDesigner2D.tsx
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Cog, Shield, ScanEye, PlusSquare, Trash2, Save } from 'lucide-react';
import Image from 'next/image'; // For placeholder part images

// Define a type for spacecraft parts
interface SpacecraftPart {
  id: string;
  name: string;
  type: 'engine' | 'hull' | 'sensor' | 'weapon'; // Add more types as needed
  icon: React.ReactNode; // Icon for the palette
  description: string;
  // Potentially add properties like mass, thrust, powerConsumption, etc.
  // For 2D representation:
  width: number; // in design units
  height: number; // in design units
  imageSrc?: string; // path to an image for the part
  color: string; // fallback color
}

// Define a type for a part placed on the design canvas
interface DesignedPart {
  instanceId: string; // Unique ID for this instance of the part
  partId: string; // ID from the availableParts list
  x: number; // position on canvas
  y: number; // position on canvas
  rotation: number; // degrees
}

const availableParts: SpacecraftPart[] = [
  { id: 'engine_basic', name: 'Basic Ion Engine', type: 'engine', icon: <Cog className="h-5 w-5" />, description: 'Low thrust, high efficiency.', width: 20, height: 30, color: 'hsl(var(--primary))', imageSrc: 'https://placehold.co/40x60.png?text=Eng' },
  { id: 'hull_small', name: 'Small Hull Segment', type: 'hull', icon: <Shield className="h-5 w-5" />, description: 'Basic structural component.', width: 50, height: 50, color: 'hsl(var(--secondary))', imageSrc: 'https://placehold.co/50x50.png?text=Hull' },
  { id: 'sensor_short', name: 'Short-Range Scanner', type: 'sensor', icon: <ScanEye className="h-5 w-5" />, description: 'Detects nearby objects.', width: 15, height: 15, color: 'hsl(var(--accent))', imageSrc: 'https://placehold.co/30x30.png?text=Sen' },
];

const SpacecraftDesigner2D: React.FC = () => {
  const [designedParts, setDesignedParts] = useState<DesignedPart[]>([]);
  const [selectedPart, setSelectedPart] = useState<DesignedPart | null>(null);

  // Placeholder functions - actual implementation is complex
  const handleAddPartToCanvas = (part: SpacecraftPart) => {
    const newDesignedPart: DesignedPart = {
      instanceId: `inst_${part.id}_${Date.now()}`,
      partId: part.id,
      x: 50, // Default spawn position
      y: 50,
      rotation: 0,
    };
    setDesignedParts([...designedParts, newDesignedPart]);
    // In a real implementation: drag-and-drop logic would set initial x,y
  };

  const handleSelectPartOnCanvas = (instanceId: string) => {
    const part = designedParts.find(p => p.instanceId === instanceId);
    setSelectedPart(part || null);
    // In a real implementation: clicking on the canvas representation
  };
  
  const handleUpdateSelectedPart = (updates: Partial<DesignedPart>) => {
    if (selectedPart) {
      setDesignedParts(prev => prev.map(p => p.instanceId === selectedPart.instanceId ? {...p, ...updates} : p));
      setSelectedPart(prev => prev ? {...prev, ...updates} : null);
    }
  };

  const handleRemoveSelectedPart = () => {
    if (selectedPart) {
      setDesignedParts(prev => prev.filter(p => p.instanceId !== selectedPart.instanceId));
      setSelectedPart(null);
    }
  };

  const handleClearDesign = () => {
    setDesignedParts([]);
    setSelectedPart(null);
  };

  const handleBuildSpacecraft = () => {
    // In a real implementation:
    // 1. Validate the design (e.g., all necessary parts present, connections are valid)
    // 2. Convert the 2D layout of 'designedParts' into a 3D SceneObject definition
    //    (This is the most complex part: determining mass, center of mass, thrust vectors, visual model etc.)
    // 3. Call a prop function to add this new spacecraft to the main simulation
    alert('Spacecraft "Build" function not yet implemented. Design data: ' + JSON.stringify(designedParts));
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 h-full p-1">
      {/* Parts Palette */}
      <Card className="w-full md:w-1/3 bg-card text-card-foreground border-sidebar-border">
        <CardHeader className="p-3">
          <CardTitle className="text-lg text-sidebar-foreground">Parts Palette</CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <ScrollArea className="h-[200px] md:h-[calc(100%-4rem)] pr-2">
            <div className="space-y-2">
              {availableParts.map((part) => (
                <div key={part.id} className="p-2 border border-input rounded-md hover:bg-sidebar-accent/50">
                  <div className="flex items-center gap-2 mb-1">
                    {part.icon}
                    <span className="font-semibold text-sidebar-foreground">{part.name}</span>
                  </div>
                  <p className="text-xs text-sidebar-muted-foreground mb-2">{part.description}</p>
                  <Button size="sm" onClick={() => handleAddPartToCanvas(part)} className="w-full bg-sidebar-primary hover:bg-sidebar-primary/80 text-sidebar-primary-foreground">
                    <PlusSquare className="mr-2 h-4 w-4" /> Add to Design
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Design Canvas & Controls */}
      <div className="flex-1 flex flex-col gap-4">
        <Card className="flex-1 bg-card text-card-foreground border-sidebar-border relative">
          <CardHeader className="p-3">
            <CardTitle className="text-lg text-sidebar-foreground">Design Canvas</CardTitle>
            <CardDescription className="text-sidebar-muted-foreground">Drag and arrange parts here. (Interaction not yet implemented)</CardDescription>
          </CardHeader>
          <CardContent className="p-1 h-[300px] md:h-auto md:flex-grow">
            {/* Actual 2D Canvas would go here (e.g., HTML5 Canvas or SVG) */}
            <div 
              className="w-full h-full bg-input rounded-md border-2 border-dashed border-sidebar-border flex items-center justify-center relative overflow-hidden"
              // onClick={(e) => { /* Logic to deselect if clicking background */ setSelectedPart(null); }}
            >
              {designedParts.map(dp => {
                const partDef = availableParts.find(p => p.id === dp.partId);
                if (!partDef) return null;
                return (
                  <div
                    key={dp.instanceId}
                    onClick={(e) => { e.stopPropagation(); handleSelectPartOnCanvas(dp.instanceId); }}
                    style={{
                      position: 'absolute',
                      left: `${dp.x}px`,
                      top: `${dp.y}px`,
                      width: `${partDef.width}px`,
                      height: `${partDef.height}px`,
                      transform: `rotate(${dp.rotation}deg)`,
                      backgroundColor: partDef.color,
                      border: dp.instanceId === selectedPart?.instanceId ? '2px solid hsl(var(--ring))' : '1px solid hsl(var(--border))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'grab', // Placeholder for draggable
                    }}
                    className="transition-all"
                    title={partDef.name}
                  >
                    {partDef.imageSrc ? 
                        <Image src={partDef.imageSrc} alt={partDef.name} width={partDef.width} height={partDef.height} className="object-contain pointer-events-none" data-ai-hint="spacecraft part" /> : 
                        (React.cloneElement(partDef.icon as React.ReactElement, { className: 'h-1/2 w-1/2 text-white/70 pointer-events-none' }))}
                  </div>
                );
              })}
               {designedParts.length === 0 && <p className="text-sidebar-muted-foreground text-center p-4">Add parts from the palette.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Properties Editor & Actions - Shown if a part is selected */}
        {selectedPart && (
          <Card className="bg-card text-card-foreground border-sidebar-border">
            <CardHeader className="p-3">
              <CardTitle className="text-md text-sidebar-foreground">Edit: {availableParts.find(p=>p.id === selectedPart.partId)?.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              <div>
                <label htmlFor="partX" className="text-xs text-sidebar-muted-foreground">X: </label>
                <input type="number" id="partX" value={selectedPart.x} onChange={e => handleUpdateSelectedPart({x: parseInt(e.target.value) || 0})} className="bg-input border border-sidebar-border rounded p-1 w-16 text-sidebar-foreground" />
                <label htmlFor="partY" className="text-xs text-sidebar-muted-foreground ml-2">Y: </label>
                <input type="number" id="partY" value={selectedPart.y} onChange={e => handleUpdateSelectedPart({y: parseInt(e.target.value) || 0})} className="bg-input border border-sidebar-border rounded p-1 w-16 text-sidebar-foreground" />
                <label htmlFor="partRot" className="text-xs text-sidebar-muted-foreground ml-2">Rot: </label>
                <input type="number" id="partRot" value={selectedPart.rotation} onChange={e => handleUpdateSelectedPart({rotation: parseInt(e.target.value) || 0})} className="bg-input border border-sidebar-border rounded p-1 w-16 text-sidebar-foreground" />
              </div>
              <Button size="sm" variant="destructive" onClick={handleRemoveSelectedPart} className="w-full">
                <Trash2 className="mr-2 h-4 w-4"/> Remove Selected Part
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2 mt-auto p-1">
          <Button size="sm" variant="outline" onClick={handleClearDesign} className="border-sidebar-primary text-sidebar-primary hover:bg-sidebar-primary/10">
            <Trash2 className="mr-2 h-4 w-4" /> Clear Design
          </Button>
          <Button size="sm" onClick={handleBuildSpacecraft} className="flex-1 bg-sidebar-primary hover:bg-sidebar-primary/80 text-sidebar-primary-foreground">
            <Save className="mr-2 h-4 w-4" /> Build Spacecraft
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SpacecraftDesigner2D;
