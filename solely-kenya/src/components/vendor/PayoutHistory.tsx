import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { format } from 'date-fns';

// Row type straight from the database schema, so it can't drift from the table.
type Payout = Tables<"payouts">;

const STATUS_TONE: Record<string, string> = {
    paid: 'bg-emerald-500',
    completed: 'bg-emerald-500',
    processing: 'bg-primary',
    pending: 'bg-primary',
    failed: 'bg-destructive',
};

// Compact list of withdrawals. Shows the latest few and expands in place, so
// the history is there when needed without taking over the dashboard.
export function PayoutHistory({ vendorId, initial = 3 }: { vendorId: string; initial?: number }) {
    const [expanded, setExpanded] = useState(false);
    const { data: payouts, isLoading } = useQuery<Payout[]>({
        queryKey: ['payouts', vendorId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('payouts')
                .select('*')
                .eq('vendor_id', vendorId)
                .is('order_id', null)
                .order('requested_at', { ascending: false })
                .limit(20);

            if (error) throw error;
            return data || [];
        },
    });

    if (isLoading) {
        return (
            <div className="space-y-2">
                {[0, 1].map((i) => <div key={i} className="h-9 rounded-md bg-foreground/5 animate-pulse" />)}
            </div>
        );
    }

    if (!payouts || payouts.length === 0) {
        return <p className="text-xs text-muted-foreground">No withdrawals yet.</p>;
    }

    const shown = expanded ? payouts : payouts.slice(0, initial);

    return (
        <div>
            <ul className="divide-y divide-foreground/10">
                {shown.map((payout) => (
                    <li key={payout.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                        <div className="min-w-0">
                            <p className="text-sm font-medium tabular-nums">KES {payout.amount_ksh.toLocaleString()}</p>
                            <p className="text-[11px] text-muted-foreground">
                                {format(new Date(payout.requested_at), 'd MMM, h:mm a')}
                            </p>
                        </div>
                        <span className="flex items-center gap-1.5 text-xs capitalize text-muted-foreground shrink-0">
                            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_TONE[payout.status] ?? 'bg-muted-foreground'}`} />
                            {payout.status}
                        </span>
                    </li>
                ))}
            </ul>
            {payouts.length > initial && (
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-1 text-xs font-medium text-foreground/70 underline-offset-4 hover:text-foreground hover:underline"
                >
                    {expanded ? 'Show less' : `Show all ${payouts.length}`}
                </button>
            )}
        </div>
    );
}
