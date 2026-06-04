"use client";

import Image from "next/image";
import { ImgHTMLAttributes, SyntheticEvent, useState } from "react";

type LazyImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
    src: string;
    wrapperClassName?: string;
    placeholderClassName?: string;
    rootMargin?: string;
    threshold?: number;
};

export default function LazyImage({
    src,
    alt,
    className = "",
    wrapperClassName = "",
    placeholderClassName = "",
    rootMargin, // Next.js Image does not use these, kept for compatibility
    threshold,
    onLoad,
    ...imgProps
}: LazyImageProps) {
    const [isLoaded, setIsLoaded] = useState(false);

    const handleLoad = (event: SyntheticEvent<HTMLImageElement>) => {
        setIsLoaded(true);
        onLoad?.(event);
    };

    return (
        <span className={`relative block overflow-hidden bg-slate-100 ${wrapperClassName}`}>
            {!isLoaded && (
                <span
                    aria-hidden="true"
                    className={`absolute inset-0 bg-slate-200/80 ${placeholderClassName}`}
                />
            )}
            <Image
                {...(imgProps as any)}
                src={src}
                alt={alt || ""}
                fill
                onLoad={handleLoad as any}
                className={`object-cover transition-[filter,opacity] duration-300 ease-out ${
                    isLoaded ? "blur-0" : "blur-[10px]"
                } ${className}`}
            />
        </span>
    );
}
