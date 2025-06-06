
// src/components/spacetime-explorer/ObjectDetailsPanel.tsx
'use client';

import React from 'react';
import { Sheet, SheetContent, SheetClose } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SceneObject } from '@/types/spacetime';
import { REAL_OBJECT_DEFINITIONS } from '@/lib/real-objects';
import { 
  Orbit, Thermometer, Atom, Ruler, Sigma, Info, FileText, Scale, Gauge, RotateCw, Move, Layers, Blend, Paintbrush, CircleIcon, XIcon
} from 'lucide-react';
import Image from 'next/image';

interface ObjectDetailsPanelProps {
  selectedObject: SceneObject | null | undefined;
  isOpen: boolean;
  onClose: () => void;
}

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  unit?: string;
}

const DetailRow: React.FC<DetailRowProps> = ({ icon, label, value, unit }) => (
  <div className="flex items-center py-2 border-b border-border/50">
    <div className="flex items-center gap-3 w-2/5 text-muted-foreground">
      {React.cloneElement(icon as React.ReactElement, { className: "h-4 w-4" })}
      <span className="text-sm">{label}</span>
    </div>
    <div className="flex-1 text-right text-sm text-foreground font-medium">
      {value} {unit && <span className="text-xs text-muted-foreground ml-1">{unit}</span>}
    </div>
  </div>
);


const ObjectDetailsPanel: React.FC<ObjectDetailsPanelProps> = ({ selectedObject, isOpen, onClose }) => {
  if (!selectedObject) {
    return null;
  }

  const definitionKey = selectedObject.name.toUpperCase().replace(/\s+/g, '');
  const definition = REAL_OBJECT_DEFINITIONS[definitionKey] || REAL_OBJECT_DEFINITIONS[selectedObject.name];

  const calculateSpeed = (velocity: { x: number; y: number; z: number }): number => {
    return Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
  };

  const currentSpeed = calculateSpeed(selectedObject.velocity);

  const subtitle = definition?.isPlanet 
    ? `Planet orbiting ${definition.orbits || 'N/A'}` 
    : (selectedObject.type === 'massive' ? 'Massive stellar object' : `Orbiter (Type: ${selectedObject.type})`);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent 
        side="right" 
        className="w-full max-w-md p-0 flex flex-col bg-card text-card-foreground shadow-xl border-l border-border"
        onInteractOutside={(e) => e.preventDefault()} // Prevents closing on outside click if desired
      >
        {/* Top Image Placeholder and Header */}
        <div className="p-4 border-b border-border">
          <div 
            className="w-full h-40 bg-muted rounded-md mb-3 flex items-center justify-center"
            style={{backgroundImage: `url(https://placehold.co/600x400.png/222222/555555?text=${selectedObject.name.charAt(0)})`, backgroundSize:'cover', backgroundPosition: 'center'}}
            data-ai-hint="celestial body texture"
          >
            {/* Future: Could use next/image if specific images were available per object */}
             {/* <span className="text-4xl font-bold text-muted-foreground">{selectedObject.name.charAt(0)}</span> */}
          </div>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-foreground">{selectedObject.name}</h2>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <XIcon className="h-5 w-5" />
              </Button>
            </SheetClose>
          </div>
          {/* Placeholder for header icon buttons from the image */}
        </div>

        <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 mt-2 bg-transparent p-0 border-b border-border rounded-none justify-start">
            <TabsTrigger value="overview" className="data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-3 py-2 text-sm">
              <CircleIcon className="mr-2 h-4 w-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="motion" className="data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-3 py-2 text-sm">
              <Move className="mr-2 h-4 w-4" /> Motion
            </TabsTrigger>
            <TabsTrigger value="surface" className="data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-3 py-2 text-sm">
              <Layers className="mr-2 h-4 w-4" /> Surface
            </TabsTrigger>
            <TabsTrigger value="composition" className="data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-3 py-2 text-sm">
              <Blend className="mr-2 h-4 w-4" /> Composition
            </TabsTrigger>
            <TabsTrigger value="visuals" className="data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-3 py-2 text-sm">
              <Paintbrush className="mr-2 h-4 w-4" /> Visuals
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            <TabsContent value="overview" className="p-4 space-y-1 mt-0">
              <DetailRow icon={<FileText />} label="Name" value={selectedObject.name} />
              <DetailRow 
                icon={<Scale />} 
                label="Mass (Sim)" 
                value={selectedObject.mass.toExponential(2)} 
                unit="units"
              />
              {definition?.massEarthUnits && (
                <DetailRow icon={<Scale />} label="Mass (Real)" value={definition.massEarthUnits} />
              )}
               <DetailRow 
                icon={<Ruler />} 
                label="Radius (Sim)" 
                value={selectedObject.radius.toFixed(1)} 
                unit="units"
              />
              {definition?.radiusEarthUnits && (
                <DetailRow icon={<Ruler />} label="Radius (Real)" value={definition.radiusEarthUnits} />
              )}
              {definition?.density && (
                <DetailRow icon={<Atom />} label="Density" value={definition.density} />
              )}
              {definition?.avgTemperature && (
                <DetailRow icon={<Thermometer />} label="Avg Temp." value={definition.avgTemperature} />
              )}
              <DetailRow 
                icon={<Gauge />} 
                label="Speed (Sim)" 
                value={currentSpeed.toFixed(2)}
                unit="units/s"
              />
               {definition?.typicalSpeedKmS && (
                <DetailRow icon={<Gauge />} label="Typical Speed" value={definition.typicalSpeedKmS} />
              )}
              {definition?.rotationalPeriod && (
                <DetailRow icon={<RotateCw />} label="Rotational Period" value={definition.rotationalPeriod} />
              )}
              {definition?.orbitalPeriodDisplay && (
                <DetailRow icon={<Orbit />} label="Orbital Period" value={definition.orbitalPeriodDisplay} />
              )}
            </TabsContent>

            <TabsContent value="motion" className="p-4 mt-0">
              <h3 className="text-lg font-semibold mb-2 text-primary">Motion Details</h3>
              <DetailRow icon={<Sigma />} label="Position X" value={selectedObject.position.x.toFixed(2)} unit="units"/>
              <DetailRow icon={<Sigma />} label="Position Y" value={selectedObject.position.y.toFixed(2)} unit="units"/>
              <DetailRow icon={<Sigma />} label="Position Z" value={selectedObject.position.z.toFixed(2)} unit="units"/>
              <div className="my-2 border-b border-border/50"></div>
              <DetailRow icon={<Gauge />} label="Velocity X" value={selectedObject.velocity.x.toFixed(2)} unit="units/s"/>
              <DetailRow icon={<Gauge />} label="Velocity Y" value={selectedObject.velocity.y.toFixed(2)} unit="units/s"/>
              <DetailRow icon={<Gauge />} label="Velocity Z" value={selectedObject.velocity.z.toFixed(2)} unit="units/s"/>
               <div className="my-2 border-b border-border/50"></div>
              <DetailRow icon={<Gauge />} label="Current Speed" value={currentSpeed.toFixed(2)} unit="units/s"/>
            </TabsContent>

            <TabsContent value="surface" className="p-4 mt-0">
              <h3 className="text-lg font-semibold mb-2 text-primary">Surface Information</h3>
              <p className="text-sm text-muted-foreground">Detailed surface characteristics will be available here.</p>
              {definition?.description && (
                <div className="mt-2 text-sm bg-muted/30 p-3 rounded-md border border-border/50">
                    <p className="font-semibold mb-1">Description:</p>
                    {definition.description}
                </div>
              )}
            </TabsContent>

            <TabsContent value="composition" className="p-4 mt-0">
              <h3 className="text-lg font-semibold mb-2 text-primary">Composition Details</h3>
              {definition?.composition ? (
                <p className="text-sm bg-muted/30 p-3 rounded-md border border-border/50">{definition.composition}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No detailed composition data available.</p>
              )}
            </TabsContent>

            <TabsContent value="visuals" className="p-4 mt-0">
              <h3 className="text-lg font-semibold mb-2 text-primary">Visual Parameters</h3>
              <DetailRow icon={<Paintbrush />} label="Color (Hex)" value={selectedObject.color.toUpperCase()} />
              <DetailRow icon={<Ruler />} label="Visual Radius" value={selectedObject.radius.toFixed(1)} unit="sim units" />
              {/* Future: Add texture information if applicable */}
            </TabsContent>
          </ScrollArea>
        </Tabs>
        
        {/* Removed SheetFooter for a cleaner look consistent with the image */}
      </SheetContent>
    </Sheet>
  );
};

export default ObjectDetailsPanel;
