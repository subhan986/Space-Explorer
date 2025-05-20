
// src/components/spacetime-explorer/SpacecraftDesigner2D.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Cog, Shield, ScanEye, PlusSquare, Trash2, Save, Grab } from 'lucide-react';
import Image from 'next/image';

interface SpacecraftPart {
  id: string;
  name: string;
  type: 'engine' | 'hull' | 'sensor' | 'weapon';
  icon: React.ReactNode;
  description: string;
  width: number;
  height: number;
  imageSrc?: string;
  color: string;
}

interface DesignedPart {
  instanceId: string;
  partId: string;
  x: number;
  y: number;
  rotation: number;
}

interface DragInfo {
  instanceId: string;
  startX: number; // part's x at drag start
  startY: number; // part's y at drag start
  pointerStartX: number; // mouse x at drag start (client viewport coords)
  pointerStartY: number; // mouse y at drag start (client viewport coords)
}

const availableParts: SpacecraftPart[] = [
  { id: 'engine_basic', name: 'Basic Ion Engine', type: 'engine', icon: <Cog className="h-5 w-5" />, description: 'Low thrust, high efficiency.', width: 40, height: 60, color: 'hsl(var(--primary))', imageSrc: 'https://placehold.co/40x60.png?text=Eng' },
  { id: 'hull_small', name: 'Small Hull Segment', type: 'hull', icon: <Shield className="h-5 w-5" />, description: 'Basic structural component.', width: 50, height: 50, color: 'hsl(var(--secondary))', imageSrc: 'https://placehold.co/50x50.png?text=Hull' },
  { id: 'sensor_short', name: 'Short-Range Scanner', type: 'sensor', icon: <ScanEye className="h-5 w-5" />, description: 'Detects nearby objects.', width: 30, height: 30, color: 'hsl(var(--accent))', imageSrc: 'https://placehold.co/30x30.png?text=Sen' },
];

