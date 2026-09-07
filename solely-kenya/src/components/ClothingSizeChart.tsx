import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Info } from "lucide-react";

// Body measurements in cm, standard international letter sizing. Ranges
// rather than points, because a given size covers a band of bodies.
const womensChart = [
    { size: "XS", bust: "78 - 82", waist: "60 - 64", hip: "86 - 90", uk: "6", us: "2" },
    { size: "S", bust: "82 - 86", waist: "64 - 68", hip: "90 - 94", uk: "8", us: "4" },
    { size: "M", bust: "86 - 92", waist: "68 - 74", hip: "94 - 100", uk: "10 - 12", us: "6 - 8" },
    { size: "L", bust: "92 - 98", waist: "74 - 80", hip: "100 - 106", uk: "14", us: "10" },
    { size: "XL", bust: "98 - 104", waist: "80 - 86", hip: "106 - 112", uk: "16", us: "12" },
    { size: "XXL", bust: "104 - 110", waist: "86 - 92", hip: "112 - 118", uk: "18", us: "14" },
];

const mensChart = [
    { size: "XS", chest: "84 - 89", waist: "71 - 76", collar: "36" },
    { size: "S", chest: "89 - 94", waist: "76 - 81", collar: "37 - 38" },
    { size: "M", chest: "94 - 99", waist: "81 - 86", collar: "39 - 40" },
    { size: "L", chest: "99 - 107", waist: "86 - 94", collar: "41 - 42" },
    { size: "XL", chest: "107 - 114", waist: "94 - 102", collar: "43 - 44" },
    { size: "XXL", chest: "114 - 122", waist: "102 - 109", collar: "45 - 46" },
];

const waistChart = [
    { inches: "28", cm: "71" },
    { inches: "30", cm: "76" },
    { inches: "32", cm: "81" },
    { inches: "34", cm: "86" },
    { inches: "36", cm: "91" },
    { inches: "38", cm: "97" },
    { inches: "40", cm: "102" },
    { inches: "42", cm: "107" },
];

export type ClothingChartKind = "womens" | "mens" | "waist";

/**
 * Which chart a product needs. `products.category` holds only the ten
 * top-level keys from categories.ts (the subcategory lives in its own
 * column), so only those are matched here.
 *
 * Shoes bail out first - they have their own conversion chart, and their
 * EU sizes are numeric, which would otherwise be read as waist inches.
 * Beyond that the sizes themselves are the better signal than the category:
 * a vendor listing trousers under mens-fashion types "30, 32, 34", and
 * those are waist measurements whatever the category says.
 */
export function clothingChartKind(category?: string, sizes?: string[]): ClothingChartKind | null {
    if (!category || category === "shoes") return null;
    if (category !== "womens-fashion" && category !== "mens-fashion") return null;

    const looksNumeric = sizes?.length ? sizes.every((s) => /^\d+(\.\d+)?$/.test(s.trim())) : false;
    if (looksNumeric) return "waist";

    return category === "womens-fashion" ? "womens" : "mens";
}

interface ClothingSizeChartProps {
    kind: ClothingChartKind;
    selectedSize?: string;
    availableSizes?: string[];
}

export const ClothingSizeChart = ({ kind, selectedSize, availableSizes }: ClothingSizeChartProps) => {
    const [open, setOpen] = useState(false);

    const isAvailable = (size: string) =>
        !availableSizes || availableSizes.length === 0 || availableSizes.includes(size);

    const rowClass = (size: string) =>
        `border-b transition-colors ${
            size === selectedSize
                ? "bg-primary/20 font-medium"
                : isAvailable(size)
                ? "hover:bg-muted/30"
                : "opacity-40"
        }`;

    const title =
        kind === "womens" ? "Women's Size Guide" : kind === "mens" ? "Men's Size Guide" : "Waist Size Guide";

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 px-2 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
                >
                    <Info strokeWidth={1.5} className="w-3 h-3 mr-1" />
                    Size Guide
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>

                <div className="overflow-x-auto">
                    {kind === "womens" && (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/50">
                                    <th className="p-2 text-left font-semibold">Size</th>
                                    <th className="p-2 text-left font-semibold">Bust (cm)</th>
                                    <th className="p-2 text-left font-semibold">Waist (cm)</th>
                                    <th className="p-2 text-left font-semibold">Hip (cm)</th>
                                    <th className="p-2 text-left font-semibold">UK</th>
                                    <th className="p-2 text-left font-semibold">US</th>
                                </tr>
                            </thead>
                            <tbody>
                                {womensChart.map((row) => (
                                    <tr key={row.size} className={rowClass(row.size)}>
                                        <td className="p-2 font-medium">{row.size}</td>
                                        <td className="p-2">{row.bust}</td>
                                        <td className="p-2">{row.waist}</td>
                                        <td className="p-2">{row.hip}</td>
                                        <td className="p-2">{row.uk}</td>
                                        <td className="p-2">{row.us}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {kind === "mens" && (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/50">
                                    <th className="p-2 text-left font-semibold">Size</th>
                                    <th className="p-2 text-left font-semibold">Chest (cm)</th>
                                    <th className="p-2 text-left font-semibold">Waist (cm)</th>
                                    <th className="p-2 text-left font-semibold">Collar (cm)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mensChart.map((row) => (
                                    <tr key={row.size} className={rowClass(row.size)}>
                                        <td className="p-2 font-medium">{row.size}</td>
                                        <td className="p-2">{row.chest}</td>
                                        <td className="p-2">{row.waist}</td>
                                        <td className="p-2">{row.collar}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {kind === "waist" && (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/50">
                                    <th className="p-2 text-left font-semibold">Waist (inches)</th>
                                    <th className="p-2 text-left font-semibold">Waist (cm)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {waistChart.map((row) => (
                                    <tr key={row.inches} className={rowClass(row.inches)}>
                                        <td className="p-2 font-medium">{row.inches}"</td>
                                        <td className="p-2">{row.cm}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {availableSizes && availableSizes.length > 0 && (
                    <div className="mt-4 p-3 bg-muted rounded-lg text-sm">
                        <p className="font-medium mb-1">Available sizes for this product:</p>
                        <p className="text-primary font-semibold">{availableSizes.join(", ")}</p>
                    </div>
                )}

                <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                    <p>
                        <strong>Tip:</strong>{" "}
                        {kind === "waist"
                            ? "Measure around your natural waistline, keeping the tape snug but not tight."
                            : "Measure over light clothing, keeping the tape level and snug. If you fall between two sizes, size up."}
                    </p>
                    <p className="mt-1">Sizing varies between brands. Check the vendor's notes if you're unsure.</p>
                </div>
            </DialogContent>
        </Dialog>
    );
};
