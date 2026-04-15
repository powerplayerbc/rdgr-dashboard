// ═══════════════════════════════════════
// School Config — Constants
// ═══════════════════════════════════════

const SUPABASE_URL = 'https://yrwrswyjawmgtxrgbnim.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyd3Jzd3lqYXdtZ3R4cmdibmltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYzODY2MzMsImV4cCI6MjA1MTk2MjYzM30.CjKVHdkFnxFDyZSN4_5nTeX6K7SEu-DjvBH2lzfVrX8';
const SCHOOL_BRIDGE_URL = 'https://n8n.carltonaiservices.com/webhook/school-bridge';

// Subject colors for badges
const SUBJECT_COLORS = {
    math:            { bg: '#3B82F620', text: '#60A5FA', label: 'Math' },
    reading:         { bg: '#A855F720', text: '#C084FC', label: 'Reading' },
    science:         { bg: '#06D6A020', text: '#06D6A0', label: 'Science' },
    social_studies:  { bg: '#F59E0B20', text: '#FBBF24', label: 'Social Studies' },
    writing:         { bg: '#EC489920', text: '#F472B6', label: 'Writing' },
    spelling:        { bg: '#14B8A620', text: '#2DD4BF', label: 'Spelling' },
    typing:          { bg: '#8B5CF620', text: '#A78BFA', label: 'Typing' },
    other:           { bg: '#64748B20', text: '#94A3B8', label: 'Other' },
};

// Letter grade thresholds
const GRADE_THRESHOLDS = [
    { min: 90, grade: 'A', color: 'var(--deft-success)' },
    { min: 80, grade: 'B', color: '#60A5FA' },
    { min: 70, grade: 'C', color: 'var(--deft-warning)' },
    { min: 60, grade: 'D', color: '#FB923C' },
    { min: 0,  grade: 'F', color: 'var(--deft-danger)' },
];

function getLetterGrade(pct) {
    for (const t of GRADE_THRESHOLDS) {
        if (pct >= t.min) return t;
    }
    return GRADE_THRESHOLDS[GRADE_THRESHOLDS.length - 1];
}

function getSubjectStyle(subject) {
    return SUBJECT_COLORS[subject] || SUBJECT_COLORS.other;
}
