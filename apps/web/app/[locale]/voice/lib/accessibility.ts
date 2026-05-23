import type { VoiceStep } from "../types";

export function shouldAutoFocusVoicePanel(step: VoiceStep) {
    return step !== "initial" && step !== "listening";
}
