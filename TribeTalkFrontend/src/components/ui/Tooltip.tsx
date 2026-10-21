import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import type { ReactNode } from "react"

export function TooltipProvider({ children }: { children: ReactNode }) { return <TooltipPrimitive.Provider delayDuration={350}>{children}</TooltipPrimitive.Provider> }
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger
export function TooltipContent({ children }: { children: ReactNode }) { return <TooltipPrimitive.Portal><TooltipPrimitive.Content sideOffset={6} className="z-50 rounded-md border border-white/10 bg-panel px-2.5 py-1.5 text-xs text-paper shadow-xl">{children}</TooltipPrimitive.Content></TooltipPrimitive.Portal> }
