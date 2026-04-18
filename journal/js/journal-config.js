// =============================================
// Journal Config — Constants, Stickers & Presets
// =============================================

// Migrate old localStorage key
if (!localStorage.getItem('rdgr-active-profile') && localStorage.getItem('rdgr-active-profile')) {
    localStorage.setItem('rdgr-active-profile', localStorage.getItem('rdgr-active-profile'));
    localStorage.removeItem('rdgr-active-profile');
}

// =============================================
// CONFIG
// =============================================
const SUPABASE_URL = 'https://yrwrswyjawmgtxrgbnim.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyd3Jzd3lqYXdtZ3R4cmdibmltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYzODY2MzMsImV4cCI6MjA1MTk2MjYzM30.CjKVHdkFnxFDyZSN4_5nTeX6K7SEu-DjvBH2lzfVrX8';
const JOURNAL_DRIVE_URL = 'https://n8n.carltonaiservices.com/webhook/journal-drive';

// =============================================
// AUTOSAVE SETTINGS
// =============================================
const AUTOSAVE_INTERVAL_MS = 30000;
const AUTOSAVE_DEBOUNCE_MS = 2000;
const MAX_AUTOSAVE_VERSIONS = 20;

// =============================================
// MOOD OPTIONS
// =============================================
const MOOD_OPTIONS = [
    { slug: 'happy', emoji: '\u{1F60A}', label: 'Happy' },
    { slug: 'excited', emoji: '\u{1F929}', label: 'Excited' },
    { slug: 'calm', emoji: '\u{1F60C}', label: 'Calm' },
    { slug: 'grateful', emoji: '\u{1F64F}', label: 'Grateful' },
    { slug: 'tired', emoji: '\u{1F634}', label: 'Tired' },
    { slug: 'anxious', emoji: '\u{1F630}', label: 'Anxious' },
    { slug: 'sad', emoji: '\u{1F622}', label: 'Sad' },
    { slug: 'angry', emoji: '\u{1F621}', label: 'Angry' }
];

// =============================================
// STICKER LIBRARY
// =============================================
const STICKER_LIBRARY = [
    // Decorative
    { slug: 'star', category: 'decorative', emoji: '\u2B50', label: 'Star' },
    { slug: 'sparkles', category: 'decorative', emoji: '\u2728', label: 'Sparkles' },
    { slug: 'heart', category: 'decorative', emoji: '\u2764\uFE0F', label: 'Heart' },
    { slug: 'fire', category: 'decorative', emoji: '\u{1F525}', label: 'Fire' },
    { slug: 'rainbow', category: 'decorative', emoji: '\u{1F308}', label: 'Rainbow' },
    { slug: 'ribbon', category: 'decorative', emoji: '\u{1F380}', label: 'Ribbon' },
    { slug: 'balloon', category: 'decorative', emoji: '\u{1F388}', label: 'Balloon' },

    // Mood
    { slug: 'smile', category: 'mood', emoji: '\u{1F604}', label: 'Smile' },
    { slug: 'laugh', category: 'mood', emoji: '\u{1F602}', label: 'Laugh' },
    { slug: 'love-eyes', category: 'mood', emoji: '\u{1F60D}', label: 'Love Eyes' },
    { slug: 'thinking', category: 'mood', emoji: '\u{1F914}', label: 'Thinking' },
    { slug: 'mind-blown', category: 'mood', emoji: '\u{1F92F}', label: 'Mind Blown' },
    { slug: 'celebrate', category: 'mood', emoji: '\u{1F973}', label: 'Celebrate' },
    { slug: 'hug', category: 'mood', emoji: '\u{1F917}', label: 'Hug' },

    // Weather
    { slug: 'sunny', category: 'weather', emoji: '\u2600\uFE0F', label: 'Sunny' },
    { slug: 'cloudy', category: 'weather', emoji: '\u2601\uFE0F', label: 'Cloudy' },
    { slug: 'rainy', category: 'weather', emoji: '\u{1F327}\uFE0F', label: 'Rainy' },
    { slug: 'snowy', category: 'weather', emoji: '\u2744\uFE0F', label: 'Snowy' },
    { slug: 'stormy', category: 'weather', emoji: '\u26C8\uFE0F', label: 'Stormy' },
    { slug: 'windy', category: 'weather', emoji: '\u{1F32C}\uFE0F', label: 'Windy' },

    // Achievement
    { slug: 'trophy', category: 'achievement', emoji: '\u{1F3C6}', label: 'Trophy' },
    { slug: 'medal', category: 'achievement', emoji: '\u{1F3C5}', label: 'Medal' },
    { slug: 'check', category: 'achievement', emoji: '\u2705', label: 'Check' },
    { slug: 'rocket', category: 'achievement', emoji: '\u{1F680}', label: 'Rocket' },
    { slug: 'crown', category: 'achievement', emoji: '\u{1F451}', label: 'Crown' },
    { slug: 'muscle', category: 'achievement', emoji: '\u{1F4AA}', label: 'Muscle' },
    { slug: 'hundred', category: 'achievement', emoji: '\u{1F4AF}', label: 'Hundred' },

    // Nature
    { slug: 'flower', category: 'nature', emoji: '\u{1F33B}', label: 'Sunflower' },
    { slug: 'tree', category: 'nature', emoji: '\u{1F333}', label: 'Tree' },
    { slug: 'leaf', category: 'nature', emoji: '\u{1F343}', label: 'Leaf' },
    { slug: 'butterfly', category: 'nature', emoji: '\u{1F98B}', label: 'Butterfly' },
    { slug: 'ocean-wave', category: 'nature', emoji: '\u{1F30A}', label: 'Wave' },
    { slug: 'mountain', category: 'nature', emoji: '\u26F0\uFE0F', label: 'Mountain' },

    // Food
    { slug: 'coffee', category: 'food', emoji: '\u2615', label: 'Coffee' },
    { slug: 'pizza', category: 'food', emoji: '\u{1F355}', label: 'Pizza' },
    { slug: 'cake', category: 'food', emoji: '\u{1F382}', label: 'Cake' },
    { slug: 'cookie', category: 'food', emoji: '\u{1F36A}', label: 'Cookie' },
    { slug: 'fruit', category: 'food', emoji: '\u{1F34E}', label: 'Apple' },

    // Activity
    { slug: 'book', category: 'activity', emoji: '\u{1F4DA}', label: 'Books' },
    { slug: 'music', category: 'activity', emoji: '\u{1F3B5}', label: 'Music' },
    { slug: 'art', category: 'activity', emoji: '\u{1F3A8}', label: 'Art' },
    { slug: 'camera', category: 'activity', emoji: '\u{1F4F7}', label: 'Camera' },
    { slug: 'travel', category: 'activity', emoji: '\u{1F30D}', label: 'Travel' },
    { slug: 'gaming', category: 'activity', emoji: '\u{1F3AE}', label: 'Gaming' },
    { slug: 'workout', category: 'activity', emoji: '\u{1F3CB}\uFE0F', label: 'Workout' }
];
