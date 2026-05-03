import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Dialog({
  children,
  open,
}: {
  children: ReactNode;
  open: boolean;
}) {
  if (!open) return null;
  return <>{children}</>;
}

export function DialogOverlay({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-dialog-overlay", className)} {...props} />;
}

export function DialogContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-modal="true"
      className={cn("ui-dialog-content", className)}
      role="dialog"
      {...props}
    />
  );
}

export function DialogHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-dialog-header", className)} {...props} />;
}

export function DialogTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("ui-dialog-title", className)} {...props} />;
}

export function DialogDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("ui-dialog-description", className)} {...props} />;
}