const SpacecraftDesigner2D: React.FC = () => {
  const [designedParts, setDesignedParts] = useState<DesignedPart[]>([]);
  const [selectedPartInstanceId, setSelectedPartInstanceId] = useState<string | null>(null);
  
  const dragInfoRef = useRef<DragInfo | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const designCanvasRef = useRef<HTMLDivElement>(null);

  const handleAddPartToCanvas = (part: SpacecraftPart) => {
    const newDesignedPart: DesignedPart = {
      instanceId: `inst_${part.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      partId: part.id,
      x: 50,
      y: 50,
      rotation: 0,
    };
    setDesignedParts(prev => [...prev, newDesignedPart]);
  };
  
  const selectedPartDetails = designedParts.find(p => p.instanceId === selectedPartInstanceId);

  const handleUpdateSelectedPart = (updates: Partial<Omit<DesignedPart, 'instanceId' | 'partId'>>) => {
    if (selectedPartInstanceId) {
      setDesignedParts(prev =>
        prev.map(p =>
          p.instanceId === selectedPartInstanceId ? { ...p, ...updates } : p
        )
      );
    }
  };

  const handleRemoveSelectedPart = () => {
    if (selectedPartInstanceId) {
      setDesignedParts(prev => prev.filter(p => p.instanceId !== selectedPartInstanceId));
      setSelectedPartInstanceId(null);
    }
  };

  const handleClearDesign = () => {
    setDesignedParts([]);
    setSelectedPartInstanceId(null);
  };

  const handleBuildSpacecraft = () => {
    alert('Spacecraft "Build" function not yet implemented. Design data: ' + JSON.stringify(designedParts));
  };

  const handlePartMouseDown = (
    event: React.MouseEvent<HTMLDivElement>,
    part: DesignedPart
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedPartInstanceId(part.instanceId);
    dragInfoRef.current = {
      instanceId: part.instanceId,
      startX: part.x,
      startY: part.y,
      pointerStartX: event.clientX,
      pointerStartY: event.clientY,
    };
    setIsDragging(true);
  };

  const handleGlobalMouseMove = useCallback((event: MouseEvent) => {
    if (!dragInfoRef.current) return;

    const { instanceId, startX, startY, pointerStartX, pointerStartY } = dragInfoRef.current;
    const deltaX = event.clientX - pointerStartX;
    const deltaY = event.clientY - pointerStartY;
    const newX = startX + deltaX;
    const newY = startY + deltaY;

    setDesignedParts(currentParts =>
      currentParts.map(p =>
        p.instanceId === instanceId ? { ...p, x: newX, y: newY } : p
      )
    );
  }, [setDesignedParts]);

  const handleGlobalMouseUp = useCallback(() => {
    if (dragInfoRef.current) {
        dragInfoRef.current = null;
        setIsDragging(false);
    }
  }, [setIsDragging]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.body.style.cursor = 'grabbing';
    } else {
      document.body.style.cursor = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.body.style.cursor = '';
    };
  }, [isDragging, handleGlobalMouseMove, handleGlobalMouseUp]);


  return (
    <div className="flex flex-col md:flex-row gap-4 h-full">
      <Card className="w-full md:w-1/3 bg-card text-card-foreground border-sidebar-border">
        <CardHeader className="p-3">
          <CardTitle className="text-lg text-sidebar-foreground">Parts Palette</CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <ScrollArea className="h-[200px] md:h-[calc(100vh_-_200px)] pr-2">
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

      <div className="flex-1 flex flex-col gap-4">
        <Card className="flex-1 bg-card text-card-foreground border-sidebar-border relative">
          <CardHeader className="p-3">
            <CardTitle className="text-lg text-sidebar-foreground">Design Canvas</CardTitle>
            <CardDescription className="text-sidebar-muted-foreground">Click parts to select, drag to move. Edit below.</CardDescription>
          </CardHeader>
          <CardContent className="p-1 h-[300px] md:h-auto md:flex-grow">
            <div
              ref={designCanvasRef}
              className="w-full h-full bg-input rounded-md border-2 border-dashed border-sidebar-border flex items-center justify-center relative overflow-hidden"
              // onClick={() => setSelectedPartInstanceId(null)} // Deselect on canvas click
            >
              {designedParts.map(dp => {
                const partDef = availableParts.find(p => p.id === dp.partId);
                if (!partDef) return null;
                return (
                  <div
                    key={dp.instanceId}
                    onMouseDown={(e) => handlePartMouseDown(e, dp)}
                    style={{
                      position: 'absolute',
                      left: `${dp.x}px`,
                      top: `${dp.y}px`,
                      width: `${partDef.width}px`,
                      height: `${partDef.height}px`,
                      transform: `rotate(${dp.rotation}deg)`,
                      backgroundColor: partDef.imageSrc ? 'transparent' : partDef.color,
                      border: dp.instanceId === selectedPartInstanceId ? '2px solid hsl(var(--ring))' : '1px solid hsl(var(--border))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: isDragging && dragInfoRef.current?.instanceId === dp.instanceId ? 'grabbing' : 'grab',
                      userSelect: 'none', // Prevent text selection while dragging
                    }}
                    className="transition-all hover:ring-2 hover:ring-ring"
                    title={partDef.name}
                  >
                    {partDef.imageSrc ?
                        <Image src={partDef.imageSrc} alt={partDef.name} width={partDef.width} height={partDef.height} className="object-contain pointer-events-none" data-ai-hint="spacecraft part" /> :
                        (React.cloneElement(partDef.icon as React.ReactElement, { className: 'h-1/2 w-1/2 text-white/70 pointer-events-none' }))}
                  </div>
                );
              })}
               {designedParts.length === 0 && <p className="text-sidebar-muted-foreground text-center p-4">Add parts from the palette to begin.</p>}
            </div>
          </CardContent>
        </Card>

        {selectedPartDetails && (
          <Card className="bg-card text-card-foreground border-sidebar-border">
            <CardHeader className="p-3">
              <CardTitle className="text-md text-sidebar-foreground">Edit: {availableParts.find(p=>p.id === selectedPartDetails.partId)?.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-3">
              <div className="grid grid-cols-3 gap-2 items-center">
                <div>
                  <label htmlFor="partX" className="text-xs text-sidebar-muted-foreground block mb-1">X Pos:</label>
                  <input type="number" id="partX" value={Math.round(selectedPartDetails.x)} onChange={e => handleUpdateSelectedPart({x: parseInt(e.target.value) || 0})} className="bg-input border border-sidebar-border rounded p-1 w-full text-sidebar-foreground text-sm" />
                </div>
                <div>
                  <label htmlFor="partY" className="text-xs text-sidebar-muted-foreground block mb-1">Y Pos:</label>
                  <input type="number" id="partY" value={Math.round(selectedPartDetails.y)} onChange={e => handleUpdateSelectedPart({y: parseInt(e.target.value) || 0})} className="bg-input border border-sidebar-border rounded p-1 w-full text-sidebar-foreground text-sm" />
                </div>
                <div>
                  <label htmlFor="partRot" className="text-xs text-sidebar-muted-foreground block mb-1">Rotation (&deg;):</label>
                  <input type="number" id="partRot" value={selectedPartDetails.rotation} onChange={e => handleUpdateSelectedPart({rotation: parseInt(e.target.value) || 0})} className="bg-input border border-sidebar-border rounded p-1 w-full text-sidebar-foreground text-sm" />
                </div>
              </div>
              <Button size="sm" variant="destructive" onClick={handleRemoveSelectedPart} className="w-full">
                <Trash2 className="mr-2 h-4 w-4"/> Remove Selected Part
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2 mt-auto">
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
