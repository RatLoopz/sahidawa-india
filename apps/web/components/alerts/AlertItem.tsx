import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Globe,
    ShieldAlert,
    AlertTriangle,
    ChevronDown,
    Building2,
    MapPin,
    BellOff,
} from "lucide-react";
import { CopyButton } from "@/components/ui/CopyButton";
import { Alert } from "@/app/[locale]/alerts/page";

interface AlertItemProps {
    alert: Alert;
    expandedAlertId: string | null;
    toggleExpand: (id: string) => void;
    snoozeAlert: (id: string) => void;
    t: any; // translation function
}

function formatRelativeTime(dateString: string | null): string {
    if (!dateString) return "Recent";
    const now = new Date();
    const past = new Date(dateString);
    const msPerMinute = 60 * 1000;
    const msPerHour = msPerMinute * 60;
    const msPerDay = msPerHour * 24;
    const elapsed = now.getTime() - past.getTime();

    if (elapsed < msPerMinute) return "Just now";
    if (elapsed < msPerHour) return `${Math.round(elapsed / msPerMinute)}m ago`;
    if (elapsed < msPerDay) return `${Math.round(elapsed / msPerHour)}h ago`;
    return past.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function AlertItem({
    alert,
    expandedAlertId,
    toggleExpand,
    snoozeAlert,
    t,
}: AlertItemProps) {
    const isSystem =
        alert.reported_brand_name === "SYSTEM_UPDATE" ||
        alert.brand_name === "SYSTEM_UPDATE" ||
        alert.brand === "SYSTEM_UPDATE";
    const isCritical =
        alert.cdsco_approval_status === "banned" ||
        alert.is_counterfeit_alert ||
        alert.alert_type === "Banned";
    const isCollapsible = !isSystem;
    const isExpanded = expandedAlertId === alert.id;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            onClick={isCollapsible ? () => toggleExpand(alert.id) : undefined}
            tabIndex={isCollapsible ? 0 : undefined}
            role={isCollapsible ? "button" : undefined}
            aria-expanded={isCollapsible ? isExpanded : undefined}
            onKeyDown={
                isCollapsible
                    ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleExpand(alert.id);
                          }
                      }
                    : undefined
            }
            className={`group relative flex flex-col overflow-hidden rounded-3xl border bg-(--color-surface-page) p-6 shadow-xs transition-all focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden ${
                isCollapsible ? "cursor-pointer" : ""
            } ${
                isExpanded
                    ? "border-emerald-500/30 ring-2 ring-emerald-500/5"
                    : "border-(--color-border-muted)"
            }`}
        >
            <div
                className={`absolute top-0 bottom-0 left-0 w-1.5 ${isSystem ? "bg-blue-500" : isCritical ? "bg-red-500" : "bg-amber-500"}`}
            ></div>
            <div className="flex items-start gap-4">
                <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${isSystem ? "bg-blue-500/10 text-blue-500" : isCritical ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-600"}`}
                >
                    {isSystem ? (
                        <Globe size={20} />
                    ) : isCritical ? (
                        <ShieldAlert size={20} />
                    ) : (
                        <AlertTriangle size={20} />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <h4 className="text-base font-bold">
                            {isSystem
                                ? t("systemUpdate")
                                : alert.reported_brand_name || alert.brand_name || alert.brand}
                        </h4>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    snoozeAlert(alert.id);
                                }}
                                className="text-slate-400 transition-colors hover:text-emerald-500"
                                title="Snooze for 7 days"
                                aria-label="Snooze for 7 days"
                            >
                                <BellOff size={16} />
                            </button>
                            <span className="shrink-0 text-[11px] font-bold text-(--color-text-muted)">
                                {formatRelativeTime(alert.reported_at || alert.created_at || null)}
                            </span>
                        </div>
                    </div>
                    <p className="mt-2 text-sm text-(--color-text-secondary)">
                        {alert.alert_type
                            ? t("alertType", {
                                  type: alert.alert_type,
                              })
                            : alert.composition || t("noDetails")}
                    </p>

                    <AnimatePresence initial={false}>
                        {isCollapsible && isExpanded && (
                            <motion.div
                                key="details"
                                id={`alert-details-${alert.id}`}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{
                                    height: "auto",
                                    opacity: 1,
                                }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{
                                    duration: 0.25,
                                    ease: "easeInOut",
                                }}
                                className="overflow-hidden"
                            >
                                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-bold text-(--color-text-muted)">
                                    <div
                                        className="flex items-center gap-1.5"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <span>
                                            {t("batchLabel")}{" "}
                                            <span className="font-extrabold text-(--color-text-primary)">
                                                {alert.batch_number}
                                            </span>
                                        </span>
                                        <CopyButton text={alert.batch_number || ""} />
                                    </div>
                                    {alert.manufacturer && (
                                        <>
                                            <span className="text-(--color-border-muted)">•</span>
                                            <div className="flex items-center gap-1">
                                                <Building2 size={12} className="opacity-80" />
                                                <span>
                                                    {t("manufacturerLabel")}{" "}
                                                    <span className="inline-block max-w-[150px] truncate align-bottom font-extrabold text-(--color-text-primary) sm:max-w-[250px]">
                                                        {alert.manufacturer}
                                                    </span>
                                                </span>
                                            </div>
                                        </>
                                    )}
                                    {(alert.state || alert.district) && (
                                        <>
                                            <span className="text-(--color-border-muted)">•</span>
                                            <div className="flex items-center gap-1">
                                                <MapPin size={12} className="opacity-80" />
                                                <span>
                                                    {t("regionLabel")}{" "}
                                                    <span className="font-extrabold text-(--color-text-primary)">
                                                        {[alert.state, alert.district]
                                                            .filter(Boolean)
                                                            .join(", ")}
                                                    </span>
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {isCollapsible && (
                    <div className="group-hover:text-slate-650 shrink-0 text-slate-400 transition-colors">
                        <ChevronDown
                            size={18}
                            className={`transition-transform duration-300 ${
                                isExpanded ? "rotate-180" : ""
                            }`}
                        />
                    </div>
                )}
            </div>
        </motion.div>
    );
}
