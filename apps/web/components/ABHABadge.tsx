interface ABHABadgeProps {
    linked: boolean;
}

export default function ABHABadge({ linked }: ABHABadgeProps) {
    return (
        <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                linked ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
            }`}
        >
            {linked ? "ABHA Linked" : "ABHA Not Linked"}
        </span>
    );
}
