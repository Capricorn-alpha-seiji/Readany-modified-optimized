import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@readany/core/utils";
import type { ComponentPropsWithoutRef } from "react";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TOOLTIP_MOTION_CLASS = "readany-floating-motion"; // MOTION-OPTIMIZED

function TooltipContent({
  className,
  sideOffset = 4,
  ...props
}: ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground",
          TOOLTIP_MOTION_CLASS,
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
