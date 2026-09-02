import React from "react";
import { cn } from "@/lib/utils";
import { Search, SlidersHorizontal, LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface StatBarProps {
  label: string;
  value: string | number;
  hint?: string;
  progress?: number;
  alert?: boolean;
  icon?: LucideIcon;
  variant?: "default" | "hero";
  delay?: number;
}

export function StatBar({ label, value, hint, progress, alert, icon: Icon, variant = "default", delay = 0 }: StatBarProps) {
  const isHero = variant === "hero";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={cn(
        "rounded-xl border-l-[3px] border border-border px-3.5 py-3 bg-card shadow-soft hover:shadow-hover hover:-translate-y-0.5 transition-all",
        alert
          ? "border-l-destructive border-destructive/30"
          : "border-l-primary"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={cn(
          "text-[10px]",
          alert ? "text-destructive" : "text-muted-foreground"
        )}>
          {label}
        </p>
        {Icon && (
          <div className={cn(
            "h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0",
            alert ? "bg-destructive/10" : "bg-primary/10"
          )}>
            <Icon size={12} strokeWidth={2} className={alert ? "text-destructive" : "text-primary"} />
          </div>
        )}
      </div>
      <p className={cn(
        "font-medium mt-0.5",
        isHero
          ? "text-3xl sm:text-4xl bg-clip-text text-transparent bg-gradient-to-br from-primary to-amber-600"
          : "text-lg",
        !isHero && (alert ? "text-destructive" : "text-foreground")
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
    </motion.div>
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

  const dotMap: Record<string, string> = {
    active: "bg-success",
    flagged: "bg-primary",
    revoked: "bg-destructive",
    paused: "bg-muted-foreground",
    open: "bg-destructive",
    in_review: "bg-primary",
    resolved: "bg-success",
    implemented: "bg-success",
    under_review: "bg-primary",
    escalated: "bg-amber-500",
    closed: "bg-muted-foreground",
    resolved_refund: "bg-success",
    resolved_release: "bg-success",
  };

  // Default to muted if not in map
  const colorClass = map[status] || "bg-muted text-muted-foreground";
  const dotClass = dotMap[status] || "bg-muted-foreground";

  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
      colorClass
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", dotClass)} />
      {status.replace(/_/g, " ")}
    </span>
  );
}

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: "outline" | "danger";
  icon?: LucideIcon;
}

export function ActionButton({ label, variant = "outline", icon: Icon, className, ...props }: ActionButtonProps) {
  const baseClasses = variant === "danger"
    ? "px-2.5 py-1 rounded-md border border-destructive/30 bg-destructive/5 text-[11px] font-medium text-destructive hover:bg-destructive/15 transition-colors"
    : "px-2.5 py-1 rounded-md border border-border bg-background text-[11px] font-medium text-foreground hover:bg-muted transition-colors";

  return (
    <button className={cn(baseClasses, "tap-active inline-flex items-center gap-1", className)} {...props}>
      {Icon && <Icon size={11} strokeWidth={2} />}
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
  compact?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, subtitle, compact, action }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2", compact ? "py-6" : "py-14")}>
      <Icon size={compact ? 22 : 32} strokeWidth={1} className="text-muted-foreground/25" />
      <p className={cn("font-medium text-foreground", compact ? "text-xs" : "text-sm")}>{title}</p>
      <p className="text-xs text-muted-foreground text-center px-4">{subtitle}</p>
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

interface MiniAreaChartProps {
  data: Array<Record<string, any>>;
  dataKey: string;
  height?: number;
  gradientId: string;
  showAxes?: boolean;
  tooltipFormatter?: (value: number) => string;
}

/**
 * Shared area-chart treatment for admin/vendor dashboards: single series in
 * the primary hue (this app has no multi-series admin chart yet, so no
 * categorical palette is needed - see dataviz skill's "sequential = one hue"
 * rule), 2px line, ~10% opacity fill wash, hairline recessive grid, real
 * hover tooltip. Modeled on VendorDashboard.tsx's existing chart.
 */
export function MiniAreaChart({ data, dataKey, height = 200, gradientId, showAxes = true, tooltipFormatter }: MiniAreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: showAxes ? -16 : 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        {showAxes && (
          <>
            <CartesianGrid strokeDasharray="0" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
          </>
        )}
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          strokeLinecap="round"
          fill={`url(#${gradientId})`}
          dot={false}
        />
        <Tooltip
          formatter={tooltipFormatter ? (v: number) => tooltipFormatter(v) : undefined}
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: "11px",
          }}
          cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
