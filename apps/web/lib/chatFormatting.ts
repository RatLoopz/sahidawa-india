const orderedListMarkerPattern = /(^|\s)(\d{1,2})\.\s+(?=(?:\*\*)?[A-Za-z0-9])/g;

function normalizeInlineOrderedList(line: string): string {
    const markers = Array.from(line.matchAll(orderedListMarkerPattern)).map((match) => ({
        markerStart: (match.index ?? 0) + match[1].length,
        contentStart: (match.index ?? 0) + match[0].length,
        number: match[2],
    }));

    if (markers.length < 2) return line;

    const intro = line.slice(0, markers[0].markerStart).trim();
    const listItems = markers
        .map((marker, index) => {
            const nextMarker = markers[index + 1];
            const text = line
                .slice(marker.contentStart, nextMarker?.markerStart ?? line.length)
                .trim();
            return text ? `${marker.number}. ${text}` : "";
        })
        .filter(Boolean);

    if (listItems.length < 2) return line;

    return intro ? `${intro}\n\n${listItems.join("\n")}` : listItems.join("\n");
}

export function normalizeChatMarkdown(content: string): string {
    const lines = content.replace(/\r\n/g, "\n").trim().split("\n");
    let fenceMarker: string | null = null;

    return lines
        .map((line) => {
            const fenceMatch = line.match(/^\s*(```|~~~)/);
            if (fenceMatch) {
                fenceMarker = fenceMarker === fenceMatch[1] ? null : fenceMatch[1];
                return line;
            }

            if (fenceMarker) return line;

            return normalizeInlineOrderedList(line);
        })
        .join("\n");
}
