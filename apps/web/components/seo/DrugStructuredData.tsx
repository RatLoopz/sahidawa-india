import React from "react";

interface DrugStructuredDataProps {
    brandName: string;
    genericName?: string;
    manufacturer?: string;
    mrp?: number;
    janAushadhiPrice?: number;
    url: string;
    description: string;
}

export default function DrugStructuredData({
    brandName,
    genericName,
    manufacturer,
    mrp,
    janAushadhiPrice,
    url,
    description,
}: DrugStructuredDataProps) {
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "MedicalWebPage",
        "@id": `${url}#webpage`,
        url: url,
        name: `${brandName} Cheaper Generic Alternatives, Cost & Side Effects`,
        description: description,
        mainEntity: {
            "@type": "Drug",
            "@id": `${url}#drug`,
            name: brandName,
            nonProprietaryName: genericName || undefined,
            manufacturer: manufacturer
                ? {
                      "@type": "Organization",
                      name: manufacturer,
                  }
                : undefined,
            description: `${brandName} is a brand-name medicine composed of ${
                genericName || "its active ingredients"
            }.`,
            offers:
                mrp || janAushadhiPrice
                    ? {
                          "@type": "AggregateOffer",
                          priceCurrency: "INR",
                          lowPrice: janAushadhiPrice ? janAushadhiPrice.toFixed(2) : undefined,
                          highPrice: mrp ? mrp.toFixed(2) : undefined,
                          offerCount: mrp && janAushadhiPrice ? "2" : "1",
                      }
                    : undefined,
        },
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
    );
}
