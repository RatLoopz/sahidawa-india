import React, { ReactNode } from "react";
import { SearchX, Inbox, XCircle, AlertCircle, MapPinOff } from "lucide-react";

export interface EmptyStateProps {
    icon?: "search" | "inbox" | "error" | "map" | "none" | ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
    wrapperClassName?: string;
}

export function EmptyState({
    icon = "inbox",
    title,
    description,
    action,
    className = "",
    wrapperClassName = "",
}: EmptyStateProps) {
    const renderIcon = () => {
        if (React.isValidElement(icon)) return icon;

        switch (icon) {
            case "search":
                return <SearchX size={32} className="text-slate-400" />;
            case "inbox":
                return <Inbox size={32} className="text-slate-400" />;
            case "error":
                return <XCircle size={32} className="text-red-400" />;
            case "map":
                return <MapPinOff size={32} className="text-slate-400" />;
            case "none":
                return null;
            default:
                return <AlertCircle size={32} className="text-slate-400" />;
        }
    };

    const getIconWrapperColor = () => {
        if (icon === "error") return "bg-red-50 text-red-600 ring-red-100";
        return "bg-slate-50 text-slate-500 ring-slate-100";
    };

    return (
        <div
            className={`flex flex-col items-center justify-center px-4 py-10 text-center ${wrapperClassName}`}
        >
            {icon !== "none" && (
                <div
                    className={`mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm ring-1 ${getIconWrapperColor()} ${className}`}
                >
                    {renderIcon()}
                </div>
            )}
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            {description && (
                <p className="mt-1.5 max-w-sm text-sm font-medium text-slate-500">{description}</p>
            )}
            {action && <div className="mt-6">{action}</div>}
        </div>
    );
}
