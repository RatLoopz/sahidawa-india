export function parseLocalDate(dateStr: string) {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
}

export function isValidDateString(dateStr: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    const [year, month, day] = dateStr.split("-").map(Number);
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function formatMonthYearInputValue(year: string, month: string): string | null {
    const yearNumber = year.length === 2 ? 2000 + Number(year) : Number(year);
    const monthNumber = Number(month);
    if (yearNumber < 1000 || yearNumber > 9999) return null;
    if (monthNumber < 1 || monthNumber > 12) return null;

    const lastDayOfMonth = new Date(yearNumber, monthNumber, 0).getDate();
    return `${yearNumber}-${String(monthNumber).padStart(2, "0")}-${String(lastDayOfMonth).padStart(2, "0")}`;
}

export function formatDateInputValue(rawDate: string | null): string | null {
    if (!rawDate) return null;

    const trimmedDate = rawDate.trim();
    const isoDateMatch = trimmedDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDateMatch) {
        const [, year, month, day] = isoDateMatch;
        const date = parseLocalDate(`${year}-${month}-${day}`);
        if (
            date.getFullYear() === Number(year) &&
            date.getMonth() === Number(month) - 1 &&
            date.getDate() === Number(day)
        ) {
            return `${year}-${month}-${day}`;
        }
        return null;
    }

    const slashMonthYearMatch = trimmedDate.match(/^(\d{1,2})\/(\d{2}|\d{4})$/);
    if (slashMonthYearMatch)
        return formatMonthYearInputValue(slashMonthYearMatch[2], slashMonthYearMatch[1]);

    const hyphenYearMonthMatch = trimmedDate.match(/^(\d{4})-(\d{1,2})$/);
    if (hyphenYearMonthMatch)
        return formatMonthYearInputValue(hyphenYearMonthMatch[1], hyphenYearMonthMatch[2]);

    const parsedDate = new Date(trimmedDate);
    if (Number.isNaN(parsedDate.getTime())) return null;
    return parsedDate.toISOString().split("T")[0];
}
