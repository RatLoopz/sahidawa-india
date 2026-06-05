import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import axe from "axe-core";
import { JSDOM } from "jsdom";

const auditUrl = new URL(process.env.VOICE_A11Y_URL ?? "http://127.0.0.1:3000/en/voice");
const healthTimeoutMs = 60_000;
const repoRoot = new URL("../../..", import.meta.url);

async function isReachable(url) {
    try {
        const response = await fetch(url, { redirect: "follow" });
        return response.ok;
    } catch {
        return false;
    }
}

async function waitForUrl(url) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < healthTimeoutMs) {
        if (await isReachable(url)) {
            return;
        }

        await delay(1_000);
    }

    throw new Error(`Timed out waiting for ${url.toString()}`);
}

function startDevServer() {
    const server = spawn(
        "npm",
        ["run", "dev", "-w", "web", "--", "--hostname", auditUrl.hostname, "--port", auditUrl.port],
        {
            cwd: repoRoot,
            stdio: "inherit",
        }
    );

    return server;
}

function getTabbableElements(document) {
    const tabbableSelector = [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    return Array.from(document.querySelectorAll(tabbableSelector)).filter((element) => {
        if (!(element instanceof document.defaultView.HTMLElement)) {
            return false;
        }

        if (element.closest("[aria-hidden='true']")) {
            return false;
        }

        return true;
    });
}

async function runAxeAudit(url) {
    const response = await fetch(url, { redirect: "follow" });

    if (!response.ok) {
        throw new Error(
            `Failed to load ${url.toString()}: ${response.status} ${response.statusText}`
        );
    }

    const html = await response.text();
    const dom = new JSDOM(html, {
        runScripts: "outside-only",
        url: url.toString(),
    });

    dom.window.eval(axe.source);

    const skipLink = dom.window.document.querySelector('a[href="#main-content"]');
    const mainTarget = dom.window.document.querySelector("main#main-content");

    if (!skipLink) {
        throw new Error("Missing skip link to #main-content");
    }

    if (!mainTarget) {
        throw new Error("Missing main#main-content landmark target");
    }

    const tabbableElements = getTabbableElements(dom.window.document);

    if (tabbableElements[0] !== skipLink) {
        const firstTabbableDescription = tabbableElements[0]?.outerHTML ?? "none";

        throw new Error(
            `Skip link is not the first tabbable element in the page shell. First tabbable: ${firstTabbableDescription}`
        );
    }

    const auditRoot = dom.window.document.createElement("div");
    auditRoot.append(skipLink.cloneNode(true), mainTarget.cloneNode(true));
    dom.window.document.body.innerHTML = "";
    dom.window.document.body.append(auditRoot);

    const axeResults = await dom.window.axe.run(auditRoot, {
        rules: {
            "color-contrast": { enabled: false },
        },
    });

    if (axeResults.violations.length > 0) {
        const summary = axeResults.violations
            .map((violation) => `${violation.id}: ${violation.help}`)
            .join("\n");

        throw new Error(`axe reported accessibility violations:\n${summary}`);
    }
}

let startedServer = null;

try {
    if (!(await isReachable(auditUrl))) {
        startedServer = startDevServer();
        await waitForUrl(auditUrl);
    }

    await runAxeAudit(auditUrl);
    console.log(`Voice accessibility audit passed for ${auditUrl.toString()}`);
} finally {
    if (startedServer) {
        startedServer.kill("SIGTERM");
    }
}
