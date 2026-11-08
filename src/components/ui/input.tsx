import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-control bg-field px-2.5 py-1 text-base shadow-field transition-shadow hover:shadow-field-hover outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground placeholder:text-muted-foreground/75 focus-visible:shadow-field-focus disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:shadow-field-invalid md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
