import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowDownToLine, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "@/lib/toast";
import { PayoutHistory } from '@/components/vendor/PayoutHistory';
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

// Mirrors the tiers the vendor-withdraw function charges.
const withdrawFee = (amount: number) => (amount <= 100 ? 10 : amount <= 1000 ? 20 : 100);

export function VendorBalanceCard({ vendorId }: { vendorId: string }) {
    const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
    const queryClient = useQueryClient();

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

    const withdraw = useMutation({
        mutationFn: async () => {
            const { data, error } = await supabase.functions.invoke('vendor-withdraw', {
                body: { vendor_id: vendorId },
            });
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            return data;
        },
        onSuccess: (data: any) => {
            const received = data.net_amount || data.amount;
            const fee = data.fee || 0;

            toast.success("Withdrawal sent", {
                description: `KES ${received.toLocaleString()} to M-Pesa · fee KES ${fee.toLocaleString()}`,
            });
            queryClient.invalidateQueries({ queryKey: ['vendor-balance'] });
            queryClient.invalidateQueries({ queryKey: ['payouts'] });
            setShowWithdrawDialog(false);
        },
        onError: (error: Error) => {
            toast.error("Withdrawal failed", {
                description: error.message || 'Failed to process withdrawal',
            });
        },
    });

    const pendingBalance = balance?.pending_balance || 0;
    const totalEarned = balance?.total_earned || 0;
    const totalPaidOut = balance?.total_paid_out || 0;
    const estimatedFee = withdrawFee(pendingBalance);
    const estimatedReceive = Math.max(0, pendingBalance - estimatedFee);
    const canWithdraw = estimatedReceive > 0;

    return (
        <>
            <section className="rounded-2xl bg-cream p-5 sm:p-6" aria-labelledby="wallet-heading">
                <p id="wallet-heading" className="text-xs font-medium text-foreground/60">Available to withdraw</p>
                {isLoading ? (
                    <div className="mt-2 h-10 w-44 rounded-md bg-foreground/5 animate-pulse" />
                ) : (
                    <p className="mt-1 font-display text-4xl leading-tight tabular-nums">
                        <span className="mr-1.5 font-sans text-lg font-medium text-foreground/50">KES</span>
                        {pendingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                )}

                <Button
                    onClick={() => setShowWithdrawDialog(true)}
                    disabled={isLoading || !canWithdraw || withdraw.isPending}
                    className="mt-4 h-11 w-full rounded-full bg-foreground font-semibold text-background hover:bg-foreground/85"
                >
                    {withdraw.isPending ? (
                        <><Loader2 size={16} strokeWidth={1.75} className="animate-spin" /> Sending…</>
                    ) : (
                        <><ArrowDownToLine size={16} strokeWidth={1.75} /> Withdraw to M-Pesa</>
                    )}
                </Button>

                <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-foreground/10 pt-4">
                    <div>
                        <dt className="text-[11px] text-foreground/55">Earned all time</dt>
                        <dd className="text-sm font-semibold tabular-nums">KES {totalEarned.toLocaleString()}</dd>
                    </div>
                    <div>
                        <dt className="text-[11px] text-foreground/55">Withdrawn</dt>
                        <dd className="text-sm font-semibold tabular-nums">KES {totalPaidOut.toLocaleString()}</dd>
                    </div>
                </dl>

                <div className="mt-5 border-t border-foreground/10 pt-4">
                    <p className="mb-2.5 text-xs font-medium text-foreground/60">Recent withdrawals</p>
                    <PayoutHistory vendorId={vendorId} />
                </div>
            </section>

            <AlertDialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
                <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Withdraw to M-Pesa</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-4">
                                <div className="space-y-2 rounded-lg bg-muted p-4 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Wallet balance</span>
                                        <span className="font-medium tabular-nums text-foreground">KES {pendingBalance.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Transaction fee</span>
                                        <span className="font-medium tabular-nums text-foreground">− KES {estimatedFee}</span>
                                    </div>
                                    <div className="flex items-baseline justify-between border-t pt-2">
                                        <span className="font-semibold text-foreground">You'll receive</span>
                                        <span className="font-display text-2xl tabular-nums text-foreground">
                                            KES {estimatedReceive.toLocaleString()}
                                        </span>
                                    </div>
                                </div>

                                {estimatedFee >= 100 && pendingBalance < 5000 && (
                                    <p className="text-sm text-muted-foreground">
                                        The fee is a flat KES 100 above KES 1,000, so waiting until you have KES 5,000 or more gets you better value.
                                    </p>
                                )}

                                <p className="text-sm text-muted-foreground">
                                    Money goes to your registered M-Pesa number straight away.
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row gap-2">
                        <AlertDialogCancel disabled={withdraw.isPending} className="mt-0 flex-1 rounded-full">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => withdraw.mutate()}
                            disabled={withdraw.isPending}
                            className="flex-1 rounded-full bg-foreground text-background hover:bg-foreground/85"
                        >
                            {withdraw.isPending ? 'Sending…' : `Withdraw KES ${estimatedReceive.toLocaleString()}`}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
