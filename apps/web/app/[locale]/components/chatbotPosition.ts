type ChatbotPositionOptions = {
    pathname: string | null;
    isOpen: boolean;
};

type ChatbotPanelOptions = {
    pathname: string | null;
};

const POSITION_BASE_CLASSES = "fixed z-50 font-sans";
const DEFAULT_CHATBOT_POSITION_CLASSES = `${POSITION_BASE_CLASSES} bottom-20 md:bottom-6 right-6`;
const MAP_CHATBOT_DESKTOP_LEFT = "md:left-[calc(clamp(22rem,26vw,30rem)+2.75rem)]";
const MAP_CHATBOT_CLOSED_POSITION_CLASSES = `${POSITION_BASE_CLASSES} bottom-20 md:bottom-6 left-4 ${MAP_CHATBOT_DESKTOP_LEFT}`;
const MAP_CHATBOT_OPEN_POSITION_CLASSES = `${POSITION_BASE_CLASSES} bottom-24 md:bottom-6 left-4 ${MAP_CHATBOT_DESKTOP_LEFT}`;

const PANEL_BASE_CLASSES =
    "absolute bottom-16 w-[350px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 text-gray-800 transition-all duration-300";
const DEFAULT_CHATBOT_PANEL_CLASSES = `${PANEL_BASE_CLASSES} right-0 h-[450px]`;
const MAP_CHATBOT_PANEL_CLASSES = `${PANEL_BASE_CLASSES} left-0 max-w-[calc(100vw-2rem)] h-[min(28rem,calc(100vh-8rem))] md:h-[450px]`;

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
