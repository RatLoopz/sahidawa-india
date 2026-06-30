type ChatbotPositionOptions = {
    pathname: string | null;
    isOpen: boolean;
};

type ChatbotPanelOptions = {
    pathname: string | null;
};

const POSITION_BASE_CLASSES = "fixed z-10 font-sans transition-all duration-300 ease-out";
const DEFAULT_CHATBOT_POSITION_CLASSES = `${POSITION_BASE_CLASSES} bottom-[4.5rem] right-4 md:bottom-6 md:right-6`;
const MAP_CHATBOT_DESKTOP_LEFT = "md:left-[calc(clamp(22rem,26vw,30rem)+2.75rem)]";
const MAP_CHATBOT_CLOSED_POSITION_CLASSES = `${POSITION_BASE_CLASSES} bottom-[4.5rem] left-4 md:bottom-6 ${MAP_CHATBOT_DESKTOP_LEFT}`;
const MAP_CHATBOT_OPEN_POSITION_CLASSES = `${POSITION_BASE_CLASSES} bottom-24 left-4 md:bottom-6 ${MAP_CHATBOT_DESKTOP_LEFT}`;

const PANEL_BASE_CLASSES =
    "absolute bottom-16 bg-(--color-surface-page) rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-(--color-border-muted) text-(--color-text-primary) transition-all duration-300";
const DEFAULT_CHATBOT_PANEL_CLASSES = `${PANEL_BASE_CLASSES} right-0 w-[min(22rem,calc(100vw-1.5rem))] h-[min(28rem,calc(100dvh-8rem))] md:w-[350px] md:h-[450px]`;
const MAP_CHATBOT_PANEL_CLASSES = `${PANEL_BASE_CLASSES} left-0 w-[350px] max-w-[calc(100vw-2rem)] h-[min(28rem,calc(100dvh-8rem))] md:h-[450px]`;

function getPathSegments(pathname: string | null): string[] {
    if (!pathname) {
        return [];
    }

    return pathname.split("/").filter(Boolean);
}

export function isLocalizedMapRoute(pathname: string | null): boolean {
    const pathSegments = getPathSegments(pathname);

    return pathSegments.length >= 2 && pathSegments[1] === "map";
}

export function getChatbotPositionClasses({ pathname, isOpen }: ChatbotPositionOptions): string {
    if (!isLocalizedMapRoute(pathname)) {
        return DEFAULT_CHATBOT_POSITION_CLASSES;
    }

    return isOpen ? MAP_CHATBOT_OPEN_POSITION_CLASSES : MAP_CHATBOT_CLOSED_POSITION_CLASSES;
}

export function getChatbotPanelClasses({ pathname }: ChatbotPanelOptions): string {
    if (!isLocalizedMapRoute(pathname)) {
        return DEFAULT_CHATBOT_PANEL_CLASSES;
    }

    return MAP_CHATBOT_PANEL_CLASSES;
}
