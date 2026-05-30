import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface UsePWAInstallReturn {
    canInstall: boolean;
    isInstalled: boolean;
    isIOS: boolean;
    promptInstall: () => Promise<boolean>;
}

const DISMISSED_KEY = 'pwa_install_dismissed';
const INSTALLED_KEY = 'pwa_installed';

export function usePWAInstall(): UsePWAInstallReturn {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);

    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Detect iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIosDevice);

        // Check if already installed (standalone mode OR previously recorded)
        const checkInstalled = async () => {
            let installed = window.matchMedia('(display-mode: standalone)').matches
                || (window.navigator as any).standalone === true
                || document.referrer.includes('android-app://')
                || localStorage.getItem(INSTALLED_KEY) === 'true';

            // Modern API to check if PWA is installed (works in browser tabs too)
            if (!installed && 'getInstalledRelatedApps' in navigator) {
                try {
                    const relatedApps = await (navigator as any).getInstalledRelatedApps();
                    if (relatedApps && relatedApps.length > 0) {
                        installed = true;
                    }
                } catch (e) {
                    console.log('getInstalledRelatedApps error', e);
                }
            }

            setIsInstalled(installed);

            // If standalone, record it for future browser visits
            if (installed) {
                localStorage.setItem(INSTALLED_KEY, 'true');
            }
        };

        checkInstalled();

        // Listen for display mode changes
        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        const handleChange = (e: MediaQueryListEvent) => {
            setIsInstalled(e.matches);
        };
        mediaQuery.addEventListener('change', handleChange);

        // Listen for beforeinstallprompt event
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            console.log('[PWA] Install prompt captured');
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Listen for successful install
        const handleAppInstalled = () => {
            console.log('[PWA] App installed');
            setDeferredPrompt(null);
            setIsInstalled(true);
            localStorage.setItem(INSTALLED_KEY, 'true');
            localStorage.removeItem(DISMISSED_KEY);
        };

        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
            mediaQuery.removeEventListener('change', handleChange);
        };
    }, []);

    const promptInstall = useCallback(async (): Promise<boolean> => {
        if (!deferredPrompt) {
            console.log('[PWA] No install prompt available');
            return false;
        }

        try {
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;

            if (outcome === 'accepted') {
                console.log('[PWA] User accepted install');
                setDeferredPrompt(null);
                return true;
            } else {
                console.log('[PWA] User dismissed install');
                localStorage.setItem(DISMISSED_KEY, Date.now().toString());
                return false;
            }
        } catch (error) {
            console.error('[PWA] Install prompt error:', error);
            return false;
        }
    }, [deferredPrompt]);

    return {
        canInstall: (!!deferredPrompt || isIOS) && !isInstalled,
        isInstalled,
        isIOS,
        promptInstall,
    };
}
