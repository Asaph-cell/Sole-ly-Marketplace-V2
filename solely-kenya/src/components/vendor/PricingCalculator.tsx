import React from 'react';
import { Lightbulb, Wallet } from 'lucide-react';

interface PricingCalculatorProps {
  price: number;
}

export const PricingCalculator: React.FC<PricingCalculatorProps> = ({ price }) => {
  if (!price || isNaN(price) || price <= 0) return null;

  const solelyFee = Math.ceil(price * 0.06);
  const txFee = price > 1000 ? 100 : 20;
  const youReceive = price - solelyFee - txFee;
  
  // Calculate what they should charge to receive 'price' amount exactly
  // priceToCharge - (priceToCharge * 0.06) - txFee(based on priceToCharge) = price
  // priceToCharge * 0.94 = price + txFee
  // priceToCharge = (price + txFee) / 0.94
  // Note: the txFee might jump to 100 if the bumped price crosses 1000, so we should check the bumped price to determine the correct txFee for the suggestion.
  let suggestedTxFee = price > 1000 ? 100 : 20;
  let suggestedPrice = Math.ceil((price + suggestedTxFee) / 0.94);
  
  // Recalculate if the suggestion crossed the 1000 threshold
  if (suggestedPrice > 1000 && suggestedTxFee === 20) {
    suggestedTxFee = 100;
    suggestedPrice = Math.ceil((price + suggestedTxFee) / 0.94);
  }

  return (
    <div className="mt-4 bg-muted/30 rounded-xl p-4 border border-dashed border-border/80">
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Your Breakdown:</h4>
        
        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span className="text-muted-foreground">Solely Fee (6%)</span>
          </div>
          <span className="font-medium text-destructive">- {solelyFee.toLocaleString()} KSh</span>
        </div>
        
        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <span className="text-muted-foreground">M-Pesa/Bank Fee</span>
          </div>
          <span className="font-medium text-destructive">- {txFee.toLocaleString()} KSh</span>
        </div>

        <div className="pt-3 mt-3 border-t border-border flex justify-between items-center">
          <div className="flex items-center gap-2 font-semibold">
            <Wallet size={16} className="text-amber-500" />
            <span>YOU WILL RECEIVE:</span>
          </div>
          <span className="font-bold text-lg">{youReceive.toLocaleString()} KSh</span>
        </div>
        
        <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex gap-3">
          <Lightbulb size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm leading-relaxed">
            <span className="font-medium text-amber-700 dark:text-amber-400">Suggestion: </span>
            <span className="text-amber-700/90 dark:text-amber-400/90">
              Set price to <span className="font-bold">{suggestedPrice.toLocaleString()} KSh</span> to clear a full {price.toLocaleString()} KSh profit.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
