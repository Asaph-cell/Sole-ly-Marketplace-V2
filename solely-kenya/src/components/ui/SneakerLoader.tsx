interface SneakerLoaderProps {
    message?: string;
    size?: "sm" | "md" | "lg";
    fullScreen?: boolean;
}

export const SneakerLoader = ({
    message = "Loading...",
    size = "md",
    fullScreen = true
}: SneakerLoaderProps) => {
    const sizeClasses = {
        sm: { ring: "w-16 h-16", icon: "w-6 h-6", shadow: "w-10 h-1.5" },
        md: { ring: "w-24 h-24", icon: "w-10 h-10", shadow: "w-16 h-2" },
        lg: { ring: "w-32 h-32", icon: "w-14 h-14", shadow: "w-20 h-2.5" },
    };

    const { ring, icon, shadow } = sizeClasses[size];

    return (
        <div className={`flex flex-col items-center justify-center gap-6 ${fullScreen ? "min-h-screen" : "py-12"}`}>
            {/* Marketplace Loader */}
            <div className="relative">
                {/* Outer spinning ring */}
                <div className={`${ring} rounded-full border-4 border-muted`}></div>
                <div className={`absolute inset-0 ${ring} rounded-full border-4 border-primary border-t-transparent animate-spin`}></div>

                {/* Shopping bag icon in center */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-bounce">
                        <svg
                            className={`${icon} text-primary`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <path d="M16 10a4 4 0 0 1-8 0" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Pulsing shadow beneath */}
            <div className={`${shadow} bg-primary/20 rounded-full animate-pulse`}></div>

            {/* Loading text */}
            <p className="text-muted-foreground text-sm font-medium">{message}</p>
        </div>
    );
};
