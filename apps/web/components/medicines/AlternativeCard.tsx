interface AlternativeCardProps {
    name: string;
    manufacturer: string;
    price: number;
    savingsPercent: number | null;
}

export function AlternativeCard({
    name,
    manufacturer,
    price,
    savingsPercent,
}: AlternativeCardProps) {
    return (
        <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
                <p className="font-medium">{name}</p>
                <p className="text-muted-foreground text-sm">{manufacturer}</p>
            </div>
            <div className="text-right">
                <p className="font-semibold">₹{price}</p>
                {savingsPercent != null && savingsPercent > 0 && (
                    <p className="text-sm text-green-600">Save {savingsPercent}%</p>
                )}
            </div>
        </div>
    );
}
