import React from "react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

/**
 * Slider etichetat: etichetă mică, valoare numerică tabulară și controlul.
 * Păstrează exact contractul Slider-ului shadcn (onValueChange primește array).
 */
export default function ControlSlider({
  label,
  icon: Icon,
  value,
  display,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  disabled = false,
  ariaLabel,
  className,
  sliderClassName,
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-1.5 font-heading text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {Icon ? <Icon className="h-3 w-3" aria-hidden="true" /> : null}
          {label}
        </span>
        {display != null ? <span className="num text-[11px] text-muted-foreground">{display}</span> : null}
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={onChange}
        disabled={disabled}
        aria-label={ariaLabel || label}
        className={cn("w-full", sliderClassName)}
      />
    </div>
  );
}