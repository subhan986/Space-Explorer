
// src/components/spacetime-explorer/ObjectDetailsPanel.tsx
'use client';

import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { SceneObject } from '@/types/spacetime';
import { REAL_OBJECT_DEFINITIONS } from '@/lib/real-objects';
import { Badge } from '@/components/ui/badge'; // For object type
import { Orbit, Thermometer, Atom, Ruler, Sigma, Info } from 'lucide-react'; // Icons

interface ObjectDetailsPanelProps {
  selectedObject: SceneObject | null | undefined;
  isOpen: boolean;
  onClose: () => void;
}

const DetailItem: React.FC<{ label: string; value: React.ReactNode; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="flex justify-between items-center py-1.5 text-sm">
    <div className="flex items-center gap-2 text-muted-foreground">
      {icon}
      <span>{label}:</span>
    </div>
    <span className="text-right text-foreground font-medium truncate" title={typeof value === 'string' || typeof value === 'number' ? String(value) : undefined}>
      {value || 'N/A'}
    </span>
  </div>
);

const ObjectDetailsPanel: React.FC<ObjectDetailsPanelProps> = ({ selectedObject, isOpen, onClose }) => {
  if (!selectedObject) {
    return null;
  }

  const definition = REAL_OBJECT_DEFINITIONS[selectedObject.name.toUpperCase().replace(/\s+/g, '')] || 
                     REAL_OBJECT_DEFINITIONS[selectedObject.name];


  const calculateSpeed = (velocity: { x: number; y: number; z: number }): number => {
    return Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
  };

  const currentSpeed = calculateSpeed(selectedObject.velocity);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full max-w-md p-0 flex flex-col bg-card text-card-foreground shadow-xl">
        <SheetHeader className="p-4 border-b border-border sticky top-0 bg-card z-10">
          <SheetTitle className="text-xl flex items-center gap-2">
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: selectedObject.color }} />
            {selectedObject.name}
          </SheetTitle>
          <SheetDescription className="text-xs">
            Detailed information about the selected celestial body.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 p-4 space-y-4">
          <section>
            <h3 className="text-lg font-semibold mb-2 text-primary flex items-center gap-2"><Info className="h-5 w-5"/>Overview</h3>
            <div className="space-y-1 bg-background/50 p-3 rounded-md border border-border">
              <DetailItem label="Type" value={<Badge variant="secondary" className="capitalize">{selectedObject.type}</Badge>} />
              <DetailItem label="Mass (Sim Units)" value={selectedObject.mass.toExponential(2)} />
              {definition?.realMassKg && <DetailItem label="Real Mass" value={definition.realMassKg} />}
              <DetailItem label="Radius (Sim Units)" value={selectedObject.radius.toFixed(1)} icon={<Ruler className="h-4 w-4"/>} />
            </div>
          </section>
          
          <Separator />

          <section>
            <h3 className="text-lg font-semibold mb-2 text-primary flex items-center gap-2"><Atom className="h-5 w-5"/>Physical Properties</h3>
            <div className="space-y-1 bg-background/50 p-3 rounded-md border border-border">
              {definition?.composition && <DetailItem label="Composition" value={definition.composition} />}
              {definition?.description && (
                <div className="pt-1">
                  <p className="text-xs text-muted-foreground mb-1">Description:</p>
                  <p className="text-sm text-foreground">{definition.description}</p>
                </div>
              )}
              {!definition?.composition && !definition?.description && <p className="text-sm text-muted-foreground italic">No detailed physical properties available.</p>}
            </div>
          </section>

          <Separator />
          
          <section>
            <h3 className="text-lg font-semibold mb-2 text-primary flex items-center gap-2"><Sigma className="h-5 w-5"/>Dynamics</h3>
             <div className="space-y-1 bg-background/50 p-3 rounded-md border border-border">
                <DetailItem label="Position X" value={selectedObject.position.x.toFixed(2)} />
                <DetailItem label="Position Y" value={selectedObject.position.y.toFixed(2)} />
                <DetailItem label="Position Z" value={selectedObject.position.z.toFixed(2)} />
                <Separator className="my-1"/>
                <DetailItem label="Velocity X" value={selectedObject.velocity.x.toFixed(2)} />
                <DetailItem label="Velocity Y" value={selectedObject.velocity.y.toFixed(2)} />
                <DetailItem label="Velocity Z" value={selectedObject.velocity.z.toFixed(2)} />
                 <Separator className="my-1"/>
                <DetailItem label="Current Speed" value={currentSpeed.toFixed(2) + " units/s"} />
            </div>
          </section>
          
          <Separator />

          <section>
            <h3 className="text-lg font-semibold mb-2 text-primary flex items-center gap-2"><Orbit className="h-5 w-5"/>Orbital Data</h3>
            <div className="space-y-1 bg-background/50 p-3 rounded-md border border-border">
              <DetailItem label="Est. Orbital Period" value="N/A (Complex Calculation)" />
              {/* Future: Add more orbital parameters like apoapsis, periapsis, inclination if calculable */}
            </div>
          </section>

        </ScrollArea>

        <SheetFooter className="p-4 border-t border-border sticky bottom-0 bg-card z-10">
          <SheetClose asChild>
            <Button type="button" className="w-full">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default ObjectDetailsPanel;

    