// src/components/ui-customizer/UICustomizer.tsx
'use client';

import { SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

export default function UICustomizer() {
  return (
    <>
      <SheetHeader className="p-4 border-b bg-background sticky top-0 z-10">
        <SheetTitle>UI Customizer</SheetTitle>
        <SheetDescription>
          Adjust the look and feel of the application. (Controls are placeholders)
        </SheetDescription>
      </SheetHeader>
      <div className="p-4 space-y-6 flex-1">
        <section>
          <h3 className="text-lg font-medium mb-3 text-foreground">Theme Colors</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="bgColor" className="text-muted-foreground">Background</Label>
              <Input id="bgColor" type="color" defaultValue="#1A202C" className="w-16 h-8 p-1 rounded-md border-input" disabled />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="fgColor" className="text-muted-foreground">Foreground</Label>
              <Input id="fgColor" type="color" defaultValue="#E0E0E0" className="w-16 h-8 p-1 rounded-md border-input" disabled />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="primaryColor" className="text-muted-foreground">Primary</Label>
              <Input id="primaryColor" type="color" defaultValue="#3B5998" className="w-16 h-8 p-1 rounded-md border-input" disabled />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="accentColor" className="text-muted-foreground">Accent</Label>
              <Input id="accentColor" type="color" defaultValue="#8A2BE2" className="w-16 h-8 p-1 rounded-md border-input" disabled />
            </div>
          </div>
        </section>
        <Separator />
        <section>
          <h3 className="text-lg font-medium mb-3 text-foreground">Layout</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground">Sidebar Width</Label>
              <Input type="number" defaultValue="320" className="w-24 h-8 rounded-md border-input" disabled />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground">Font Size (Base)</Label>
              <Input type="number" defaultValue="16" className="w-24 h-8 rounded-md border-input" disabled />
            </div>
          </div>
        </section>
        <Separator />
        <div className="pt-2 flex justify-end">
            <Button variant="outline" disabled>Reset to Defaults</Button>
            <Button className="ml-2" disabled>Apply Changes</Button>
        </div>
      </div>
    </>
  );
}
