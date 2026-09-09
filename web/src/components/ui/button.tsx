import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export const buttonVariants = cva(
  "inline-flex min-h-12 items-center justify-center gap-2 border px-4 font-sans text-sm font-semibold transition-[background-color,color,transform] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#185cff] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-primary bg-primary text-primary-foreground hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground",
        secondary: "border-primary bg-transparent text-foreground hover:bg-secondary",
        destructive: "border-destructive bg-destructive text-white hover:-translate-y-0.5 hover:bg-[#6f2e26]",
        light: "border-white bg-white text-foreground hover:bg-secondary",
        ghost: "border-transparent bg-transparent text-foreground hover:bg-secondary",
        link: "min-h-0 border-0 bg-transparent p-0 text-foreground underline underline-offset-4",
        filter: "min-h-9 border-border bg-transparent px-3 font-mono text-[0.68rem] uppercase hover:border-primary hover:bg-secondary data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-white",
      },
      size: {
        default: "h-12",
        sm: "min-h-9 px-3 text-xs",
        icon: "size-10 min-h-10 px-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
