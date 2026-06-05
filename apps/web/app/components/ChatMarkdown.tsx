"use client";

import type { AnchorHTMLAttributes, ComponentPropsWithoutRef } from "react";
import Markdown, { type MarkdownToJSX } from "markdown-to-jsx";
import { normalizeChatMarkdown } from "@/lib/chatFormatting";

type ChatMarkdownProps = {
    content: string;
    tone?: "assistant" | "user";
};

const MarkdownLink = ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
        {...props}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="font-medium underline decoration-emerald-500/60 underline-offset-2 hover:decoration-emerald-600"
    >
        {children}
    </a>
);

const MarkdownBlockquote = ({ children }: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote className="border-l-2 border-emerald-500/50 pl-3 text-slate-600 dark:text-slate-300">
        {children}
    </blockquote>
);

const MarkdownPre = ({ children }: ComponentPropsWithoutRef<"pre">) => (
    <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs leading-relaxed text-slate-50">
        {children}
    </pre>
);

const MarkdownTable = ({ children }: ComponentPropsWithoutRef<"table">) => (
    <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-xs">{children}</table>
    </div>
);

const markdownOptions: MarkdownToJSX.Options = {
    disableParsingRawHTML: true,
    overrides: {
        h1: {
            component: "h3",
            props: { className: "text-base leading-snug font-semibold" },
        },
        h2: {
            component: "h3",
            props: { className: "text-base leading-snug font-semibold" },
        },
        h3: {
            component: "h3",
            props: { className: "text-sm leading-snug font-semibold" },
        },
        h4: {
            component: "h4",
            props: { className: "text-sm leading-snug font-semibold" },
        },
        p: {
            component: "p",
            props: { className: "my-0" },
        },
        ul: {
            component: "ul",
            props: { className: "list-disc space-y-1.5 pl-5" },
        },
        ol: {
            component: "ol",
            props: { className: "list-decimal space-y-1.5 pl-5" },
        },
        li: {
            component: "li",
            props: { className: "pl-1" },
        },
        strong: {
            component: "strong",
            props: { className: "font-semibold" },
        },
        em: {
            component: "em",
            props: { className: "italic" },
        },
        blockquote: MarkdownBlockquote,
        a: MarkdownLink,
        code: {
            component: "code",
            props: {
                className: "rounded bg-slate-900/10 px-1 py-0.5 text-[0.92em] dark:bg-white/10",
            },
        },
        pre: MarkdownPre,
        table: MarkdownTable,
        th: {
            component: "th",
            props: {
                className:
                    "border border-slate-300 px-2 py-1 text-left font-semibold dark:border-slate-600",
            },
        },
        td: {
            component: "td",
            props: {
                className: "border border-slate-300 px-2 py-1 align-top dark:border-slate-600",
            },
        },
        hr: {
            component: "hr",
            props: { className: "border-slate-300 dark:border-slate-600" },
        },
        input: {
            component: "input",
            props: { disabled: true, className: "mr-1 align-middle" },
        },
        img: () => null,
    },
};

export function ChatMarkdown({ content, tone = "assistant" }: ChatMarkdownProps) {
    const toneClasses =
        tone === "user"
            ? "[&_a]:text-white [&_code]:bg-white/20"
            : "[&_a]:text-emerald-700 dark:[&_a]:text-emerald-300";

    return (
        <div className={`space-y-2 text-sm leading-relaxed ${toneClasses}`}>
            <Markdown options={markdownOptions}>{normalizeChatMarkdown(content)}</Markdown>
        </div>
    );
}
