import React from "react";
import { cn } from "@/lib/utils";
import { Search, SlidersHorizontal, LucideIcon } from "lucide-react";

interface StatBarProps {
  label: string;
  value: string | number;
  hint?: string;
  progress?: number;
  alert?: boolean;
}

export function StatBar({ label, value, hint, progress, alert }: StatBarProps) {
  return (
    <div className={cn(
      "rounded-xl border-l-[3px] border border-border px-3.5 py-3 bg-card",
      alert
        ? "border-l-destructive border-destructive/30"
        : "border-l-primary"
    )}>
      <p className={cn(
        "text-[10px]",
        alert ? "text-destructive" : "text-muted-foreground"
      )}>
        {label}
      </p>
      <p className={cn(
        "text-lg font-medium mt-0.5",
        alert ? "text-destructive" : "text-foreground"
      )}>
        {value}
      </p>
      {progress !== undefined && (
        <div className="h-[3px] rounded-full bg-border mt-2">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {hint && (
        <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>
      )}
    </div>
  );
}

interface StatusPillProps {
  status: string;
}

export function StatusPill({ status }: StatusPillProps) {
  const map: Record<string, string> = {
    active:       "bg-success/10 text-success",
    flagged:      "bg-primary/10 text-primary",
    revoked:      "bg-destructive/10 text-destructive",
    paused:       "bg-muted text-muted-foreground",
    open:         "bg-destructive/10 text-destructive",
    in_review:    "bg-primary/10 text-primary",
    resolved:     "bg-success/10 text-success",
    implemented:  "bg-success/10 text-success",
    under_review: "bg-primary/10 text-primary",
    escalated:    "bg-amber-500/10 text-amber-500",
    closed:       "bg-muted text-muted-foreground",
    resolved_refund: "bg-success/10 text-success",
    resolved_release: "bg-success/10 text-success",
  };
  
  // Default to muted if not in map
  const colorClass = map[status] || "bg-muted text-muted-foreground";

  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
      colorClass
    )}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: "outline" | "danger";
}

export function ActionButton({ label, variant = "outline", className, ...props }: ActionButtonProps) {
  const baseClasses = variant === "danger" 
    ? "px-2.5 py-1 rounded-md border border-destructive/30 bg-destructive/5 text-[11px] font-medium text-destructive hover:bg-destructive/15 transition-colors"
    : "px-2.5 py-1 rounded-md border border-border bg-background text-[11px] font-medium text-foreground hover:bg-muted transition-colors";

  return (
    <button className={cn(baseClasses, className)} {...props}>
      {label}
    </button>
  );
}

interface SearchBarProps extends React.InputHTMLAttributes<HTMLInputElement> {
  placeholder?: string;
  onFilterClick?: () => void;
}

export function SearchBar({ placeholder = "Search...", onFilterClick, className, ...props }: SearchBarProps) {
  return (
    <div className={cn("flex gap-2 mb-3", className)}>
      <div className="relative flex-1">
        <Search size={13} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input 
          className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-muted text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background transition"
          placeholder={placeholder} 
          {...props}
        />
      </div>
      {onFilterClick && (
        <button 
          onClick={onFilterClick}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-background text-sm text-muted-foreground hover:bg-muted transition"
        >
          <SlidersHorizontal size={13} strokeWidth={1.5} />
          Filter
        </button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14">
      <Icon size={32} strokeWidth={1} className="text-muted-foreground/25" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
      {action && (
        <button 
          onClick={action.onClick}
          className="mt-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary-hover transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
