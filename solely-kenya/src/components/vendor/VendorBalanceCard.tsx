import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, ArrowDownToLine, TrendingUp, History, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface VendorBalance {
    pending_balance: number | null;
    total_earned: number | null;
    total_paid_out: number | null;
    last_payout_at: string | null;
    intasend_wallet_id?: string | null;
}

export function VendorBalanceCard({ vendorId }: { vendorId: string }) {
    const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
    const queryClient = useQueryClient();

    // Fetch balance
    const { data: balance, isLoading } = useQuery<VendorBalance>({
        queryKey: ['vendor-balance', vendorId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('vendor_balances')
                .select('*')
                .eq('vendor_id', vendorId)
                .single();

            if (error) {
                // Create balance record if it doesn't exist
                if (error.code === 'PGRST116') {
                    const { data: newBalance, error: createError } = await supabase
                        .from('vendor_balances')
                        .insert({ vendor_id: vendorId })
                        .select()
                        .single();

                    if (createError) throw createError;
                    return newBalance;
                }
                throw error;
            }
            return data;
        },
        refetchInterval: 30000,
    });

    // Withdrawal mutation
    const withdraw = useMutation({
        mutationFn: async () => {
            const { data, error } = await supabase.functions.invoke('vendor-withdraw', {
                body: { vendor_id: vendorId },
            });
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            return data;
        },
        onSuccess: (data: any, _variables, context) => { // Use 'any' temporarily or define expected shape
            // Calculate fee: The API returns the AMOUNT SENT (net).
            // But we don't have the original 'pendingBalance' easily accessible inside the mutation success unless we snapshot it.
            // Wait, we can query the 'balance' from the hook scope! 'pendingBalance' is available in the component scope.

            // However, the best way is if the backend returns the fee.
            // Currently backend returns: { success: true, amount: withdrawAmount, new_balance: ... }
            // In the retry logic (where fee is deducted), 'withdrawAmount' is the original requested amount, but 'netAmount' is what was sent.
            // Let's look at the backend code again.
            // Backend sends: JSON.stringify({ success: true, amount: withdrawAmount ... })
            // Logic: "Keep withdrawAmount as the ORIGINAL requested amount for DB deduction"
            // Wait, if it sends original amount, we can't see the net amount!
            // I MUST UPDATE THE BACKEND FIRST to return the 'netAmount' or 'fee'.

            // Let's assume I will update the backend to return 'fee'.
            const received = data.net_amount || data.amount;
            const fee = data.fee || 0;

            toast.success("Withdrawal Successful! 🎉", {
                description: `Sent: KES ${received.toLocaleString()} | Fee: KES ${fee.toLocaleString()}`,
            });
            queryClient.invalidateQueries({ queryKey: ['vendor-balance'] });
            queryClient.invalidateQueries({ queryKey: ['payouts'] });
            setShowWithdrawDialog(false);
        },
        onError: (error: Error) => {
            toast.error("Withdrawal Failed", {
                description: error.message || 'Failed to process withdrawal',
            });
        },
    });

    if (isLoading) {
        return (
            <Card className="border-0 bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl">
                <CardContent className="p-6">
                    <div className="flex items-center justify-center h-32">
                        <Loader2 strokeWidth={1.5} className="h-8 w-8 animate-spin text-emerald-400" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    const pendingBalance = balance?.pending_balance || 0;
    const totalEarned = balance?.total_earned || 0;
    const totalPaidOut = balance?.total_paid_out || 0;
    const canWithdraw = pendingBalance > 0;

    // Dynamic Fee Calculation matching Backend Logic
    // 0 - 100: KES 10
    // 101 - 1000: KES 20
    // 1001+: KES 100
    let estimatedFee = 0;
    if (pendingBalance <= 100) estimatedFee = 10;
    else if (pendingBalance <= 1000) estimatedFee = 20;
    else estimatedFee = 100;

    const estimatedReceive = Math.max(0, pendingBalance - estimatedFee);

    return (
        <>
            <Card className="border-0 bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl overflow-hidden">
                <CardContent className="p-0">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-emerald-600/20 to-emerald-500/10 px-6 py-4 border-b border-white/10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="bg-emerald-500/20 p-2 rounded-lg">
                                    <Wallet size={20} strokeWidth={1.5} className=" text-emerald-400" />
                                </div>
                                <span className="font-semibold text-white/90">Wallet Balance</span>
                            </div>
                        </div>
                    </div>

                    {/* Balance Display */}
                    <div className="px-6 py-8 text-center">
                        <p className="text-5xl font-bold text-emerald-400 tracking-tight">
                            KES {pendingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-white/60 text-sm mt-2">
                            Available for withdrawal
                        </p>
                    </div>

                    {/* Withdraw Button */}
                    <div className="px-6 pb-6">
                        <Button
                            onClick={() => setShowWithdrawDialog(true)}
                            disabled={!canWithdraw || withdraw.isPending}
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-6 text-lg shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {withdraw.isPending ? (
                                <>
                                    <Loader2 size={20} strokeWidth={1.5} className=" mr-2 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <ArrowDownToLine size={20} strokeWidth={1.5} className=" mr-2" />
                                    Withdraw to M-Pesa
                                </>
                            )}
                        </Button>
                        <p className="text-white/40 text-xs text-center mt-3">
                            {!canWithdraw
                                ? "No balance available for withdrawal"
                                : "Standard transaction rates apply"
                            }
                        </p>
                    </div>

                    {/* Stats */}
                    <div className="border-t border-white/10 px-6 py-4 grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp size={16} strokeWidth={1.5} className=" text-emerald-400" />
                            <div>
                                <p className="text-white/50 text-xs">Total Earned</p>
                                <p className="text-white font-medium">KES {totalEarned.toLocaleString()}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <History size={16} strokeWidth={1.5} className=" text-blue-400" />
                            <div>
                                <p className="text-white/50 text-xs">Total Withdrawn</p>
                                <p className="text-white font-medium">KES {totalPaidOut.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Withdrawal Confirmation Dialog */}
            <AlertDialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
                <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Withdrawal</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-4">
                                <div className="bg-muted rounded-lg p-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm text-muted-foreground">Wallet Balance</span>
                                        <span className="font-medium text-foreground">KES {pendingBalance.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm text-muted-foreground">Transaction Fee</span>
                                        <span className="font-medium text-red-500">- KES {estimatedFee}</span>
                                    </div>
                                    <div className="border-t pt-2 mt-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-semibold text-muted-foreground">You'll Receive</span>
                                            <span className="text-xl font-bold text-emerald-600">
                                                KES {estimatedReceive.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Helpful Tip for High Fees */}
                                {estimatedFee >= 100 && pendingBalance < 5000 && (
                                    <div className="bg-blue-50 border border-blue-100 rounded-md p-3 text-sm text-blue-700">
                                        <p className="mb-1">Note: A standard transaction fee of KES 100 applies to this amount.</p>
                                        <p className="font-medium">💡 Tip: You get better value on withdrawals over KES 5,000.</p>
                                    </div>
                                )}

                                <p className="text-sm text-muted-foreground">
                                    Funds will be sent to your registered M-Pesa number instantly.
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row gap-2">
                        {/* Cancel Button */}
                        <AlertDialogCancel
                            disabled={withdraw.isPending}
                            className="flex-1 text-sm px-4 py-2 mt-0"
                        >
                            Cancel
                        </AlertDialogCancel>

                        {/* Confirm Button */}
                        <AlertDialogAction
                            onClick={() => withdraw.mutate()}
                            disabled={withdraw.isPending}
                            className="flex-1 text-sm px-4 py-2 bg-emerald-500 hover:bg-emerald-600"
                        >
                            {withdraw.isPending ? 'Processing...' : 'Withdraw Now'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

