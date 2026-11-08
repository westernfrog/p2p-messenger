"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Switch as SwitchPrimitive } from "radix-ui"

/**
 * On/off switch, Mac proportions: a 38×22 track (30×18 small) with a white knob inset 2 px. The knob
 * is placed with `left` (not a transform) so it can stretch while pressed and still land flush on
 * either side; it slides with a soft ease-out, and not at all when reduced motion is on.
 */
function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 cursor-pointer items-center rounded-full outline-none",
        "transition-[background-color,box-shadow] duration-200 motion-reduce:transition-none",
        // Bigger hit area than the track.
        "after:absolute after:-inset-x-2 after:-inset-y-2",
        "data-[size=default]:h-[22px] data-[size=default]:w-[38px] data-[size=sm]:h-[18px] data-[size=sm]:w-[30px]",
        // Off: neutral track with a hairline edge so it holds up on white and on dark groups.
        "data-unchecked:bg-[var(--switch-off)] data-unchecked:shadow-[inset_0_0_0_1px_var(--switch-edge)]",
        "data-unchecked:hover:bg-[color-mix(in_srgb,var(--switch-off),var(--foreground)_7%)]",
        // On: the accent, a touch of depth.
        "data-checked:bg-primary data-checked:shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] data-checked:hover:bg-[color-mix(in_srgb,var(--primary),black_8%)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid",
        "aria-invalid:outline-2 aria-invalid:outline-offset-2 aria-invalid:outline-destructive aria-invalid:outline-solid",
        "data-disabled:pointer-events-none data-disabled:opacity-45",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none absolute top-1/2 block -translate-y-1/2 rounded-full bg-white",
          "shadow-[0_1px_3px_rgb(0_0_0/0.18),0_1px_1px_rgb(0_0_0/0.08),0_0_0_0.5px_rgb(0_0_0/0.05)]",
          "transition-[left,width,translate] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          // Size, and a slightly wider knob while held.
          "group-data-[size=default]/switch:h-[18px] group-data-[size=default]/switch:w-[18px] group-data-[size=default]/switch:group-active/switch:w-[22px]",
          "group-data-[size=sm]/switch:h-[14px] group-data-[size=sm]/switch:w-[14px] group-data-[size=sm]/switch:group-active/switch:w-[17px]",
          // Position: 2 px from the leading edge when off, 2 px from the trailing edge when on.
          "data-unchecked:left-[2px] data-unchecked:translate-x-0",
          "data-checked:left-[calc(100%-2px)] data-checked:-translate-x-full"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
