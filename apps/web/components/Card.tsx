import { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLElement> & {
    as?: "article" | "div" | "section";
};

export default function Card({
    as: Component = "article",
    className = "",
    children,
    ...props
}: CardProps) {
    return (
        <Component
            className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
            {...props}
        >
            {children}
        </Component>
    );
}
