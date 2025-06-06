
// src/components/spacetime-explorer/ObjectManagementPanel.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { PlusCircle, Trash2 } from 'lucide-react';
import ObjectForm from './ObjectForm';
import type { SceneObject, ObjectType, MassiveObject, Vector3 } from '@/types/spacetime';
import { useToast } from '@/hooks/use-toast';
import {
  DEFAULT_ORBITER_OBJECT_RADIUS, G_CONSTANT, DEFAULT_ORBITAL_DISTANCE_OFFSET,
  DEFAULT_MASSIVE_OBJECT_RADIUS, DEFAULT_MASSIVE_OBJECT_COLOR, DEFAULT_ORBITER_OBJECT_COLOR
} from '@/lib/constants';
import { SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'; // For Sheet styling

interface ObjectManagementPanelProps {
  objects: SceneObject[];
  selectedObjectId: string | null;
  onAddObject: (object: SceneObject) => void;
  onUpdateObject: (object: SceneObject) => void;
  onRemoveObject: (objectId: string) => void;
  onSelectObject: (objectId: string | null) => void;
  onClose?: () => void; // Optional: To close the sheet/dialog
}

const ObjectManagementPanel: React.FC<ObjectManagementPanelProps> = ({
  objects,
  selectedObjectId,
  onAddObject,
  onUpdateObject,
  onRemoveObject,
  onSelectObject,
  onClose,
}) => {
  const { toast } = useToast();
  const [editingObjectType, setEditingObjectType] = useState<ObjectType | null>(null);
  const [formInitialData, setFormInitialData] = useState<Partial<SceneObject> | undefined>(undefined);

  const selectedObject = objects.find(obj => obj.id === selectedObjectId);

  useEffect(() => {
    if (selectedObject) {
      setFormInitialData(selectedObject);
      setEditingObjectType(null); 
    } else if (!editingObjectType) { 
      setFormInitialData(undefined);
    }
  }, [selectedObject, editingObjectType]);

  const handleAddNewObjectClick = useCallback((type: ObjectType) => {
    onSelectObject(null);
    setEditingObjectType(type);

    let baseInitialData: Partial<SceneObject> = {
      mass: type === 'massive' ? 1000 : 1,
      radius: type === 'massive' ? DEFAULT_MASSIVE_OBJECT_RADIUS : DEFAULT_ORBITER_OBJECT_RADIUS,
      color: type === 'massive' ? DEFAULT_MASSIVE_OBJECT_COLOR : DEFAULT_ORBITER_OBJECT_COLOR,
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
    };

    if (type === 'orbiter') {
      const massiveObjects = objects.filter(obj => obj.type === 'massive') as MassiveObject[];
      let centralBody: MassiveObject | null = null;
      if (massiveObjects.length > 0) {
        centralBody = massiveObjects.reduce((prev, current) => (prev.mass > current.mass) ? prev : current);
      }

      if (centralBody) {
        const actualCentralBodyRadius = centralBody.radius || DEFAULT_MASSIVE_OBJECT_RADIUS;
        const actualOrbiterRadius = DEFAULT_ORBITER_OBJECT_RADIUS;
        
        let dynamicClearanceOffset = Math.max(DEFAULT_ORBITAL_DISTANCE_OFFSET, actualCentralBodyRadius * 0.5);
        dynamicClearanceOffset = Math.max(dynamicClearanceOffset, actualOrbiterRadius * 1.2);
        const distance = actualCentralBodyRadius + actualOrbiterRadius + dynamicClearanceOffset;
        
        const centralBodyPos = centralBody.position || { x: 0, y: 0, z: 0 };
        const centralBodyVel = centralBody.velocity || { x: 0, y: 0, z: 0 };

        baseInitialData.position = {
          x: centralBodyPos.x + distance,
          y: centralBodyPos.y,
          z: centralBodyPos.z,
        };
        let orbitalSpeed = 0;
        if (centralBody.mass > 0 && distance > 0) {
           orbitalSpeed = Math.sqrt((G_CONSTANT * centralBody.mass) / distance);
        }
        if (!isFinite(orbitalSpeed)) orbitalSpeed = 0;
        baseInitialData.velocity = {
          x: centralBodyVel.x,
          y: centralBodyVel.y,
          z: centralBodyVel.z + orbitalSpeed,
        };
      }
    }
    setFormInitialData(baseInitialData);
  }, [onSelectObject, objects]);

  const handleObjectFormSubmit = (data: Partial<SceneObject>) => {
    if (data.id) {
      onUpdateObject(data as SceneObject);
      toast({ title: "Object Updated", description: `${data.name} properties saved.` });
    } else {
      const newId = `obj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const fullObjectData = { ...data, id: newId, type: editingObjectType! } as SceneObject;
      onAddObject(fullObjectData);
      toast({ title: "Object Added", description: `${data.name} added to the scene.` });
    }
    setEditingObjectType(null);
    setFormInitialData(undefined);
    // if (onClose && !data.id) onClose(); // Optionally close sheet after adding new
  };

  const handleCancelForm = () => {
    setEditingObjectType(null);
    onSelectObject(null);
    setFormInitialData(undefined);
  }

  return (
    <div className="flex flex-col h-full bg-card text-card-foreground">
      <SheetHeader className="p-4 border-b">
        <SheetTitle>Object Management</SheetTitle>
        <SheetDescription>Add, edit, or remove celestial bodies from the simulation.</SheetDescription>
      </SheetHeader>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          <div className="flex space-x-2">
            <Button size="sm" onClick={() => handleAddNewObjectClick('massive')} className="flex-1">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Massive Object
            </Button>
            <Button size="sm" onClick={() => handleAddNewObjectClick('orbiter')} className="flex-1">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Orbiter
            </Button>
          </div>

          {(editingObjectType || selectedObject) && (
            <Card className="bg-background text-foreground border-border">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-md">
                  {editingObjectType ? `Add New ${editingObjectType === 'massive' ? 'Massive' : 'Orbiter'} Object` : `Edit: ${selectedObject?.name}`}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <ObjectForm
                  key={selectedObject?.id || editingObjectType || 'new-object-form'}
                  objectType={editingObjectType || selectedObject!.type}
                  initialData={formInitialData}
                  onSubmit={handleObjectFormSubmit}
                  onCancel={handleCancelForm}
                  submitButtonText={selectedObject ? "Update Object" : "Add Object"}
                />
              </CardContent>
            </Card>
          )}

          <Separator />
          <h3 className="text-md font-semibold text-foreground">Scene Objects:</h3>
          {objects.length === 0 && <p className="text-sm text-muted-foreground">No objects in scene.</p>}
          <div className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
            {objects.map(obj => (
              <div
                key={obj.id}
                className={`flex items-center justify-between p-2 rounded-md cursor-pointer
                           hover:bg-accent hover:text-accent-foreground
                           ${selectedObjectId === obj.id
                             ? 'bg-accent text-accent-foreground ring-2 ring-primary'
                             : 'bg-muted/30 text-foreground hover:bg-muted/60'}`}
                onClick={() => { onSelectObject(obj.id); setEditingObjectType(null); }}
              >
                <div className="flex items-center truncate">
                  <span className="truncate text-sm" style={{color: selectedObjectId === obj.id ? 'hsl(var(--accent-foreground))' : obj.color, fontWeight: selectedObjectId === obj.id ? 'bold' : 'normal'}}>
                    {obj.name} <span className="text-xs opacity-80">({obj.type}, M: {obj.mass.toFixed(1)})</span>
                  </span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive-foreground hover:bg-destructive/30 flex-shrink-0" onClick={(e) => { e.stopPropagation(); onRemoveObject(obj.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
      {onClose && (
        <div className="p-4 border-t mt-auto">
          <Button onClick={onClose} className="w-full">Done</Button>
        </div>
      )}
    </div>
  );
};

export default ObjectManagementPanel;
