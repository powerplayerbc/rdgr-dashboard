// ═══════════════════════════════════════
// School Config — Constants
// ═══════════════════════════════════════

const SUPABASE_URL = 'https://carltondb.72.60.67.2.sslip.io';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6ImNhcmx0b24iLCJpYXQiOjE3ODE2OTUzMDksImV4cCI6MjA5NzA1NTMwOX0.Tazw1TnCAXYY6Na6E7muccoLad3NrJltf9GUCPbNnSc';
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
