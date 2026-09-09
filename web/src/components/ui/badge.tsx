import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const badgeVariants = cva("inline-flex items-center border px-2 py-1 font-mono text-[0.62rem] uppercase tracking-[0.05em]", { variants: { variant: { default: "border-primary bg-primary text-white", outline: "border-border bg-transparent text-foreground", success: "border-[#225c50] bg-[#d8e4dc] text-[#17453d]", destructive: "border-destructive bg-[#f2ddd7] text-[#6f2e26]", accent: "border-primary bg-secondary text-foreground" } }, defaultVariants: { variant: "default" } });
export function Badge({ className, variant, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) { return <span className={cn(badgeVariants({ variant }), className)} {...props} />; }
