import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';

const DISMISSED_KEY = 'install_banner_dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export function SmartInstallBanner() {
    const { canInstall, isInstalled, promptInstall } = usePWAInstall();
    const [isVisible, setIsVisible] = useState(false);
    const [lastScrollY, setLastScrollY] = useState(0);
    const [isDismissed, setIsDismissed] = useState(true);

    // Check if banner was recently dismissed
    useEffect(() => {
        const dismissedAt = localStorage.getItem(DISMISSED_KEY);
        if (dismissedAt) {
            const timeSince = Date.now() - parseInt(dismissedAt, 10);
            if (timeSince >= DISMISS_DURATION) {
                setIsDismissed(false);
            }
        } else {
            setIsDismissed(false);
        }
    }, []);

    // Handle scroll direction detection
    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            // Show banner when scrolling up and past 100px
            if (currentScrollY < lastScrollY && currentScrollY > 100) {
                setIsVisible(true);
            } else if (currentScrollY > lastScrollY) {
                setIsVisible(false);
            }

            // Hide at top of page
            if (currentScrollY < 50) {
                setIsVisible(false);
            }

            setLastScrollY(currentScrollY);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    // Don't render if already installed, dismissed, or can't install
    if (isInstalled || isDismissed || !canInstall) {
        return null;
    }

    const handleInstall = async () => {
        const installed = await promptInstall();
        if (installed) {
            setIsVisible(false);
        }
    };

    const handleDismiss = () => {
        localStorage.setItem(DISMISSED_KEY, Date.now().toString());
        setIsDismissed(true);
        setIsVisible(false);
    };

    return (
        <div
            className={`fixed top-0 left-0 right-0 z-[60] transform transition-transform duration-300 ease-out ${isVisible ? 'translate-y-0' : '-translate-y-full'
                }`}
        >
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg">
                <div className="container mx-auto px-4 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                        {/* App info */}
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center flex-shrink-0 shadow-md">
                                <Download size={16} strokeWidth={1.5} className=" text-white" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-medium truncate">Get the Sole-ly App</p>
                                <p className="text-xs text-slate-400 truncate">Faster, offline access</p>
                            </div>
                        </div>

                        {/* Actions - Install and X on same line */}
                        <div className="flex items-center gap-1 flex-shrink-0 flex-nowrap">
                            <button
                                onClick={handleInstall}
                                className="px-4 py-1.5 text-sm font-semibold rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 transition-colors shadow-sm"
                            >
                                Install
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="p-1 rounded-full hover:bg-slate-700 transition-colors ml-1"
                                aria-label="Dismiss"
                            >
                                <X size={16} strokeWidth={1.5} className=" text-slate-400" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
