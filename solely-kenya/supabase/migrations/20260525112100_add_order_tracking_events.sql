CREATE TABLE order_tracking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL, 
    location TEXT,
    note TEXT,
    proof_image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for efficient querying
CREATE INDEX idx_order_tracking_events_order_id ON order_tracking_events(order_id);
CREATE INDEX idx_order_tracking_events_created_at ON order_tracking_events(created_at DESC);

-- RLS
ALTER TABLE order_tracking_events ENABLE ROW LEVEL SECURITY;

-- Vendors can insert tracking events for their orders
CREATE POLICY "Vendors can insert tracking events for their orders" 
ON order_tracking_events FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM orders 
        WHERE orders.id = order_tracking_events.order_id 
        AND orders.vendor_id = auth.uid()
    )
);

-- Buyers and Vendors can view tracking events for orders they are involved in
CREATE POLICY "Users can view tracking events for their orders" 
ON order_tracking_events FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM orders 
        WHERE orders.id = order_tracking_events.order_id 
        AND (orders.customer_id = auth.uid() OR orders.vendor_id = auth.uid())
    )
);
