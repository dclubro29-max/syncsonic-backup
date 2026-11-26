import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center py-1.5", className)}
    {...props}>
    <SliderPrimitive.Track
      className="relative h-2 w-full grow overflow-hidden rounded-full bg-primary/15">
      <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className="relative block h-5 w-5 rounded-full border-2 border-background bg-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.6)] transition-transform duration-150 after:absolute after:-inset-2.5 after:content-[''] hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }