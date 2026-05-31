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
      className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
