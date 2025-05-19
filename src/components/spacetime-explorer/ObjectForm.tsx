// src/components/spacetime-explorer/ObjectForm.tsx
'use client';

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { SceneObject, ObjectType } from '@/types/spacetime';
import { HexColorPicker } from "react-colorful"; // Simple color picker

const baseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  positionX: z.coerce.number(),
  positionY: z.coerce.number(),
  positionZ: z.coerce.number(),
  velocityX: z.coerce.number(),
  velocityY: z.coerce.number(),
  velocityZ: z.coerce.number(),
  radius: z.coerce.number().min(0.1, 'Radius must be positive'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color'),
});

const massiveObjectSchema = baseSchema.extend({
  mass: z.coerce.number().min(0, 'Mass cannot be negative'),
});

const orbiterObjectSchema = baseSchema.extend({
  // Orbiter mass is optional or fixed, not typically user-editable in this simplified model
});

interface ObjectFormProps {
  objectType: ObjectType;
  initialData?: Partial<SceneObject>;
  onSubmit: (data: Partial<SceneObject>) => void;
  onCancel?: () => void;
  submitButtonText?: string;
}

const ObjectForm: React.FC<ObjectFormProps> = ({
  objectType,
  initialData,
  onSubmit,
  onCancel,
  submitButtonText = 'Save Object',
}) => {
  const schema = objectType === 'massive' ? massiveObjectSchema : orbiterObjectSchema;
  type FormData = z.infer<typeof schema>;

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialData?.name || (objectType === 'massive' ? 'Star' : 'Planet'),
      positionX: initialData?.position?.x || 0,
      positionY: initialData?.position?.y || 0,
      positionZ: initialData?.position?.z || 0,
      velocityX: initialData?.velocity?.x || 0,
      velocityY: initialData?.velocity?.y || 0,
      velocityZ: initialData?.velocity?.z || 0,
      radius: initialData?.radius || (objectType === 'massive' ? 10 : 2),
      color: initialData?.color || (objectType === 'massive' ? '#FFD700' : '#00BFFF'),
      ...(objectType === 'massive' && { mass: (initialData as any)?.mass || 1000 }),
    },
  });

  const handleSubmit = (values: FormData) => {
    const transformedData: Partial<SceneObject> = {
      id: initialData?.id, // Preserve ID if editing
      type: objectType,
      name: values.name,
      position: { x: values.positionX, y: values.positionY, z: values.positionZ },
      velocity: { x: values.velocityX, y: values.velocityY, z: values.velocityZ },
      radius: values.radius,
      color: values.color,
      ...(objectType === 'massive' && { mass: (values as any).mass }),
    };
    onSubmit(transformedData);
    if (!initialData) form.reset(); // Reset form if it was for adding a new object
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl><Input placeholder="e.g., Sun, Earth" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {objectType === 'massive' && (
          <FormField
            control={form.control}
            name="mass"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mass</FormLabel>
                <FormControl><Input type="number" placeholder="e.g., 1000" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <Label className="text-sm font-medium">Initial Position (x, y, z)</Label>
        <div className="grid grid-cols-3 gap-2">
          <FormField control={form.control} name="positionX" render={({ field }) => (<FormItem><FormControl><Input type="number" placeholder="X" {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="positionY" render={({ field }) => (<FormItem><FormControl><Input type="number" placeholder="Y" {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="positionZ" render={({ field }) => (<FormItem><FormControl><Input type="number" placeholder="Z" {...field} /></FormControl><FormMessage /></FormItem>)} />
        </div>

        <Label className="text-sm font-medium">Initial Velocity (x, y, z)</Label>
        <div className="grid grid-cols-3 gap-2">
          <FormField control={form.control} name="velocityX" render={({ field }) => (<FormItem><FormControl><Input type="number" placeholder="VX" {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="velocityY" render={({ field }) => (<FormItem><FormControl><Input type="number" placeholder="VY" {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={form.control} name="velocityZ" render={({ field }) => (<FormItem><FormControl><Input type="number" placeholder="VZ" {...field} /></FormControl><FormMessage /></FormItem>)} />
        </div>
        
        <FormField
          control={form.control}
          name="radius"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Visual Radius</FormLabel>
              <FormControl><Input type="number" placeholder="e.g., 10" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Color</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2">
                    <Input placeholder="#RRGGBB" {...field} className="w-1/2"/>
                    <div style={{ backgroundColor: field.value, width: '24px', height: '24px', borderRadius: '4px', border: '1px solid hsl(var(--border))' }} />
                </div>
              </FormControl>
              <Controller
                name="color"
                control={form.control}
                render={({ field: { onChange, value } }) => (
                  <HexColorPicker color={value} onChange={onChange} style={{ width: '100%', marginTop: '8px' }}/>
                )}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <Separator />
        <div className="flex justify-end space-x-2">
          {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
          <Button type="submit">{submitButtonText}</Button>
        </div>
      </form>
    </Form>
  );
};

export default ObjectForm;
