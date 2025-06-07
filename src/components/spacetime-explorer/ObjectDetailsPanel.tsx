
// src/components/spacetime-explorer/ObjectDetailsPanel.tsx
'use client';

import React from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SceneObject } from '@/types/spacetime';
import { REAL_OBJECT_DEFINITIONS, CompositionComponent } from '@/lib/real-objects';
import { 
  Orbit, Thermometer, Atom, Ruler, Sigma, FileText, Scale, Gauge, RotateCw, Move, Layers, Blend, Paintbrush, CircleIcon, ChevronDown
} from 'lucide-react';

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
  <div className="flex items-center py-1.5 border-b border-border/50 last:border-b-0">
    <div className="flex items-center gap-2 w-2/5 text-muted-foreground">
      {React.cloneElement(icon as React.ReactElement, { className: "h-4 w-4 flex-shrink-0" })}
      <span className="text-sm truncate" title={label}>{label}</span>
    </div>
    <div className="flex-1 text-right text-sm text-foreground font-medium truncate" title={String(value) + (unit || '')}>
      {value} {unit && <span className="text-xs text-muted-foreground ml-1">{unit}</span>}
    </div>
  </div>
);

const CompositionRow: React.FC<{ component: CompositionComponent }> = ({ component }) => (
  <div className="flex items-center justify-between py-1.5 px-1 rounded-md hover:bg-muted/20 transition-colors">
    <div className="flex items-center gap-2 min-w-0"> {/* Added min-w-0 to allow shrinking */}
      <div 
        style={{ backgroundColor: component.iconColor || 'hsl(var(--muted))' }} 
        className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
      />
      <span className="text-sm text-foreground truncate" title={component.name}>{component.name}</span>
      <ChevronDown className="h-3 w-3 text-muted-foreground/70 flex-shrink-0" />
    </div>
    <div 
      className="bg-input px-2 py-0.5 rounded-sm text-xs text-foreground font-mono shadow-sm truncate min-w-0 ml-2" /* Added min-w-0 and ml-2 */
      title={component.value}
    >
      {component.value}
    </div>
  </div>
);


