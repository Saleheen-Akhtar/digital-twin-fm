"use client";
import * as React from "react";
import { cn } from "../utils";
import { Badge, type BadgeProps } from "./badge";

export type AssetStatus =
  | "ok"
  | "warning"
  | "critical"
  | "offline"
  | "info";

const STATUS_MAP: Record<AssetStatus, { variant: NonNullable<BadgeProps["variant"]>; label: string; dot: string }> = {
  ok: { variant: "success", label: "Operational", dot: "bg-green-500" },
  warning: { variant: "warning", label: "Warning", dot: "bg-amber-500" },
  critical: { variant: "critical", label: "Critical", dot: "bg-red-500" },
  offline: { variant: "offline", label: "Offline", dot: "bg-neutral-500" },
  info: { variant: "info", label: "Info", dot: "bg-blue-500" },
};

export interface StatusPillProps extends Omit<BadgeProps, "variant"> {
  status: AssetStatus;
  showDot?: boolean;
}

export function StatusPill({ status, showDot = true, className, children, ...props }: StatusPillProps) {
  const s = STATUS_MAP[status];
  return (
    <Badge variant={s.variant} className={cn("gap-1.5", className)} {...props}>
      {showDot && <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />}
      {children ?? s.label}
    </Badge>
  );
}

export { STATUS_MAP };
