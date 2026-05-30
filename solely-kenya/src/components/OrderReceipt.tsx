import { forwardRef } from "react";
import logo from "@/assets/solely-logo.svg";

interface ReceiptProps {
    order: {
        id: string;
        created_at: string;
        total_ksh: number;
        subtotal_ksh: number;
        shipping_fee_ksh: number;
        status: string;
        order_items: Array<{
            id: string;
            product_name: string;
            quantity: number;
            unit_price_ksh: number;
        }>;
        order_shipping_details: {
            recipient_name: string;
            address_line1: string;
            address_line2?: string;
            city: string;
            phone: string;
            delivery_type?: string;
        } | null;
    };
    vendorName?: string;
}

export const OrderReceipt = forwardRef<HTMLDivElement, ReceiptProps>(
    ({ order, vendorName }, ref) => {
        const orderDate = new Date(order.created_at);
        const receiptNumber = `SLY-${order.id.slice(0, 8).toUpperCase()}`;

        return (
            <div
                ref={ref}
                className="bg-white text-black p-8 max-w-2xl mx-auto"
                style={{ fontFamily: "Arial, sans-serif" }}
            >
                {/* Header */}
                <div className="flex justify-between items-start border-b-2 border-gray-300 pb-4 mb-6">
                    <div>
                        <img src={logo} alt="Solely" className="h-12 mb-2" />
                        <p className="text-sm text-gray-600">Solely Kenya Marketplace</p>
                        <p className="text-sm text-gray-600">contact@solelymarketplace.com</p>
                    </div>
                    <div className="text-right">
                        <h1 className="text-2xl font-bold text-gray-800">RECEIPT</h1>
                        <p className="text-sm text-gray-600 mt-1">#{receiptNumber}</p>
                        <p className="text-sm text-gray-600">
                            Date: {orderDate.toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "long",
                                year: "numeric"
                            })}
                        </p>
                    </div>
                </div>

                {/* Customer & Vendor Info */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                        <h3 className="font-semibold text-gray-700 mb-2">Bill To:</h3>
                        <p className="text-sm">{order.order_shipping_details?.recipient_name || "Customer"}</p>
                        {order.order_shipping_details?.delivery_type !== "pickup" && (
                            <>
                                <p className="text-sm text-gray-600">{order.order_shipping_details?.address_line1}</p>
                                {order.order_shipping_details?.address_line2 && (
                                    <p className="text-sm text-gray-600">{order.order_shipping_details.address_line2}</p>
                                )}
                                <p className="text-sm text-gray-600">{order.order_shipping_details?.city}</p>
                            </>
                        )}
                        <p className="text-sm text-gray-600">{order.order_shipping_details?.phone}</p>
                    </div>
                    <div className="text-right">
                        <h3 className="font-semibold text-gray-700 mb-2">Sold By:</h3>
                        <p className="text-sm">{vendorName || "Solely Vendor"}</p>
                        <p className="text-sm text-gray-600 mt-2">
                            <span className="font-medium">Order Status:</span>{" "}
                            <span className="text-green-600 font-semibold">COMPLETED</span>
                        </p>
                    </div>
                </div>

                {/* Items Table */}
                <table className="w-full mb-6">
                    <thead>
                        <tr className="border-b-2 border-gray-300">
                            <th className="text-left py-2 text-sm font-semibold text-gray-700">Item</th>
                            <th className="text-center py-2 text-sm font-semibold text-gray-700">Qty</th>
                            <th className="text-right py-2 text-sm font-semibold text-gray-700">Unit Price</th>
                            <th className="text-right py-2 text-sm font-semibold text-gray-700">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {order.order_items?.map((item) => (
                            <tr key={item.id} className="border-b border-gray-200">
                                <td className="py-3 text-sm">{item.product_name}</td>
                                <td className="py-3 text-sm text-center">{item.quantity}</td>
                                <td className="py-3 text-sm text-right">KES {item.unit_price_ksh.toLocaleString()}</td>
                                <td className="py-3 text-sm text-right font-medium">
                                    KES {(item.quantity * item.unit_price_ksh).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Totals */}
                <div className="flex justify-end">
                    <div className="w-64">
                        <div className="flex justify-between py-1 text-sm">
                            <span className="text-gray-600">Subtotal:</span>
                            <span>KES {order.subtotal_ksh.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-1 text-sm">
                            <span className="text-gray-600">Delivery Fee:</span>
                            <span>KES {(order.shipping_fee_ksh || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-2 border-t-2 border-gray-300 mt-2 text-lg font-bold">
                            <span>Total:</span>
                            <span>KES {order.total_ksh.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {/* Payment Info */}
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                        ✓ <strong>Payment Received</strong> - This order has been paid in full.
                    </p>
                </div>

                {/* Footer */}
                <div className="mt-8 pt-4 border-t border-gray-200 text-center text-sm text-gray-500">
                    <p>Thank you for shopping with Solely Kenya!</p>
                    <p className="mt-1">For any queries, contact us at contact@solelymarketplace.com</p>
                    <p className="mt-2 text-xs">
                        This is a computer-generated receipt and does not require a signature.
                    </p>
                </div>
            </div>
        );
    }
);

OrderReceipt.displayName = "OrderReceipt";
