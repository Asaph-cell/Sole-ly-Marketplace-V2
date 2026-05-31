import { Wrench, Mail } from "lucide-react";

export default function Maintenance() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-50 p-4 text-center">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-neutral-100">
                <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Wrench size={40} strokeWidth={1.5} className="text-primary" />
                </div>

                <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-4">
                    We'll be back soon!
                </h1>

                <p className="text-neutral-600 mb-8 leading-relaxed">
                    Sole-ly Kenya is currently undergoing scheduled maintenance to improve your shopping experience. We apologize for the inconvenience.
                </p>

                <div className="space-y-4">
                    <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                        <h3 className="font-semibold text-neutral-800 mb-1">Need help?</h3>
                        <p className="text-sm text-neutral-500 mb-2">
                            For urgent inquiries, please contact us via email.
                        </p>
                        <a
                            href="mailto:contact@solelymarketplace.com"
                            className="inline-flex items-center gap-2 text-amber-600 font-medium hover:underline"
                        >
                            <Mail size={16} strokeWidth={1.5}  />
                            contact@solelymarketplace.com
                        </a>
                    </div>
                </div>

                <div className="mt-8 text-xs text-neutral-400">
                    &copy; {new Date().getFullYear()} Sole-ly Kenya. All rights reserved.
                </div>
            </div>
        </div>
    );
}
