import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Download, Clock, CheckCircle, XCircle } from 'lucide-react';

interface Payout {
    id: string;
    amount_ksh: number;
    status: string;
    method: string;
    reference: string | null;
    trigger_type: string;
    balance_before: number | null;
    fee_paid_by: string;
    requested_at: string;
    processed_at: string | null;
}

export function PayoutHistory({ vendorId }: { vendorId: string }) {
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
            <Card>
                <CardContent className="p-6">
                    <div className="text-center text-muted-foreground">Loading history...</div>
                </CardContent>
            </Card>
        );
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'paid':
            case 'completed':
                return 'default';
            case 'processing':
            case 'pending':
                return 'secondary';
            case 'failed':
                return 'destructive';
            default:
                return 'outline';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'paid':
            case 'completed':
                return <CheckCircle strokeWidth={1.5} className="h-3 w-3" />;
            case 'processing':
            case 'pending':
                return <Clock strokeWidth={1.5} className="h-3 w-3" />;
            case 'failed':
                return <XCircle strokeWidth={1.5} className="h-3 w-3" />;
            default:
                return null;
        }
    };

    return (
        <Card className="border-2">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Download size={20} strokeWidth={1.5}  />
                    Payout History
                </CardTitle>
            </CardHeader>
            <CardContent>
                {!payouts || payouts.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-8">No payouts yet.</p>
                ) : (
                    <div className="space-y-3">
                        {payouts.map((payout) => (
                            <div key={payout.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                                <div className="space-y-1 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium">KES {payout.amount_ksh.toLocaleString()}</p>
                                        <Badge variant={payout.trigger_type === 'automatic' ? 'default' : 'secondary'} className="text-xs">
                                            {payout.trigger_type}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {format(new Date(payout.requested_at), 'MMM dd, yyyy h:mm a')}
                                    </p>
                                    {payout.fee_paid_by === 'vendor' && (
                                        <p className="text-xs text-amber-600 dark:text-amber-400">
                                            Fee: KES 100 (paid by you)
                                        </p>
                                    )}
                                    {payout.reference && (
                                        <p className="text-xs text-muted-foreground">
                                            Ref: {payout.reference}
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <Badge variant={getStatusColor(payout.status)} className="flex items-center gap-1">
                                        {getStatusIcon(payout.status)}
                                        {payout.status}
                                    </Badge>
                                    {payout.balance_before && (
                                        <span className="text-xs text-muted-foreground">
                                            Balance: {payout.balance_before.toLocaleString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
