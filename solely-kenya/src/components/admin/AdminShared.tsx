import React from "react";
import { cn } from "@/lib/utils";
import { Search, SlidersHorizontal, LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Link } from "react-router-dom";

interface StatBarProps {
  label: string;
  value: string | number;
  hint?: string;
  progress?: number;
  alert?: boolean;
  icon?: LucideIcon;
  delay?: number;
}

// One card treatment for every stat - solid gold fill, white text, same
// type scale and icon badge across the row. No "hero" variant: a single
// odd-one-out card just read as inconsistent next to the others.
export function StatBar({ label, value, hint, progress, alert, icon: Icon, delay = 0 }: StatBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="rounded-2xl px-4 py-4 shadow-soft hover:shadow-hover hover:-translate-y-0.5 transition-all text-white"
      style={{ background: alert ? "hsl(var(--destructive))" : "hsl(var(--admin-stat))" }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-white/90">{label}</p>
        {Icon && (
          <div className="h-7 w-7 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
            <Icon size={13} strokeWidth={2} className="text-white" />
          </div>
        )}
      </div>
      <p className="font-bold mt-1.5 text-2xl tracking-tight">{value}</p>
      {progress !== undefined && (
        <div className="h-[3px] rounded-full bg-white/20 mt-2">
          <div
            className="h-full rounded-full bg-white transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      {hint && (
        <p className="text-[10px] text-white/60 mt-1">{hint}</p>
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

export interface DonutDatum {
  name: string;
  value: number;
  /** A CSS color value, e.g. "hsl(var(--primary))". Falls back to the default palette by index. */
  color?: string;
}

// Reuses the same 4 status hues already used throughout the admin pages
// (StatusPill, the Orders-at-a-glance tiles on AdminDashboard) rather than
// introducing a new categorical palette - this app has one small, fixed
// vocabulary of state colors (primary/success/destructive/muted).
const DEFAULT_DONUT_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
];

interface DonutChartProps {
  data: DonutDatum[];
  height?: number;
  centerLabel?: string;
  centerValue?: string | number;
}

/** Status-breakdown donut with a legend, matching the inspiration dashboards' "Overall Status" widget. */
export function DonutChart({ data, height = 200, centerLabel, centerValue }: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="65%"
              outerRadius="100%"
              paddingAngle={data.length > 1 ? 2 : 0}
              stroke="none"
            >
              {data.map((entry, i) => (
                <Cell key={entry.name} fill={entry.color ?? DEFAULT_DONUT_COLORS[i % DEFAULT_DONUT_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number, name: string) => [`${v} (${total > 0 ? Math.round((v / total) * 100) : 0}%)`, name]}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "11px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {(centerLabel || centerValue !== undefined) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {centerValue !== undefined && <p className="text-lg font-semibold text-foreground">{centerValue}</p>}
            {centerLabel && <p className="text-[10px] text-muted-foreground text-center px-2">{centerLabel}</p>}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 min-w-0">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2 text-xs min-w-0">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: d.color ?? DEFAULT_DONUT_COLORS[i % DEFAULT_DONUT_COLORS.length] }}
            />
            <span className="text-muted-foreground truncate">{d.name}</span>
            <span className="text-foreground font-medium ml-auto pl-2">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface DataTableColumn<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right";
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  viewAllHref?: string;
  emptyMessage?: string;
}

/** Compact list table matching the inspirations' "Recent Payroll Runs"/"Recent Transactions" widgets. */
export function DataTable<T>({ columns, rows, rowKey, viewAllHref, emptyMessage = "Nothing to show yet" }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            {columns.map(col => (
              <th
                key={col.header}
                className={cn(
                  "py-2 font-medium text-muted-foreground whitespace-nowrap",
                  col.align === "right" ? "text-right pl-3" : "text-left pr-3"
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(row => (
            <tr key={rowKey(row)} className="hover:bg-muted/40 transition-colors">
              {columns.map(col => (
                <td
                  key={col.header}
                  className={cn(
                    "py-2.5",
                    col.align === "right" ? "text-right pl-3" : "text-left pr-3",
                    col.className
                  )}
                >
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-6">{emptyMessage}</p>
      )}
      {viewAllHref && rows.length > 0 && (
        <div className="pt-2 text-right">
          <Link to={viewAllHref} className="text-[11px] text-primary hover:underline font-medium">
            View all &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
