import { NextRequest, NextResponse } from "next/server";

// Minimal seed mapping — extend later with a real DB table
const BRAND_TO_SALT: Record<string, string> = {
    augmentin: "amoxicillin + clavulanic acid",
    crocin: "paracetamol",
    calpol: "paracetamol",
    azithral: "azithromycin",
};

type AlternativeEntry = {
    name: string;
    manufacturer: string;
    price: number;
};

const ALTERNATIVES: Record<string, AlternativeEntry[]> = {
    "amoxicillin + clavulanic acid": [
        { name: "Clavam 625", manufacturer: "Alkem Labs", price: 95 },
        { name: "Moxikind-CV 625", manufacturer: "Mankind Pharma", price: 88 },
    ],
    paracetamol: [
        { name: "Dolo 650", manufacturer: "Micro Labs", price: 30 },
        { name: "Paracip 650", manufacturer: "Cipla", price: 22 },
    ],
    azithromycin: [
        { name: "Azee 500", manufacturer: "Cipla", price: 78 },
        { name: "Zithrocin 500", manufacturer: "FDC Ltd", price: 70 },
    ],
};

const BRAND_PRICE: Record<string, number> = {
    augmentin: 210,
    crocin: 40,
    calpol: 42,
    azithral: 130,
};

export async function GET(req: NextRequest) {
    const query = req.nextUrl.searchParams.get("query")?.trim().toLowerCase();

    if (!query) {
        return NextResponse.json({ error: "query parameter is required" }, { status: 400 });
    }

    const salt = BRAND_TO_SALT[query];
    if (!salt) {
        return NextResponse.json({ brand: query, salt: null, alternatives: [] });
    }

    const originalPrice = BRAND_PRICE[query] ?? null;
    const alternatives = (ALTERNATIVES[salt] ?? []).map((alt) => ({
        ...alt,
        savingsPercent:
            originalPrice != null
                ? Math.round(((originalPrice - alt.price) / originalPrice) * 100)
                : null,
    }));

    return NextResponse.json({
        brand: query,
        salt,
        originalPrice,
        alternatives,
    });
}
