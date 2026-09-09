import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Pagination({ className, ...props }: HTMLAttributes<HTMLElement>) { return <nav aria-label="Pagination" className={cn("flex items-center justify-center", className)} {...props} />; }
export function PaginationContent({ className, ...props }: HTMLAttributes<HTMLUListElement>) { return <ul className={cn("flex items-center gap-2", className)} {...props} />; }
export function PaginationItem({ className, ...props }: HTMLAttributes<HTMLLIElement>) { return <li className={cn(className)} {...props} />; }
