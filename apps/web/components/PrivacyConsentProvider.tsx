"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type ConsentValue = "granted" | "denied" | null;

interface PrivacyConsentContextValue {
    locationConsent: ConsentValue;
    scanHistoryConsent: ConsentValue;
    hasRespondedToConsent: boolean;
    acceptAll: () => void;
    denyAll: () => void;
}

const PrivacyConsentContext = createContext<PrivacyConsentContextValue | undefined>(undefined);

export function PrivacyConsentProvider({ children }: { children: React.ReactNode }) {
    const [locationConsent, setLocationConsent] = useState<ConsentValue>(null);
    const [scanHistoryConsent, setScanHistoryConsent] = useState<ConsentValue>(null);
    const [hasHydrated, setHasHydrated] = useState(false);

    useEffect(() => {
        // Read once on mount — localStorage isn't available during SSR.
        setLocationConsent(localStorage.getItem("consent_location") as ConsentValue);
        setScanHistoryConsent(localStorage.getItem("consent_scan_history") as ConsentValue);
        setHasHydrated(true);
    }, []);

    const acceptAll = () => {
        localStorage.setItem("consent_location", "granted");
        localStorage.setItem("consent_scan_history", "granted");
        setLocationConsent("granted");
        setScanHistoryConsent("granted");
    };

    const denyAll = () => {
        localStorage.setItem("consent_location", "denied");
        localStorage.setItem("consent_scan_history", "denied");
        setLocationConsent("denied");
        setScanHistoryConsent("denied");
    };

    // Only meaningful after hydration — avoids a flash of the banner
    // before we've had a chance to read existing localStorage values.
    const hasRespondedToConsent =
        hasHydrated && locationConsent !== null && scanHistoryConsent !== null;

    return (
        <PrivacyConsentContext.Provider
            value={{
                locationConsent,
                scanHistoryConsent,
                hasRespondedToConsent,
                acceptAll,
                denyAll,
            }}
        >
            {children}
        </PrivacyConsentContext.Provider>
    );
}

export function usePrivacyConsent() {
    const ctx = useContext(PrivacyConsentContext);
    if (!ctx) {
        throw new Error("usePrivacyConsent must be used within a PrivacyConsentProvider");
    }
    return ctx;
}
