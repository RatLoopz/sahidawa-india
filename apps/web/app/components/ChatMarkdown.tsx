"use client";

import {
    createContext,
    useContext,
    type AnchorHTMLAttributes,
    type ComponentPropsWithoutRef,
} from "react";
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

/**
 * Nested <ul>/<ol> compound their left padding with every ancestor list —
 * each level adds its own indent on top of the parent's. In a narrow chat
 * bubble (max-w-[78%]/[85%] of the message column), that compounding used to
 * eat most of the available width by depth 3-4, squeezing wrapped text into
 * a thin strip near the bubble's right edge (the "bleeds to the edge"
 * symptom). ListDepthContext lets nested <ul>/<ol> know how deep they are so
 * indentation can be capped past a maximum depth, rather than growing
 * without bound for every additional level the model happens to produce.
 */
const ListDepthContext = createContext(0);

const MAX_INDENTED_DEPTH = 3;
const LIST_INDENT_CLASSES = ["pl-4", "pl-3", "pl-3", "pl-2"];

const getListIndentClass = (depth: number) =>
    LIST_INDENT_CLASSES[Math.min(depth, MAX_INDENTED_DEPTH)];

const MarkdownList = (tag: "ul" | "ol") =>
    function List({ children, ...props }: ComponentPropsWithoutRef<"ul" | "ol">) {
        const depth = useContext(ListDepthContext);
        const Tag = tag;
        const listClass = tag === "ul" ? "list-disc" : "list-decimal";

        return (
            <ListDepthContext.Provider value={depth + 1}>
                <Tag {...props} className={`${listClass} space-y-1.5 ${getListIndentClass(depth)}`}>
                    {children}
                </Tag>
            </ListDepthContext.Provider>
        );
    };

const MarkdownUl = MarkdownList("ul");
const MarkdownOl = MarkdownList("ol");

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
        ul: MarkdownUl,
        ol: MarkdownOl,
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
