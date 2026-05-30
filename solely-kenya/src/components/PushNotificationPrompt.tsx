import { Bell, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useState } from 'react';

interface PushNotificationPromptProps {
    variant?: 'modal' | 'banner' | 'inline';
    onClose?: () => void;
}

export function PushNotificationPrompt({
    variant = 'banner',
    onClose
}: PushNotificationPromptProps) {
    const {
        isSupported,
        permission,
        isSubscribed,
        isLoading,
        shouldShowPrompt,
        subscribe,
        dismissPrompt,
        error
    } = usePushNotifications();

    const [isVisible, setIsVisible] = useState(true);

    // Don't render if already subscribed, not supported, or shouldn't show
    if (!isSupported || isSubscribed || !shouldShowPrompt || !isVisible) {
        return null;
    }

    // Don't show if browser has blocked notifications
    if (permission === 'denied') {
        return null;
    }

    const handleEnable = async () => {
        const success = await subscribe();
        if (success) {
            setIsVisible(false);
            onClose?.();
        }
    };

    const handleLater = () => {
        dismissPrompt();
        setIsVisible(false);
        onClose?.();
    };

    if (variant === 'modal') {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative animate-in fade-in zoom-in duration-300">
                    <button
                        onClick={handleLater}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                    >
                        <X size={20} strokeWidth={1.5}  />
                    </button>

                    <div className="text-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Bell strokeWidth={1.5} className="w-8 h-8 text-white" />
                        </div>

                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                            Never Miss a Sale! 🛒
                        </h3>

                        <p className="text-gray-600 mb-4">
                            Enable notifications to get <strong>instant alerts</strong> when customers place orders.
                            You'll be notified even when you're not on the website.
                        </p>

                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-left">
                            <div className="flex items-start gap-2">
                                <AlertTriangle size={20} strokeWidth={1.5} className=" text-amber-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-amber-800">
                                    <strong>Important:</strong> Orders must be confirmed within 48 hours or they'll be automatically cancelled.
                                    Notifications help you respond quickly!
                                </p>
                            </div>
                        </div>

                        {error && (
                            <p className="text-red-500 text-sm mb-4">{error}</p>
                        )}

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={handleLater}
                                disabled={isLoading}
                            >
                                Maybe Later
                            </Button>
                            <Button
                                className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                                onClick={handleEnable}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <span className="flex items-center gap-2">
                                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Enabling...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <Bell size={16} strokeWidth={1.5}  />
                                        Enable Notifications
                                    </span>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Banner variant (for top of page)
    if (variant === 'banner') {
        return (
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-4 py-3 relative">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                            <Bell size={20} strokeWidth={1.5}  />
                        </div>
                        <div>
                            <p className="font-medium">
                                🔔 Enable notifications to never miss new orders!
                            </p>
                            <p className="text-sm text-amber-100">
                                Get instant alerts even when you're not on the website.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-white hover:bg-white/20"
                            onClick={handleLater}
                            disabled={isLoading}
                        >
                            Later
                        </Button>
                        <Button
                            size="sm"
                            className="bg-white text-amber-600 hover:bg-amber-50"
                            onClick={handleEnable}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Enabling...' : 'Enable Now'}
                        </Button>
                    </div>
                </div>

                <button
                    onClick={handleLater}
                    className="absolute top-2 right-2 text-white/70 hover:text-white"
                >
                    <X size={16} strokeWidth={1.5}  />
                </button>
            </div>
        );
    }

    // Inline variant (for settings or sidebar)
    return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Bell size={20} strokeWidth={1.5} className="text-primary" />
                </div>
                <div className="flex-1">
                    <h4 className="font-medium text-amber-900 mb-1">
                        Enable Order Notifications
                    </h4>
                    <p className="text-sm text-amber-700 mb-3">
                        Get instant alerts when customers place orders, even when you're away.
                    </p>
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="border-amber-300 text-amber-700 hover:bg-amber-100"
                            onClick={handleLater}
                            disabled={isLoading}
                        >
                            Later
                        </Button>
                        <Button
                            size="sm"
                            className="bg-amber-500 hover:bg-amber-600 text-white"
                            onClick={handleEnable}
                            disabled={isLoading}
                        >
                            {isLoading ? 'Enabling...' : 'Enable'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Small notification bell icon for sidebar (shows when notifications not enabled)
export function NotificationBellIndicator() {
    const { isSubscribed, shouldShowPrompt, subscribe, isLoading } = usePushNotifications();
    const [showTooltip, setShowTooltip] = useState(false);

    if (isSubscribed) {
        return (
            <div className="relative">
                <Bell size={20} strokeWidth={1.5} className=" text-green-500" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
            </div>
        );
    }

    if (!shouldShowPrompt) {
        return <Bell size={20} strokeWidth={1.5} className=" text-gray-400" />;
    }

    return (
        <div className="relative">
            <button
                onClick={() => subscribe()}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                disabled={isLoading}
                className="relative"
            >
                <Bell size={20} strokeWidth={1.5} className=" text-amber-500" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            </button>

            {showTooltip && (
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-50">
                    Enable notifications
                </div>
            )}
        </div>
    );
}
