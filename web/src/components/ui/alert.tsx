import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const alertVariants = cva("relative w-full border p-4 text-sm", { variants: { variant: { default: "border-border bg-card text-foreground", destructive: "border-destructive bg-[#f2ddd7] text-[#6f2e26]", success: "border-[#225c50] bg-[#d8e4dc] text-[#17453d]" } }, defaultVariants: { variant: "default" } });
export function Alert({ className, variant, ...props }: HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>) { return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />; }
export function AlertTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) { return <h5 className={cn("mb-1 font-semibold", className)} {...props} />; }
export function AlertDescription({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn("text-sm leading-6", className)} {...props} />; }
