import { create } from "zustand";

interface AudioState {
    currentAudio: HTMLAudioElement | null;
    currentTrackId: string | null;
    currentBlobUrl: string | null;
    /** Make `audio` the single active track, pausing + revoking whatever was playing before. */
    play: (audio: HTMLAudioElement, trackId: string, blobUrl?: string | null) => void;
    /** Unconditionally pause + revoke + clear the active track. */
    stop: () => void;
    /**
     * Same teardown as stop(), but only acts if `trackId` is still the active
     * track. Used by lifecycle callbacks (onended/onerror/unmount) so a stale
     * callback from an already-superseded track can't clobber whatever is
     * actually playing now.
     */
    stopIfCurrent: (trackId: string) => void;
}

export const useAudioStore = create<AudioState>((set, get) => ({
    currentAudio: null,
    currentTrackId: null,
    currentBlobUrl: null,

    play: (audio, trackId, blobUrl = null) => {
        const { currentAudio, currentBlobUrl } = get();

        if (currentAudio && currentAudio !== audio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }

        if (currentBlobUrl && currentBlobUrl !== blobUrl) {
            URL.revokeObjectURL(currentBlobUrl);
        }

        set({ currentAudio: audio, currentTrackId: trackId, currentBlobUrl: blobUrl ?? null });
    },

    stop: () => {
        const { currentAudio, currentBlobUrl } = get();

        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }
        if (currentBlobUrl) {
            URL.revokeObjectURL(currentBlobUrl);
        }

        set({ currentAudio: null, currentTrackId: null, currentBlobUrl: null });
    },

    stopIfCurrent: (trackId) => {
        if (get().currentTrackId === trackId) {
            get().stop();
        }
    },
}));
