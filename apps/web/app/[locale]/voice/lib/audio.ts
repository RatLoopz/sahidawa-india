export type StoredVoiceAnimationPreference = "enabled" | "disabled" | null;

type MediaQueryChangeListener = (event: MediaQueryListEvent) => void;

type MediaQueryListLike = Pick<MediaQueryList, "matches"> &
    Partial<
        Pick<
            MediaQueryList,
            "addEventListener" | "removeEventListener" | "addListener" | "removeListener"
        >
    >;

export type MediaQueryChangeSubscription = {
    query: MediaQueryListLike;
    listener: MediaQueryChangeListener;
    mode: "event-target" | "legacy";
};

export function resolveVoiceAnimationPreference({
    storedPreference,
    prefersReducedMotion,
}: {
    storedPreference: StoredVoiceAnimationPreference;
    prefersReducedMotion: boolean;
}) {
    if (storedPreference === "enabled") {
        return true;
    }

    if (storedPreference === "disabled") {
        return false;
    }

    return !prefersReducedMotion;
}

export function stopMediaStream(stream: Pick<MediaStream, "getTracks"> | null | undefined) {
    stream?.getTracks().forEach((track) => {
        track.stop();
    });
}

export function subscribeToMediaQueryChange(
    query: MediaQueryListLike,
    listener: MediaQueryChangeListener
): MediaQueryChangeSubscription {
    if (typeof query.addEventListener === "function") {
        query.addEventListener("change", listener);
        return { query, listener, mode: "event-target" };
    }

    query.addListener?.(listener);
    return { query, listener, mode: "legacy" };
}

export function stopMediaQueryChangeListener(subscription: MediaQueryChangeSubscription) {
    if (subscription.mode === "event-target") {
        subscription.query.removeEventListener?.("change", subscription.listener);
        return;
    }

    subscription.query.removeListener?.(subscription.listener);
}
