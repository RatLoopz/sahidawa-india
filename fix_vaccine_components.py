import os
import re

CSS_MAP = {
    r'bg-slate-50 dark:bg-slate-900': 'bg-(--color-surface-muted)',
    r'bg-slate-100 dark:bg-slate-800': 'bg-(--color-surface-muted)',
    r'bg-slate-200 dark:bg-slate-700': 'bg-(--color-border-muted)',
    r'text-slate-900 dark:text-white': 'text-(--color-text-primary)',
    r'text-slate-800 dark:text-slate-100': 'text-(--color-text-primary)',
    r'text-slate-900': 'text-(--color-text-primary)',
    r'text-slate-800': 'text-(--color-text-primary)',
    r'text-slate-600 dark:text-slate-300': 'text-(--color-text-secondary)',
    r'text-slate-600 dark:text-slate-400': 'text-(--color-text-secondary)',
    r'text-slate-500 dark:text-slate-400': 'text-(--color-text-muted)',
    r'border-slate-200 dark:border-slate-700': 'border-(--color-border-muted)',
    r'bg-white dark:bg-slate-800': 'bg-(--color-surface-page)',
    r'bg-slate-50': 'bg-(--color-surface-muted)',
    r'text-slate-600': 'text-(--color-text-secondary)',
    r'text-slate-500': 'text-(--color-text-muted)',
}

def replace_classes(content):
    for old, new in CSS_MAP.items():
        content = re.sub(old, new, content)
    return content

files_to_fix = [
    "apps/web/app/[locale]/vaccine-hub/page.tsx",
    "apps/web/components/vaccine/AftercareGuidance.tsx",
    "apps/web/components/vaccine/DateInitializer.tsx",
    "apps/web/components/vaccine/DoseSchedule.tsx",
    "apps/web/components/vaccine/SafetyInfo.tsx",
    "apps/web/components/vaccine/VaccineDetails.tsx",
    "apps/web/components/vaccine/VaccineSelector.tsx"
]

for file_path in files_to_fix:
    with open(file_path, "r") as f:
        content = f.read()
    
    # Run generic CSS replaces
    content = replace_classes(content)

    # Hardcoded fixes for page.tsx
    if "page.tsx" in file_path:
        content = content.replace('import { BookOpen } from "lucide-react";', 'import { BookOpen, Syringe, Calendar, AlertTriangle, HeartPulse } from "lucide-react";')
        content = content.replace('💉 Vaccine Hub & Immunization Tracker', '<Syringe className="h-8 w-8 shrink-0 text-emerald-600 inline mr-2" /> Vaccine Hub & Immunization Tracker')
        content = content.replace('<p className="mb-2 text-2xl">📅</p>', '<div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50"><Calendar className="h-6 w-6 text-emerald-700" /></div>')
        content = content.replace('<p className="mb-2 text-2xl">⚠️</p>', '<div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-50"><AlertTriangle className="h-6 w-6 text-amber-600" /></div>')
        content = content.replace('<p className="mb-2 text-2xl">🩹</p>', '<div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-sky-50"><HeartPulse className="h-6 w-6 text-sky-600" /></div>')

    # Hardcoded fixes for DoseSchedule.tsx
    if "DoseSchedule.tsx" in file_path:
        content = content.replace('import { Target, Info } from "lucide-react";', 'import { Target, Info, Calendar, AlertTriangle } from "lucide-react";')
        content = content.replace('<span>📅</span> Immunization Schedule', '<Calendar className="h-5 w-5 text-emerald-600 inline mr-2" /> Immunization Schedule')
        content = content.replace('className={`text-sm mt-1 ${', 'className={`mt-1 flex w-fit items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${')
        content = content.replace('⚠️ Select a date', '<AlertTriangle className="h-3.5 w-3.5 shrink-0 inline mr-1" /> Select a date')
        content = content.replace('🎯 Target Date:', '<Target className="h-3.5 w-3.5 shrink-0 inline mr-1" /> Target Date:')
    
    # Hardcoded fixes for SafetyInfo.tsx
    if "SafetyInfo.tsx" in file_path:
        content = content.replace('import { AlertCircle } from "lucide-react";', 'import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";')
        content = content.replace('<span>🟢</span> Common Post-Effects', '<CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 inline mr-2" /> Common Post-Effects')
        content = content.replace('<span>🛑</span> Severe Reactions', '<XCircle className="h-4 w-4 shrink-0 text-rose-600 inline mr-2" /> Severe Reactions')
    
    # Hardcoded fixes for AftercareGuidance.tsx
    if "AftercareGuidance.tsx" in file_path:
        content = content.replace('import { Info } from "lucide-react";', 'import { Info, HeartPulse } from "lucide-react";')
        content = content.replace('<span>🩹</span> Immediate Aftercare Guidance', '<HeartPulse className="h-4 w-4 shrink-0 text-sky-600 inline mr-2" /> Immediate Aftercare Guidance')
        content = content.replace('<span>🩹</span>', '<HeartPulse className="h-4 w-4 shrink-0 text-sky-500 inline mr-2" />')
        
    # Hardcoded fixes for VaccineDetails.tsx
    if "VaccineDetails.tsx" in file_path:
        content = content.replace('<span>🦠</span> Pathogen:', '<span className="font-medium mr-2">Pathogen:</span>')
        content = content.replace('<span>💉</span> Type:', '<span className="font-medium mr-2">Type:</span>')
        content = content.replace('<span>🎯</span> Efficacy:', '<span className="font-medium mr-2">Efficacy:</span>')
        content = content.replace('<span>👨‍👩‍👧‍👦</span> Audience:', '<span className="font-medium mr-2">Audience:</span>')
        content = content.replace('<span>🏥</span> Administration:', '<span className="font-medium mr-2">Administration:</span>')

    with open(file_path, "w") as f:
        f.write(content)

