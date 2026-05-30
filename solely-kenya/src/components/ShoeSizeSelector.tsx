import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Info } from "lucide-react";

// Comprehensive shoe size conversion chart
// Based on international sizing standards
const shoeSizeChart = [
    { uk: "3", us_m: "4", us_w: "5", eu: "36", cm: "22" },
    { uk: "3.5", us_m: "4.5", us_w: "5.5", eu: "36.5", cm: "22.5" },
    { uk: "4", us_m: "5", us_w: "6", eu: "37", cm: "23" },
    { uk: "4.5", us_m: "5.5", us_w: "6.5", eu: "37.5", cm: "23.5" },
    { uk: "5", us_m: "6", us_w: "7", eu: "38", cm: "24" },
    { uk: "5.5", us_m: "6.5", us_w: "7.5", eu: "38.5", cm: "24.5" },
    { uk: "6", us_m: "7", us_w: "8", eu: "39", cm: "25" },
    { uk: "6.5", us_m: "7.5", us_w: "8.5", eu: "40", cm: "25.5" },
    { uk: "7", us_m: "8", us_w: "9", eu: "40.5", cm: "26" },
    { uk: "7.5", us_m: "8.5", us_w: "9.5", eu: "41", cm: "26.5" },
    { uk: "8", us_m: "9", us_w: "10", eu: "42", cm: "27" },
    { uk: "8.5", us_m: "9.5", us_w: "10.5", eu: "42.5", cm: "27.5" },
    { uk: "9", us_m: "10", us_w: "11", eu: "43", cm: "28" },
    { uk: "9.5", us_m: "10.5", us_w: "11.5", eu: "44", cm: "28.5" },
    { uk: "10", us_m: "11", us_w: "12", eu: "44.5", cm: "29" },
    { uk: "10.5", us_m: "11.5", us_w: "12.5", eu: "45", cm: "29.5" },
    { uk: "11", us_m: "12", us_w: "13", eu: "46", cm: "30" },
    { uk: "11.5", us_m: "12.5", us_w: "13.5", eu: "46.5", cm: "30.5" },
    { uk: "12", us_m: "13", us_w: "14", eu: "47", cm: "31" },
    { uk: "13", us_m: "14", us_w: "15", eu: "48", cm: "32" },
];

interface ShoeSizeSelectorProps {
    selectedSize: string | undefined;
    onSizeChange: (size: string) => void;
    sizeSystem?: "uk" | "us_m" | "us_w" | "eu";
}

export const ShoeSizeSelector = ({
    selectedSize,
    onSizeChange,
    sizeSystem = "eu",
}: ShoeSizeSelectorProps) => {
    const [system, setSystem] = useState<"uk" | "us_m" | "us_w" | "eu">(sizeSystem);
    const [chartOpen, setChartOpen] = useState(false);

    const getSizeOptions = () => {
        return shoeSizeChart.map((row) => row[system]);
    };

    const formatSelectedSize = (size: string | undefined) => {
        if (!size) return "Select size";
        const sizeRow = shoeSizeChart.find((row) => row[system] === size);
        if (!sizeRow) return size;
        return `EU ${sizeRow.eu} / UK ${sizeRow.uk}`;
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Shoe Size</Label>
                <Dialog open={chartOpen} onOpenChange={setChartOpen}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground">
                            <Info strokeWidth={1.5} className="w-3 h-3 mr-1" />
                            Size Chart
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
                        <DialogHeader>
                            <DialogTitle>Shoe Size Conversion Chart</DialogTitle>
                        </DialogHeader>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        <th className="p-2 text-left font-semibold">EU</th>
                                        <th className="p-2 text-left font-semibold">UK</th>
                                        <th className="p-2 text-left font-semibold">US (M)</th>
                                        <th className="p-2 text-left font-semibold">US (W)</th>
                                        <th className="p-2 text-left font-semibold">CM</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {shoeSizeChart.map((row, idx) => (
                                        <tr
                                            key={idx}
                                            className={`border-b hover:bg-muted/30 ${row[system] === selectedSize ? "bg-primary/10" : ""
                                                }`}
                                        >
                                            <td className="p-2">{row.eu}</td>
                                            <td className="p-2">{row.uk}</td>
                                            <td className="p-2">{row.us_m}</td>
                                            <td className="p-2">{row.us_w}</td>
                                            <td className="p-2">{row.cm}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-4 p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                            <p><strong>Tip:</strong> Measure your foot in centimeters (CM) for the most accurate fit.</p>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="flex gap-2">
                <Select value={system} onValueChange={(v) => setSystem(v as typeof system)}>
                    <SelectTrigger className="w-24">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="eu">EU</SelectItem>
                        <SelectItem value="uk">UK</SelectItem>
                        <SelectItem value="us_m">US (M)</SelectItem>
                        <SelectItem value="us_w">US (W)</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={selectedSize} onValueChange={onSizeChange}>
                    <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                        {getSizeOptions().map((size) => (
                            <SelectItem key={size} value={size}>
                                {size}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {selectedSize && (
                <Badge variant="secondary" className="text-xs">
                    {formatSelectedSize(selectedSize)}
                </Badge>
            )}
        </div>
    );
};

export default ShoeSizeSelector;
