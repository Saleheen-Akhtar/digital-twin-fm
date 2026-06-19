import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-neutral-900 text-neutral-50 hover:bg-neutral-800",
        secondary: "border-transparent bg-neutral-100 text-neutral-900 hover:bg-neutral-200",
        destructive: "border-transparent bg-red-600 text-white hover:bg-red-700",
        outline: "text-neutral-950 dark:text-neutral-50",
        success: "border-transparent bg-green-500/15 text-green-700 dark:text-green-400",
        warning: "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400",
        critical: "border-transparent bg-red-500/15 text-red-700 dark:text-red-400",
        info: "border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-400",
        offline: "border-transparent bg-neutral-500/15 text-neutral-700 dark:text-neutral-400",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
