import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

export function RadioGroup({ className, ...props }: ComponentProps<typeof RadioGroupPrimitive.Root>) { return <RadioGroupPrimitive.Root className={cn("grid gap-2", className)} {...props} />; }
export function RadioGroupItem({ className, ...props }: ComponentProps<typeof RadioGroupPrimitive.Item>) { return <RadioGroupPrimitive.Item className={cn("peer size-5 rounded-full border border-input bg-white outline-none focus-visible:ring-3 focus-visible:ring-ring/35 data-[state=checked]:border-primary", className)} {...props}><RadioGroupPrimitive.Indicator className="grid size-full place-items-center after:block after:size-2.5 after:rounded-full after:bg-primary" /></RadioGroupPrimitive.Item>; }
