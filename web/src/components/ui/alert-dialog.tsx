import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import type { ComponentProps, HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
export const AlertDialogAction = AlertDialogPrimitive.Action;
export const AlertDialogCancel = AlertDialogPrimitive.Cancel;
export function AlertDialogContent({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Content>) { return <AlertDialogPrimitive.Portal><AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60" /><AlertDialogPrimitive.Content className={cn("fixed left-1/2 top-1/2 z-50 grid w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 gap-4 border border-foreground bg-card p-6 shadow-[10px_10px_0_var(--accent)] outline-none", className)} {...props} /></AlertDialogPrimitive.Portal>; }
export function AlertDialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn("grid gap-2", className)} {...props} />; }
export function AlertDialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cn("flex justify-end gap-2 max-sm:flex-col-reverse", className)} {...props} />; }
export function AlertDialogTitle({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Title>) { return <AlertDialogPrimitive.Title className={cn("text-2xl font-semibold tracking-[-0.04em]", className)} {...props} />; }
export function AlertDialogDescription({ className, ...props }: ComponentProps<typeof AlertDialogPrimitive.Description>) { return <AlertDialogPrimitive.Description className={cn("text-sm leading-6 text-muted-foreground", className)} {...props} />; }
