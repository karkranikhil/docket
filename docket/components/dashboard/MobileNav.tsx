"use client"

import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { SidebarNav } from "./SidebarNav"
import type { Tradie } from "@/types/database"

interface MobileNavProps {
  tradie: Tradie
  subscriptionTier: string
}

export function MobileNav({ tradie, subscriptionTier }: MobileNavProps) {
  return (
    <Sheet>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" />}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="text-left">Docket</SheetTitle>
        </SheetHeader>
        <SidebarNav tradie={tradie} subscriptionTier={subscriptionTier} />
        <div className="border-t p-4">
          <p className="truncate text-sm font-medium">
            {tradie.business_name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {tradie.email}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
