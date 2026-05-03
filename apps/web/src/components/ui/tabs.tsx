import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export function Tabs({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-tabs", className)} {...props} />;
}

export function TabsList({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-tabs-list", className)} role="tablist" {...props} />;
}

interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  children: ReactNode;
}

export function TabsTrigger({
  active = false,
  className,
  ...props
}: TabsTriggerProps) {
  return (
    <button
      aria-selected={active}
      className={cn("ui-tabs-trigger", active && "is-active", className)}
      role="tab"
      type="button"
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-tabs-content", className)} role="tabpanel" {...props} />;
}