const ObjectDetailsPanel: React.FC<ObjectDetailsPanelProps> = ({ selectedObject, isOpen, onClose }) => {
  if (!selectedObject) {
    return null;
  }

  const definitionKeyFull = selectedObject.name.toUpperCase().replace(/\s+/g, '');
  const definitionKeyName = selectedObject.name;
  const definition = REAL_OBJECT_DEFINITIONS[definitionKeyFull] || REAL_OBJECT_DEFINITIONS[definitionKeyName] || 
                     Object.values(REAL_OBJECT_DEFINITIONS).find(def => def.name.toLowerCase() === selectedObject.name.toLowerCase());


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
        className="w-full max-w-sm p-0 flex flex-col bg-card text-card-foreground shadow-xl border-l border-border" // max-w-sm
        onInteractOutside={(e) => e.preventDefault()} 
      >
        <div className="p-3 border-b border-border"> {/* p-3 from p-4 */}
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-foreground">{selectedObject.name}</h2> {/* text-xl from text-2xl */}
              <p className="text-xs text-muted-foreground">{subtitle}</p> {/* text-xs from text-sm */}
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-2 mt-1 bg-transparent p-0 border-b border-border rounded-none justify-start"> {/* mx-2 mt-1 */}
            <TabsTrigger value="overview" className="data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-2 py-1.5 text-sm"> {/* px-2 py-1.5 */}
              <CircleIcon className="mr-1.5 h-3.5 w-3.5" /> Overview {/* mr-1.5 h-3.5 w-3.5 */}
            </TabsTrigger>
            <TabsTrigger value="motion" className="data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-2 py-1.5 text-sm">
              <Move className="mr-1.5 h-3.5 w-3.5" /> Motion
            </TabsTrigger>
            <TabsTrigger value="surface" className="data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-2 py-1.5 text-sm">
              <Layers className="mr-1.5 h-3.5 w-3.5" /> Surface
            </TabsTrigger>
            <TabsTrigger value="composition" className="data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-2 py-1.5 text-sm">
              <Blend className="mr-1.5 h-3.5 w-3.5" /> Composition
            </TabsTrigger>
            <TabsTrigger value="visuals" className="data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-2 py-1.5 text-sm">
              <Paintbrush className="mr-1.5 h-3.5 w-3.5" /> Visuals
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            <TabsContent value="overview" className="p-3 space-y-0.5 mt-0"> {/* p-3, space-y-0.5 */}
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

            <TabsContent value="motion" className="p-3 mt-0"> {/* p-3 */}
              <h3 className="text-base font-semibold mb-1.5 text-primary">Motion Details</h3> {/* text-base, mb-1.5 */}
              <DetailRow icon={<Sigma />} label="Position X" value={selectedObject.position.x.toFixed(2)} unit="units"/>
              <DetailRow icon={<Sigma />} label="Position Y" value={selectedObject.position.y.toFixed(2)} unit="units"/>
              <DetailRow icon={<Sigma />} label="Position Z" value={selectedObject.position.z.toFixed(2)} unit="units"/>
              <div className="my-1.5 border-b border-border/50"></div> {/* my-1.5 */}
              <DetailRow icon={<Gauge />} label="Velocity X" value={selectedObject.velocity.x.toFixed(2)} unit="units/s"/>
              <DetailRow icon={<Gauge />} label="Velocity Y" value={selectedObject.velocity.y.toFixed(2)} unit="units/s"/>
              <DetailRow icon={<Gauge />} label="Velocity Z" value={selectedObject.velocity.z.toFixed(2)} unit="units/s"/>
               <div className="my-1.5 border-b border-border/50"></div> {/* my-1.5 */}
              <DetailRow icon={<Gauge />} label="Current Speed" value={currentSpeed.toFixed(2)} unit="units/s"/>
            </TabsContent>

            <TabsContent value="surface" className="p-3 mt-0"> {/* p-3 */}
              <h3 className="text-base font-semibold mb-1.5 text-primary">Surface Information</h3> {/* text-base, mb-1.5 */}
              {definition?.description ? (
                <div className="text-sm bg-muted/30 p-2.5 rounded-md border border-border/50"> {/* p-2.5 */}
                    <p className="font-semibold mb-1 text-foreground">Description:</p>
                    <p className="text-muted-foreground text-xs leading-relaxed">{definition.description}</p> {/* text-xs */}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No detailed surface description available for {selectedObject.name}.</p>
              )}
            </TabsContent>

            <TabsContent value="composition" className="p-3 mt-0"> {/* p-3 */}
              <h3 className="text-base font-semibold mb-1.5 text-primary">Composition Details</h3> {/* text-base, mb-1.5 */}
              {definition?.composition && Array.isArray(definition.composition) && definition.composition.length > 0 ? (
                <div className="space-y-0.5"> {/* space-y-0.5 */}
                  {definition.composition.map((comp, index) => (
                    <CompositionRow key={`${comp.name}-${index}`} component={comp} />
                  ))}
                </div>
              ) : (
                 <p className="text-sm text-muted-foreground">No detailed composition data available for {selectedObject.name}.</p>
              )}
            </TabsContent>

            <TabsContent value="visuals" className="p-3 mt-0"> {/* p-3 */}
              <h3 className="text-base font-semibold mb-1.5 text-primary">Visual Parameters</h3> {/* text-base, mb-1.5 */}
              <DetailRow icon={<Paintbrush />} label="Color (Hex)" value={selectedObject.color.toUpperCase()} />
              <DetailRow icon={<Ruler />} label="Visual Radius" value={selectedObject.radius.toFixed(1)} unit="sim units" />
            </TabsContent>
          </ScrollArea>
        </Tabs>
        
      </SheetContent>
    </Sheet>
  );
};

export default ObjectDetailsPanel;

