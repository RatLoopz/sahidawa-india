import { GitBranch } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-400 mt-auto">
      <div className="container mx-auto px-4 md:px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">

        <div className="flex items-center gap-4 flex-wrap justify-center">
          <a
            href="https://github.com/RatLoopz/sahidawa-india"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-white transition-colors"
          >
            <GitBranch size={14} />
            GitHub
          </a>

          <a
            href="https://github.com/RatLoopz/sahidawa-india/blob/main/CONTRIBUTING.md"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            Contributing Guide
          </a>

          <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Made for GSSoC 2026
          </span>
        </div>

        <p className="text-center md:text-right">
          © 2026 SahiDawa. Open Source under MIT License.
        </p>
      </div>
    </footer>
  );
}