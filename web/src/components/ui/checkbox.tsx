import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return <CheckboxPrimitive.Root className={cn("peer size-5 shrink-0 border border-input bg-white outline-none focus-visible:ring-3 focus-visible:ring-ring/35 disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-secondary", className)} {...props}><CheckboxPrimitive.Indicator className="grid place-items-center text-foreground"><Check className="size-4" strokeWidth={3} /></CheckboxPrimitive.Indicator></CheckboxPrimitive.Root>;
}
