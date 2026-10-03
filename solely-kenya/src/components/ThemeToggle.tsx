import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/**
 * Compact appearance switch: three 28px icon buttons, no labels. People set
 * this about once, so it stays small and quiet. "System" (the default)
 * follows the phone or computer setting. Built with inline-flex and fixed
 * sizes so no layout rule can stretch or stack it.
 */
export const ThemeToggle = ({ className }: { className?: string }) => {
  const { theme, setTheme } = useTheme();
  // The stored theme is only known after mount; show nothing selected until
  // then so the first paint never highlights the wrong option.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = mounted ? theme ?? "system" : undefined;
  const index = OPTIONS.findIndex((o) => o.value === current);

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className={cn("relative inline-flex w-fit shrink-0 rounded-full border border-border p-0.5", className)}
    >
      {index >= 0 && (
        <span
          aria-hidden
          className="absolute left-0.5 top-0.5 h-7 w-7 rounded-full bg-muted transition-transform duration-200 ease-out-strong"
          style={{ transform: `translateX(${index * 28}px)` }}
        />
      )}
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const on = current === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full transition-colors duration-150",
              on ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon size={14} strokeWidth={1.75} />
          </button>
        );
      })}
    </div>
  );
};
