import { AlertTriangle, Check, RefreshCw } from "lucide-react";
import type { LasaMatch } from "../../lib/api";

interface LasaConfirmationProps {
    scannedName: string;
    matches: LasaMatch[];
    onConfirmScanned: () => void;
    onSelectConflict: (conflictName: string) => void;
}

export default function LasaConfirmation({
    scannedName,
    matches,
    onConfirmScanned,
    onSelectConflict,
}: LasaConfirmationProps) {
    const topMatch = matches[0]; // Primary conflict

    return (
        <div className="w-full max-w-sm rounded-3xl border border-orange-500/30 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-center">
                <div className="rounded-full bg-orange-500/20 p-4">
                    <AlertTriangle size={32} className="text-orange-500" />
                </div>
            </div>

            <h2 className="mb-2 text-center text-xl font-bold text-white">LASA Alert</h2>
            <p className="mb-6 text-center text-sm font-medium text-slate-300">
                The medicine you scanned sounds or looks very similar to another medicine. Please
                confirm which one you have.
            </p>

            <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-800 p-4">
                <div className="mb-4 text-center">
                    <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                        You Scanned
                    </span>
                    <div className="mt-1 text-2xl font-black text-white">{scannedName}</div>
                </div>

                <div className="relative flex items-center justify-center py-2">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-700"></div>
                    </div>
                    <div className="relative bg-slate-800 px-3 text-xs font-bold tracking-wider text-orange-400 uppercase">
                        Conflicts With
                    </div>
                </div>

                <div className="mt-4 text-center">
                    <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                        {topMatch.type === "sound-alike" ? "Sound-Alike" : "Look-Alike"}
                    </span>
                    <div className="mt-1 text-2xl font-black text-orange-400">{topMatch.name}</div>
                </div>
            </div>

            <div className="flex flex-col gap-3">
                <button
                    onClick={onConfirmScanned}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3.5 text-sm font-bold text-white shadow-lg transition-colors hover:bg-emerald-400"
                >
                    <Check size={18} />
                    Yes, I have {scannedName}
                </button>
                <button
                    onClick={() => onSelectConflict(topMatch.name)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-3.5 text-sm font-bold text-white shadow-lg transition-colors hover:bg-slate-700"
                >
                    <RefreshCw size={18} />I meant {topMatch.name}
                </button>
            </div>

            {matches.length > 1 && (
                <p className="mt-4 text-center text-xs text-slate-500">
                    + {matches.length - 1} other similar names detected
                </p>
            )}
        </div>
    );
}
