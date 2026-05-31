"use client";

import {
  ImgHTMLAttributes,
  SyntheticEvent,
  useEffect,
  useRef,
  useState,
} from "react";

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
  rootMargin = "160px",
  threshold = 0.1,
  onLoad,
  ...imgProps
}: LazyImageProps) {
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
    setIsInView(false);

    const node = wrapperRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [rootMargin, src, threshold]);

  const handleLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    setIsLoaded(true);
    onLoad?.(event);
  };

  return (
    <span
      ref={wrapperRef}
      className={`relative block overflow-hidden bg-slate-100 ${wrapperClassName}`}
    >
      {!isLoaded && (
        <span
          aria-hidden="true"
          className={`absolute inset-0 bg-slate-200/80 ${placeholderClassName}`}
        />
      )}
      {isInView && (
        <img
          {...imgProps}
          src={src}
          alt={alt}
          onLoad={handleLoad}
          className={`transition-[filter,opacity] duration-300 ease-out ${
            isLoaded ? "blur-0" : "blur-[10px]"
          } ${className}`}
        />
      )}
    </span>
  );
}
