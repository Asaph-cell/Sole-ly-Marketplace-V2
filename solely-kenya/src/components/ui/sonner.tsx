import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

import { CheckCircle2, Info, XCircle } from "lucide-react";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-sm rounded-lg p-4",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:border-success/30",
          error: "group-[.toaster]:border-destructive/30",
          info: "group-[.toaster]:border-primary/30",
        },
      }}
      icons={{
        success: <CheckCircle2 className="text-success" size={20} strokeWidth={1.5} />,
        error: <XCircle className="text-destructive" size={20} strokeWidth={1.5} />,
        info: <Info className="text-primary" size={20} strokeWidth={1.5} />,
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
