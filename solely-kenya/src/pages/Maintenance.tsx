import { Wrench, Mail } from "lucide-react";

export default function Maintenance() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-muted p-4 text-center">
            <div className="bg-card p-8 rounded-2xl shadow-xl max-w-md w-full border border-border">
                <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Wrench size={40} strokeWidth={1.5} className="text-primary" />
                </div>

                <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
                    We'll be back soon!
                </h1>

                <p className="text-muted-foreground mb-8 leading-relaxed">
                    Solely Kenya is currently undergoing scheduled maintenance to improve your shopping experience. We apologize for the inconvenience.
                </p>

                <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg border border-border">
                        <h3 className="font-semibold text-foreground mb-1">Need help?</h3>
                        <p className="text-sm text-muted-foreground mb-2">
                            For urgent inquiries, please contact us via email.
                        </p>
                        <a
                            href="mailto:contact@solelymarketplace.com"
                            className="inline-flex items-center gap-2 text-primary-strong font-medium hover:underline"
                        >
                            <Mail size={16} strokeWidth={1.5}  />
                            contact@solelymarketplace.com
                        </a>
                    </div>
                </div>

                <div className="mt-8 text-xs text-muted-foreground">
                    &copy; {new Date().getFullYear()} Solely Kenya. All rights reserved.
                </div>
            </div>
        </div>
    );
}
