// =====================================================================
// School Typing Practice — 3 Game Modes for Brianna
// Paragraph Copy | Word Flash | Sentence Builder
// =====================================================================

// ─── Content Library ─────────────────────────────────────────────────
const TYPING_CONTENT = {
    paragraphs: {
        easy: [
            { title: 'Cats and Dogs', text: 'Cats and dogs are popular pets. Dogs like to run and play. Cats like to nap in the sun. Both animals love their owners very much.' },
            { title: 'The Sun', text: 'The sun is a big star. It gives us light and heat. Plants need the sun to grow. Without the sun, Earth would be dark and cold.' },
            { title: 'Rain', text: 'Rain falls from the clouds. It fills rivers and lakes. Plants drink the rain to grow tall. Puddles form on the ground after a storm.' },
            { title: 'Apples', text: 'Apples grow on trees. They can be red, green, or yellow. Apples taste sweet and crunchy. You can make pie, juice, or sauce from apples.' },
            { title: 'The Moon', text: 'The moon shines at night. It goes around the Earth. Sometimes the moon looks full and round. Other times it looks like a thin sliver.' },
            { title: 'Fish', text: 'Fish live in water. They use fins to swim and gills to breathe. Some fish are tiny. Other fish can grow very large.' },
            { title: 'Trees', text: 'Trees are tall plants. They have roots, a trunk, and branches. Leaves grow on the branches. Some trees lose their leaves in the fall.' },
            { title: 'Bikes', text: 'Bikes have two wheels. You pedal to make them go. A helmet keeps your head safe. Riding a bike is great exercise and lots of fun.' },
            { title: 'Snow', text: 'Snow falls when it is very cold. Each snowflake is unique. Kids love to build snowmen and have snowball fights. Snow melts when the sun comes out.' },
            { title: 'Frogs', text: 'Frogs can live on land and in water. They start life as tiny tadpoles. Frogs eat bugs with their long sticky tongue. They say ribbit at night.' },
            { title: 'Stars', text: 'Stars twinkle in the night sky. They are balls of hot gas far away. Our sun is the closest star. People have named groups of stars called constellations.' },
            { title: 'Ants', text: 'Ants are very small but strong. They can carry food much heavier than their own body. Ants live in big groups called colonies. They work together as a team.' }
        ],
        medium: [
            { title: 'Dolphins', text: 'Dolphins are smart sea animals that live in groups called pods. They talk to each other using clicks and whistles. Dolphins can jump high out of the water and do flips in the air. Baby dolphins stay close to their mothers for several years.' },
            { title: 'Mars', text: 'Mars is called the Red Planet because of its dusty red soil. It has the tallest volcano in our solar system named Olympus Mons. Scientists have sent robots called rovers to explore the surface of Mars. One day, people might travel there too.' },
            { title: 'Butterflies', text: 'Butterflies start life as caterpillars that munch on leaves. They spin a cocoon and transform inside it. When they come out, they have beautiful colorful wings. Monarch butterflies travel thousands of miles every year to stay warm.' },
            { title: 'Volcanoes', text: 'A volcano is a mountain with an opening at the top. Hot melted rock called lava can flow out during an eruption. Some volcanoes are underwater in the ocean. The Hawaiian islands were formed by volcanoes over millions of years.' },
            { title: 'Soccer', text: 'Soccer is the most popular sport in the world. Two teams of eleven players try to kick a ball into the goal. Players cannot use their hands except for the goalkeeper. The World Cup is the biggest soccer event and happens every four years.' },
            { title: 'Lightning', text: 'Lightning is a giant spark of electricity in the sky. It happens during thunderstorms when clouds build up energy. A bolt of lightning is hotter than the surface of the sun. Thunder is the sound that lightning makes as it heats the air around it.' },
            { title: 'Penguins', text: 'Penguins are birds that cannot fly but they are excellent swimmers. They live in cold places like Antarctica. Emperor penguins huddle together to stay warm in freezing winds. Father penguins keep the eggs warm on their feet for months.' },
            { title: 'Earthquakes', text: 'The ground beneath us is made of large pieces called plates. When these plates move and push against each other, we feel an earthquake. Scientists use machines to measure how strong the shaking is. Buildings in earthquake zones are built to be extra strong.' },
            { title: 'Honey Bees', text: 'Honey bees live in hives with thousands of other bees. They collect nectar from flowers and turn it into honey. Bees do a special dance to tell other bees where to find food. Without bees, many fruits and vegetables could not grow.' },
            { title: 'The Ocean', text: 'The ocean covers most of our planet. It is home to millions of different animals and plants. The deepest part of the ocean is called the Mariana Trench. Coral reefs are like underwater cities full of colorful sea life.' },
            { title: 'Tornadoes', text: 'A tornado is a spinning column of air that touches the ground. They can form during big thunderstorms in the spring and summer. Tornado Alley in the middle of the United States gets the most tornadoes. Storm chasers study tornadoes to help keep people safe.' },
            { title: 'Owls', text: 'Owls are birds that hunt at night using their amazing eyesight and hearing. They can turn their heads almost all the way around to look behind them. Owls fly silently because of the soft edges on their feathers. They eat mice, rabbits, and other small animals.' }
        ],
        hard: [
            { title: 'Photosynthesis', text: 'Plants make their own food through a process called photosynthesis. They absorb sunlight with their green leaves and mix it with water from the soil and carbon dioxide from the air. This produces sugar for energy and releases oxygen that we breathe. Without photosynthesis, there would be almost no oxygen in our atmosphere.' },
            { title: 'The Solar System', text: 'Our solar system has eight planets that orbit the sun. The four inner planets are rocky, while the four outer planets are mostly made of gas. Jupiter is the largest planet and could fit over a thousand Earths inside it. Beyond the planets lies the Kuiper Belt, home to dwarf planets like Pluto and thousands of icy objects.' },
            { title: 'Animal Migration', text: 'Every year, millions of animals travel long distances in search of food, warmth, or places to have babies. Arctic terns fly from the Arctic to Antarctica and back, covering about fifty thousand miles each year. Wildebeest herds in Africa follow the rains across the savanna in enormous groups. Scientists track migrations using tiny GPS devices attached to the animals.' },
            { title: 'Electricity', text: 'Electricity is a form of energy that powers our homes, schools, and devices. It flows through wires like water flows through pipes. Power plants generate electricity by spinning large magnets near coils of wire. Renewable sources like solar panels and wind turbines create electricity without burning fossil fuels, which helps protect our environment.' },
            { title: 'Fossils', text: 'Fossils are the preserved remains of plants and animals that lived millions of years ago. When an organism dies and gets buried in mud or sand, minerals slowly replace its bones and shells over thousands of years. Paleontologists carefully dig up fossils and study them to learn about ancient life on Earth. The largest dinosaur fossil ever found belonged to a titanosaur that was over one hundred feet long.' },
            { title: 'The Human Brain', text: 'Your brain is the control center of your entire body and weighs about three pounds. It contains billions of tiny cells called neurons that send electrical signals to each other. Different parts of the brain handle different jobs like seeing, hearing, moving, and thinking. Your brain uses about twenty percent of all the energy your body produces, even though it makes up only two percent of your weight.' },
            { title: 'Coral Reefs', text: 'Coral reefs are often called the rainforests of the sea because they support so many different species. They are built by tiny animals called coral polyps that create hard skeletons out of calcium carbonate. Reefs provide food and shelter for about twenty-five percent of all marine species. Climate change and pollution threaten coral reefs around the world, causing them to bleach and lose their vibrant colors.' },
            { title: 'Basketball History', text: 'Basketball was invented in 1891 by a teacher named James Naismith who needed an indoor game for his students during winter. The first game used a soccer ball and two peach baskets nailed to a balcony railing. Players had to climb a ladder to get the ball out of the basket after every score. Today basketball is played by hundreds of millions of people in countries around the world.' },
            { title: 'Water Cycle', text: 'The water cycle is the continuous journey that water takes around our planet. Water evaporates from oceans, lakes, and rivers when the sun heats it, turning into invisible water vapor in the air. As the vapor rises and cools, it condenses into tiny droplets that form clouds. When enough droplets gather together, they fall back to the ground as rain or snow, and the cycle starts all over again.' },
            { title: 'Space Exploration', text: 'Humans first traveled to space in 1961 when Yuri Gagarin orbited the Earth in a spacecraft. Eight years later, Neil Armstrong and Buzz Aldrin walked on the moon during the Apollo eleven mission. Today astronauts live and work on the International Space Station, which orbits Earth about every ninety minutes. Private companies are now building rockets that could one day carry people to Mars and beyond.' },
            { title: 'Camouflage', text: 'Many animals use camouflage to blend in with their surroundings and avoid being eaten by predators. Chameleons can change the color of their skin to match the leaves and branches around them. Arctic foxes turn white in winter to hide in the snow and brown in summer to blend with the ground. Some insects look exactly like sticks or leaves, making them nearly impossible to spot in a forest.' },
            { title: 'Recycling', text: 'Recycling turns old materials into new products instead of throwing them into landfills. Aluminum cans can be recycled and back on store shelves in about sixty days. Recycling one ton of paper saves seventeen trees and seven thousand gallons of water. By sorting our trash into recycling bins for paper, plastic, glass, and metal, we help reduce pollution and conserve natural resources for future generations.' }
        ]
    },
    words: {
        easy: [
            'the', 'and', 'cat', 'dog', 'run', 'big', 'red', 'sun', 'hat', 'cup',
            'map', 'fun', 'bed', 'box', 'sit', 'hop', 'top', 'new', 'old', 'yes',
            'pet', 'pan', 'fan', 'ten', 'six', 'put', 'got', 'let', 'win', 'ask',
            'book', 'tree', 'star', 'rain', 'play', 'fish', 'ball', 'jump', 'moon', 'bird'
        ],
        medium: [
            'apple', 'beach', 'cloud', 'dream', 'earth', 'flame', 'green', 'house',
            'juice', 'knife', 'light', 'mouse', 'night', 'ocean', 'plant', 'queen',
            'river', 'snake', 'train', 'under', 'voice', 'water', 'young', 'zebra',
            'brave', 'climb', 'dance', 'empty', 'float', 'giant', 'happy', 'island',
            'jolly', 'knock', 'lemon', 'magic', 'north', 'outer', 'paint', 'quiet'
        ],
        hard: [
            'absolute', 'bacteria', 'calendar', 'dinosaur', 'elephant', 'fraction',
            'geometry', 'hydrogen', 'internet', 'judgment', 'kangaroo', 'language',
            'mountain', 'nitrogen', 'opposite', 'paradise', 'question', 'reindeer',
            'skeleton', 'treasure', 'umbrella', 'vacation', 'waterfall', 'xylophone',
            'yourself', 'adventure', 'beautiful', 'chocolate', 'dangerous', 'excellent',
            'furniture', 'gymnasium', 'Halloween', 'invisible', 'jellyfish', 'knowledge',
            'landscape', 'marshmallow', 'narrative', 'orchestra'
        ]
    },
    sentences: {
        easy: [
            'The dog runs fast in the yard.',
            'I like to eat red apples.',
            'She has a big blue ball.',
            'The bird sits on the tree.',
            'We play games after school.',
            'My cat naps on the bed.',
            'The rain falls from the sky.',
            'He can jump very high.',
            'I ride my bike to the park.',
            'The moon shines at night.',
            'Fish swim in the lake.',
            'We read books every day.'
        ],
        medium: [
            'The dolphins jumped through the ocean waves together.',
            'Scientists discovered a new species of butterfly last year.',
            'Our class planted a garden behind the school building.',
            'The astronauts floated inside the space station.',
            'Lightning flashed across the dark sky during the storm.',
            'The penguin waddled across the ice to find its family.',
            'My favorite subject in school is science class.',
            'The volcano erupted and sent ash high into the air.',
            'Basketball players practice their free throws every day.',
            'The recycling truck comes to our street every Tuesday.',
            'Owls can see much better than humans in the dark.',
            'Honey bees visit hundreds of flowers to make their honey.'
        ],
        hard: [
            'The ancient fossil was carefully excavated from the limestone cliff by the paleontologists.',
            'Photosynthesis allows plants to convert sunlight into chemical energy stored in sugar molecules.',
            'The International Space Station orbits the Earth approximately sixteen times every single day.',
            'Coral reefs support about one quarter of all known marine species in our oceans.',
            'The water cycle continuously moves water between the atmosphere and the surface of the Earth.',
            'Electricity generated by wind turbines is a renewable source of clean energy for our communities.',
            'Arctic foxes change the color of their fur between seasons to camouflage with their environment.',
            'Recycling aluminum cans uses ninety-five percent less energy than manufacturing them from raw materials.',
            'The human brain contains approximately one hundred billion neurons connected by trillions of synapses.',
            'Migration patterns of monarch butterflies span thousands of miles across the North American continent.',
            'Earthquakes happen when tectonic plates beneath the surface of the Earth suddenly shift and release energy.',
            'Basketball was invented by James Naismith using a soccer ball and two peach baskets in a gymnasium.'
        ]
    }
};

// ─── Typing State ────────────────────────────────────────────────────
let typingState = {
    mode: 'paragraph',
    difficulty: 'medium',
    timerDuration: 60,
    isRunning: false,
    isPaused: false,
    startTime: null,
    timerId: null,
    elapsed: 0,

    // Paragraph mode
    sourceText: '',
    charSpans: [],
    cursorPos: 0,
    correctCount: 0,
    incorrectCount: 0,
    totalTyped: 0,

    // Word flash mode
    wordList: [],
    wordIndex: 0,
    wordTimer: null,
    wordTimeLeft: 0,
    wordMaxTime: 0,
    wordBarTimer: null,
    wordResults: [],

    // Sentence builder mode
    sentenceList: [],
    sentenceIndex: 0,
    sentencePhase: 'idle',
    sentenceResults: [],

    // Stats
    sessions: [],
    bestWpm: 0,
    avgAccuracy: 0,
    todayCount: 0,
    todaySeconds: 0,
    streak: 0
};

// ─── Init ────────────────────────────────────────────────────────────
async function initTyping() {
    const container = document.getElementById('typing-container');
    if (!container) return;

    container.innerHTML = buildTypingUI();
    injectTypingStyles();
    await loadTypingStats();
    renderStatsBar();
    setTypingMode('paragraph');
    bindDifficultyButtons();
    bindTimerButtons();
}

// ─── Load Stats from Supabase ────────────────────────────────────────
async function loadTypingStats() {
    if (!activeProfileId) return;
    const rows = await supabaseSelect(
        'school_typing_sessions',
        `student_id=eq.${activeProfileId}&select=*&order=created_at.desc&limit=50`
    );
    if (!rows) { typingState.sessions = []; return; }
    typingState.sessions = rows;

    // Best WPM
    typingState.bestWpm = rows.reduce((mx, r) => Math.max(mx, r.wpm || 0), 0);

    // Avg accuracy (last 10)
    const last10 = rows.slice(0, 10);
    typingState.avgAccuracy = last10.length
        ? Math.round(last10.reduce((s, r) => s + (r.accuracy || 0), 0) / last10.length)
        : 0;

    // Today count + total practice seconds today (UBR-0122 — surfaces time
    // across all modes: paragraph, word_flash, and sentence)
    const todayISO = new Date().toISOString().split('T')[0];
    const todayRows = rows.filter(r => (r.created_at || '').startsWith(todayISO));
    typingState.todayCount = todayRows.length;
    typingState.todaySeconds = todayRows.reduce((s, r) => s + (r.duration_secs || 0), 0);

    // Streak
    typingState.streak = computeStreak(rows);
}

function computeStreak(rows) {
    if (!rows.length) return 0;
    const days = new Set();
    rows.forEach(r => {
        if (r.created_at) days.add(r.created_at.split('T')[0]);
    });
    const sorted = [...days].sort().reverse();
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (!sorted.includes(today) && !sorted.includes(yesterday)) return 0;

    let streak = 0;
    let checkDate = new Date(sorted[0] + 'T00:00:00');
    for (let i = 0; i < sorted.length; i++) {
        const expected = new Date(checkDate);
        expected.setDate(expected.getDate() - i);
        const exp = expected.toISOString().split('T')[0];
        if (sorted.includes(exp)) {
            streak++;
        } else {
            break;
        }
    }
    return streak;
}

// ─── Build Main UI ───────────────────────────────────────────────────
function buildTypingUI() {
    return `
    <div class="tp-wrapper">
        <!-- Stats Bar -->
        <div class="tp-stats-bar" id="tp-stats-bar"></div>

        <!-- Mode Selector -->
        <div class="tp-mode-bar">
            <button class="tp-mode-btn active" data-mode="paragraph" onclick="setTypingMode('paragraph')">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="2" rx="1" fill="currentColor"/><rect x="2" y="6" width="10" height="2" rx="1" fill="currentColor" opacity="0.7"/><rect x="2" y="10" width="12" height="2" rx="1" fill="currentColor" opacity="0.5"/></svg>
                Paragraph
            </button>
            <button class="tp-mode-btn" data-mode="wordflash" onclick="setTypingMode('wordflash')">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2L6 9h4L8 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Word Flash
            </button>
            <button class="tp-mode-btn" data-mode="sentence" onclick="setTypingMode('sentence')">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.2"/><path d="M4 7h8M4 9.5h5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>
                Sentence Builder
            </button>
        </div>

        <!-- Difficulty + Timer Row -->
        <div class="tp-controls-row">
            <div class="tp-pill-group" id="tp-difficulty">
                <button class="tp-pill" data-diff="easy" onclick="setDifficulty('easy')">Easy</button>
                <button class="tp-pill active" data-diff="medium" onclick="setDifficulty('medium')">Medium</button>
                <button class="tp-pill" data-diff="hard" onclick="setDifficulty('hard')">Hard</button>
            </div>
            <div class="tp-pill-group tp-timer-pills" id="tp-timer-pills" style="display:none;">
                <button class="tp-pill" data-time="30" onclick="setTimer(30)">30s</button>
                <button class="tp-pill active" data-time="60" onclick="setTimer(60)">60s</button>
                <button class="tp-pill" data-time="90" onclick="setTimer(90)">90s</button>
            </div>
        </div>

        <!-- Game Area -->
        <div class="tp-game-area" id="tp-game-area"></div>

        <!-- History Panel -->
        <details class="tp-history-panel" id="tp-history-panel">
            <summary class="tp-history-toggle">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.2"/><path d="M7 4.5V7l2 1.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>
                Session History
                <svg class="tp-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </summary>
            <div class="tp-history-content" id="tp-history-content"></div>
        </details>
    </div>
    `;
}

// ─── Stats Bar ───────────────────────────────────────────────────────
function renderStatsBar() {
    const bar = document.getElementById('tp-stats-bar');
    if (!bar) return;
    bar.innerHTML = `
        <div class="tp-stat-chip">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="var(--deft-accent)" stroke-width="1.2"/><path d="M7 4v3l2 1" stroke="var(--deft-accent)" stroke-width="1.1" stroke-linecap="round"/></svg>
            <div class="tp-stat-val">${typingState.todayCount}</div>
            <div class="tp-stat-lbl">Today</div>
        </div>
        <div class="tp-stat-chip">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="#A78BFA" stroke-width="1.2"/><path d="M7 3.5V7l2.5 1.5" stroke="#A78BFA" stroke-width="1.2" stroke-linecap="round"/></svg>
            <div class="tp-stat-val">${formatDuration(typingState.todaySeconds)}</div>
            <div class="tp-stat-lbl">Time Today</div>
        </div>
        <div class="tp-stat-chip">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2l1.5 3 3.5.5-2.5 2.5.5 3.5L7 10l-3 1.5.5-3.5L2 5.5 5.5 5z" stroke="#FBBF24" stroke-width="1.1" fill="#FBBF2440"/></svg>
            <div class="tp-stat-val">${typingState.bestWpm}</div>
            <div class="tp-stat-lbl">Best WPM</div>
        </div>
        <div class="tp-stat-chip">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 10l3-4 2.5 2L11 3" stroke="var(--deft-success)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <div class="tp-stat-val">${typingState.avgAccuracy}%</div>
            <div class="tp-stat-lbl">Avg Accuracy</div>
        </div>
        <div class="tp-stat-chip">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.8 2.8l1.4 1.4M9.8 9.8l1.4 1.4M11.2 2.8l-1.4 1.4M4.2 9.8l-1.4 1.4" stroke="#F97316" stroke-width="1.2" stroke-linecap="round"/></svg>
            <div class="tp-stat-val">${typingState.streak}</div>
            <div class="tp-stat-lbl">Streak</div>
        </div>
    `;
}

// ─── Mode Switching ──────────────────────────────────────────────────
function setTypingMode(mode) {
    stopAllTimers();
    typingState.mode = mode;
    typingState.isRunning = false;

    document.querySelectorAll('.tp-mode-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === mode);
    });

    const timerPills = document.getElementById('tp-timer-pills');
    if (timerPills) timerPills.style.display = mode === 'paragraph' ? '' : 'none';

    renderGameArea();
}

function setDifficulty(diff) {
    typingState.difficulty = diff;
    document.querySelectorAll('#tp-difficulty .tp-pill').forEach(b => {
        b.classList.toggle('active', b.dataset.diff === diff);
    });
    if (!typingState.isRunning) renderGameArea();
}

function setTimer(secs) {
    typingState.timerDuration = secs;
    document.querySelectorAll('#tp-timer-pills .tp-pill').forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.time) === secs);
    });
    if (!typingState.isRunning) renderGameArea();
}

function bindDifficultyButtons() {}
function bindTimerButtons() {}

// ─── Render Game Area ────────────────────────────────────────────────
function renderGameArea() {
    const area = document.getElementById('tp-game-area');
    if (!area) return;

    if (typingState.mode === 'paragraph') renderParagraphMode(area);
    else if (typingState.mode === 'wordflash') renderWordFlashMode(area);
    else if (typingState.mode === 'sentence') renderSentenceMode(area);

    renderHistory();
}

// =====================================================================
//   PARAGRAPH COPY MODE
// =====================================================================
function renderParagraphMode(area) {
    const passages = TYPING_CONTENT.paragraphs[typingState.difficulty] || TYPING_CONTENT.paragraphs.medium;
    const passage = passages[Math.floor(Math.random() * passages.length)];
    typingState.sourceText = passage.text;
    typingState.passageTitle = passage.title;
    typingState.cursorPos = 0;
    typingState.correctCount = 0;
    typingState.incorrectCount = 0;
    typingState.totalTyped = 0;
    typingState.isRunning = false;
    typingState.startTime = null;
    typingState.elapsed = 0;

    area.innerHTML = `
        <div class="tp-paragraph-wrapper">
            <div class="tp-para-header">
                <span class="tp-para-title">${escapeHtml(passage.title)}</span>
                <div class="tp-para-live-stats">
                    <span id="tp-live-wpm">0 WPM</span>
                    <span class="tp-live-sep">|</span>
                    <span id="tp-live-acc">100%</span>
                </div>
            </div>

            <div class="tp-timer-ring-row">
                <div class="tp-timer-ring-container">
                    <svg class="tp-timer-ring" viewBox="0 0 80 80">
                        <circle class="tp-ring-bg" cx="40" cy="40" r="34" />
                        <circle class="tp-ring-fg" id="tp-ring-fg" cx="40" cy="40" r="34" />
                    </svg>
                    <div class="tp-ring-label" id="tp-ring-label">${typingState.timerDuration}</div>
                </div>
            </div>

            <div class="tp-source-display" id="tp-source-display"></div>

            <textarea class="tp-hidden-input" id="tp-hidden-input"
                autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                aria-label="Type here to practice"></textarea>

            <div class="tp-para-actions">
                <button class="tp-btn tp-btn-primary" id="tp-start-btn" onclick="startParagraph()">Start Typing</button>
                <button class="tp-btn tp-btn-secondary" onclick="renderGameArea()" style="display:none;" id="tp-restart-btn">New Paragraph</button>
            </div>
        </div>
    `;

    buildCharSpans(passage.text);

    // Click on source text to focus hidden input
    const srcDisplay = document.getElementById('tp-source-display');
    if (srcDisplay) {
        srcDisplay.addEventListener('click', () => {
            const inp = document.getElementById('tp-hidden-input');
            if (inp && !inp.disabled) inp.focus();
        });
    }
}

function buildCharSpans(text) {
    const display = document.getElementById('tp-source-display');
    if (!display) return;
    display.innerHTML = '';
    typingState.charSpans = [];
    for (let i = 0; i < text.length; i++) {
        const span = document.createElement('span');
        span.className = 'tp-char';
        span.textContent = text[i] === ' ' ? '\u00A0' : text[i];
        if (i === 0) span.classList.add('current');
        display.appendChild(span);
        typingState.charSpans.push(span);
    }
}

function startParagraph() {
    typingState.isRunning = true;
    typingState.startTime = Date.now();
    typingState.elapsed = 0;
    typingState.cursorPos = 0;
    typingState.correctCount = 0;
    typingState.incorrectCount = 0;
    typingState.totalTyped = 0;

    const input = document.getElementById('tp-hidden-input');
    const startBtn = document.getElementById('tp-start-btn');
    const restartBtn = document.getElementById('tp-restart-btn');
    if (startBtn) startBtn.style.display = 'none';
    if (restartBtn) restartBtn.style.display = '';
    if (input) {
        input.value = '';
        input.focus();
        input.addEventListener('input', handleParagraphInput);
        input.addEventListener('keydown', handleParagraphKeydown);
    }

    startParagraphTimer();
}

function handleParagraphKeydown(e) {
    if (e.key === 'Backspace') {
        e.preventDefault();
        if (typingState.cursorPos > 0) {
            typingState.cursorPos--;
            const prev = typingState.charSpans[typingState.cursorPos];
            if (prev) {
                if (prev.classList.contains('incorrect')) typingState.incorrectCount--;
                else if (prev.classList.contains('correct')) typingState.correctCount--;
                prev.className = 'tp-char current';
            }
            if (typingState.cursorPos + 1 < typingState.charSpans.length) {
                typingState.charSpans[typingState.cursorPos + 1].classList.remove('current');
            }
            typingState.totalTyped = Math.max(0, typingState.totalTyped - 1);
            updateLiveStats();
        }
    }
}

function handleParagraphInput(e) {
    if (!typingState.isRunning) return;
    const typed = e.data;
    if (!typed) return;

    for (let i = 0; i < typed.length; i++) {
        if (typingState.cursorPos >= typingState.sourceText.length) break;

        const expected = typingState.sourceText[typingState.cursorPos];
        const actual = typed[i];
        const span = typingState.charSpans[typingState.cursorPos];

        span.classList.remove('current');
        typingState.totalTyped++;

        if (actual === expected) {
            span.classList.add('correct');
            typingState.correctCount++;
        } else {
            span.classList.add('incorrect');
            typingState.incorrectCount++;
        }

        typingState.cursorPos++;

        if (typingState.cursorPos < typingState.charSpans.length) {
            typingState.charSpans[typingState.cursorPos].classList.add('current');
        }
    }

    updateLiveStats();

    // Completed all text
    if (typingState.cursorPos >= typingState.sourceText.length) {
        finishParagraph();
    }
}

function startParagraphTimer() {
    const totalSecs = typingState.timerDuration;
    const ringFg = document.getElementById('tp-ring-fg');
    const label = document.getElementById('tp-ring-label');
    const circumference = 2 * Math.PI * 34;
    if (ringFg) {
        ringFg.style.strokeDasharray = circumference;
        ringFg.style.strokeDashoffset = '0';
    }

    typingState.timerId = setInterval(() => {
        if (!typingState.isRunning) return;
        typingState.elapsed = (Date.now() - typingState.startTime) / 1000;
        const remaining = Math.max(0, totalSecs - typingState.elapsed);
        const secs = Math.ceil(remaining);

        if (label) label.textContent = secs;
        if (ringFg) {
            const pct = remaining / totalSecs;
            ringFg.style.strokeDashoffset = circumference * (1 - pct);
        }

        updateLiveStats();

        if (remaining <= 0) {
            finishParagraph();
        }
    }, 100);
}

function updateLiveStats() {
    const elapsedSec = typingState.startTime ? (Date.now() - typingState.startTime) / 1000 : 0;
    const wpm = elapsedSec > 0 ? Math.round((typingState.correctCount / 5) / (elapsedSec / 60)) : 0;
    const acc = typingState.totalTyped > 0 ? Math.round((typingState.correctCount / typingState.totalTyped) * 100) : 100;

    const wpmEl = document.getElementById('tp-live-wpm');
    const accEl = document.getElementById('tp-live-acc');
    if (wpmEl) wpmEl.textContent = wpm + ' WPM';
    if (accEl) accEl.textContent = acc + '%';
}

function finishParagraph() {
    typingState.isRunning = false;
    stopAllTimers();

    const elapsedSec = (Date.now() - typingState.startTime) / 1000;
    const wpm = elapsedSec > 0 ? Math.round((typingState.correctCount / 5) / (elapsedSec / 60)) : 0;
    const acc = typingState.totalTyped > 0 ? Math.round((typingState.correctCount / typingState.totalTyped) * 100) : 100;
    const rating = getSessionRating(wpm, acc);

    const input = document.getElementById('tp-hidden-input');
    if (input) {
        input.removeEventListener('input', handleParagraphInput);
        input.removeEventListener('keydown', handleParagraphKeydown);
        input.disabled = true;
    }

    showResults({
        mode: 'paragraph',
        wpm, accuracy: acc,
        correct: typingState.correctCount,
        incorrect: typingState.incorrectCount,
        total: typingState.totalTyped,
        duration: Math.round(elapsedSec),
        rating,
        title: typingState.passageTitle || ''
    });
}

// =====================================================================
//   WORD FLASH MODE
// =====================================================================
function renderWordFlashMode(area) {
    typingState.wordList = [];
    typingState.wordIndex = 0;
    typingState.wordResults = [];
    typingState.isRunning = false;

    area.innerHTML = `
        <div class="tp-wordflash-wrapper">
            <div class="tp-wf-progress" id="tp-wf-progress">0 / 20</div>

            <div class="tp-wf-display" id="tp-wf-display">
                <div class="tp-wf-word" id="tp-wf-word">Ready?</div>
                <div class="tp-wf-timer-bar-track">
                    <div class="tp-wf-timer-bar" id="tp-wf-timer-bar"></div>
                </div>
            </div>

            <input class="tp-wf-input" id="tp-wf-input"
                autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                placeholder="Type the word..."
                aria-label="Type the displayed word"
                disabled />

            <div class="tp-para-actions">
                <button class="tp-btn tp-btn-primary" id="tp-wf-start" onclick="startWordFlash()">Start Round</button>
                <button class="tp-btn tp-btn-secondary" id="tp-wf-stop" onclick="stopWordFlash()" style="display:none;">Stop</button>
            </div>
        </div>
    `;
}

function startWordFlash() {
    const words = TYPING_CONTENT.words[typingState.difficulty] || TYPING_CONTENT.words.medium;
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    typingState.wordList = shuffled.slice(0, 20);
    typingState.wordIndex = 0;
    typingState.wordResults = [];
    typingState.isRunning = true;
    typingState.startTime = Date.now();

    const startBtn = document.getElementById('tp-wf-start');
    if (startBtn) startBtn.style.display = 'none';
    const stopBtn = document.getElementById('tp-wf-stop');
    if (stopBtn) stopBtn.style.display = '';

    const input = document.getElementById('tp-wf-input');
    if (input) {
        input.disabled = false;
        input.addEventListener('keydown', handleWordFlashKey);
    }

    showNextWord();
}

function getWordTime(word) {
    const diffMult = { easy: 1.4, medium: 1.0, hard: 0.75 };
    const mult = diffMult[typingState.difficulty] || 1.0;
    return Math.max(3, Math.ceil(word.length * 0.6)) * mult;
}

function showNextWord() {
    if (typingState.wordIndex >= typingState.wordList.length) {
        finishWordFlash();
        return;
    }

    const word = typingState.wordList[typingState.wordIndex];
    const wordEl = document.getElementById('tp-wf-word');
    const barEl = document.getElementById('tp-wf-timer-bar');
    const progEl = document.getElementById('tp-wf-progress');
    const input = document.getElementById('tp-wf-input');
    const display = document.getElementById('tp-wf-display');

    if (wordEl) {
        wordEl.textContent = word;
        wordEl.className = 'tp-wf-word';
    }
    if (display) display.className = 'tp-wf-display';
    if (progEl) progEl.textContent = `${typingState.wordIndex + 1} / 20`;
    if (input) { input.value = ''; input.focus(); }

    const maxTime = getWordTime(word);
    typingState.wordMaxTime = maxTime;
    typingState.wordTimeLeft = maxTime;

    if (barEl) {
        barEl.style.transition = 'none';
        barEl.style.width = '100%';
        barEl.style.background = 'var(--deft-accent)';
        barEl.offsetHeight; // force reflow
        barEl.style.transition = `width ${maxTime}s linear`;
        barEl.style.width = '0%';
    }

    clearInterval(typingState.wordTimer);
    const startedAt = Date.now();
    typingState.wordTimer = setInterval(() => {
        const elapsed = (Date.now() - startedAt) / 1000;
        typingState.wordTimeLeft = maxTime - elapsed;

        if (barEl) {
            const pct = Math.max(0, typingState.wordTimeLeft / maxTime);
            if (pct < 0.3) barEl.style.background = 'var(--deft-danger)';
            else if (pct < 0.6) barEl.style.background = 'var(--deft-warning, #FBBF24)';
        }

        if (typingState.wordTimeLeft <= 0) {
            clearInterval(typingState.wordTimer);
            typingState.wordResults.push({ word, typed: '', correct: false, timedOut: true });
            flashWordResult(false);
        }
    }, 50);
}

function handleWordFlashKey(e) {
    if (e.key !== 'Enter') return;
    if (!typingState.isRunning) return;
    e.preventDefault();

    const input = document.getElementById('tp-wf-input');
    const typed = (input ? input.value : '').trim();
    const word = typingState.wordList[typingState.wordIndex];
    const correct = typed.toLowerCase() === word.toLowerCase();

    clearInterval(typingState.wordTimer);
    typingState.wordResults.push({ word, typed, correct, timedOut: false });
    flashWordResult(correct);
}

function flashWordResult(correct) {
    const display = document.getElementById('tp-wf-display');
    const wordEl = document.getElementById('tp-wf-word');

    if (display) display.classList.add(correct ? 'tp-flash-correct' : 'tp-flash-incorrect');
    if (wordEl && !correct) {
        const expected = typingState.wordList[typingState.wordIndex];
        wordEl.textContent = expected;
    }

    setTimeout(() => {
        typingState.wordIndex++;
        showNextWord();
    }, 600);
}

// User-initiated quit (UBR-0120). If they typed any words, save the partial
// session so the time doesn't disappear; otherwise just reset the UI without
// polluting history with an empty row.
function stopWordFlash() {
    if (!typingState.isRunning) return;
    if (typingState.wordIndex > 0 || typingState.wordResults.length > 0) {
        finishWordFlash();
    } else {
        typingState.isRunning = false;
        clearInterval(typingState.wordTimer);
        clearInterval(typingState.wordBarTimer);
        renderGameArea();
    }
}

function finishWordFlash() {
    typingState.isRunning = false;
    clearInterval(typingState.wordTimer);
    clearInterval(typingState.wordBarTimer);

    const stopBtn = document.getElementById('tp-wf-stop');
    if (stopBtn) stopBtn.style.display = 'none';

    const input = document.getElementById('tp-wf-input');
    if (input) {
        input.disabled = true;
        input.removeEventListener('keydown', handleWordFlashKey);
    }

    const totalAttempted = typingState.wordResults.length;
    const correctCount = typingState.wordResults.filter(r => r.correct).length;
    const correctChars = typingState.wordResults.filter(r => r.correct).reduce((s, r) => s + r.word.length, 0);
    const elapsedSec = typingState.startTime ? (Date.now() - typingState.startTime) / 1000 : 0;
    const wpm = elapsedSec > 0 ? Math.round((correctChars / 5) / (elapsedSec / 60)) : 0;
    const acc = totalAttempted > 0 ? Math.round((correctCount / totalAttempted) * 100) : 0;
    const rating = getSessionRating(wpm, acc);

    showResults({
        mode: 'wordflash',
        wpm, accuracy: acc,
        correct: correctCount,
        incorrect: totalAttempted - correctCount,
        total: totalAttempted,
        duration: Math.round(elapsedSec),
        rating,
        title: 'Word Flash',
        wordResults: typingState.wordResults
    });
}

// =====================================================================
//   SENTENCE BUILDER MODE
// =====================================================================
function renderSentenceMode(area) {
    typingState.sentenceList = [];
    typingState.sentenceIndex = 0;
    typingState.sentenceResults = [];
    typingState.sentencePhase = 'idle';
    typingState.isRunning = false;

    area.innerHTML = `
        <div class="tp-sentence-wrapper">
            <div class="tp-sb-progress" id="tp-sb-progress">0 / 10</div>

            <div class="tp-sb-display" id="tp-sb-display">
                <div class="tp-sb-instruction" id="tp-sb-instruction">Read the sentence, then type it from memory!</div>
                <div class="tp-sb-sentence" id="tp-sb-sentence"></div>
            </div>

            <textarea class="tp-sb-input" id="tp-sb-input" rows="2"
                autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                placeholder="Type the sentence from memory..."
                aria-label="Type the sentence from memory"
                disabled></textarea>

            <div class="tp-sb-comparison" id="tp-sb-comparison" style="display:none;"></div>

            <div class="tp-para-actions">
                <button class="tp-btn tp-btn-primary" id="tp-sb-start" onclick="startSentenceBuilder()">Start Round</button>
                <button class="tp-btn tp-btn-primary" id="tp-sb-submit" onclick="submitSentence()" style="display:none;">Submit</button>
                <button class="tp-btn tp-btn-secondary" id="tp-sb-next" onclick="nextSentence()" style="display:none;">Next</button>
                <button class="tp-btn tp-btn-secondary" id="tp-sb-stop" onclick="stopSentenceBuilder()" style="display:none;">Stop</button>
            </div>
        </div>
    `;
}

function startSentenceBuilder() {
    const sentences = TYPING_CONTENT.sentences[typingState.difficulty] || TYPING_CONTENT.sentences.medium;
    const shuffled = [...sentences].sort(() => Math.random() - 0.5);
    typingState.sentenceList = shuffled.slice(0, 10);
    typingState.sentenceIndex = 0;
    typingState.sentenceResults = [];
    typingState.isRunning = true;
    typingState.startTime = Date.now();

    const startBtn = document.getElementById('tp-sb-start');
    if (startBtn) startBtn.style.display = 'none';
    const stopBtn = document.getElementById('tp-sb-stop');
    if (stopBtn) stopBtn.style.display = '';

    showSentenceRead();
}

// User-initiated quit (UBR-0120 parity). If they completed any sentence,
// save what they did; otherwise reset.
function stopSentenceBuilder() {
    if (!typingState.isRunning) return;
    if (typingState.sentenceResults.length > 0) {
        finishSentenceBuilder();
    } else {
        typingState.isRunning = false;
        typingState.sentencePhase = 'idle';
        renderGameArea();
    }
}

function showSentenceRead() {
    if (typingState.sentenceIndex >= typingState.sentenceList.length) {
        finishSentenceBuilder();
        return;
    }

    const sentence = typingState.sentenceList[typingState.sentenceIndex];
    const sentEl = document.getElementById('tp-sb-sentence');
    const instrEl = document.getElementById('tp-sb-instruction');
    const progEl = document.getElementById('tp-sb-progress');
    const input = document.getElementById('tp-sb-input');
    const comparison = document.getElementById('tp-sb-comparison');
    const submitBtn = document.getElementById('tp-sb-submit');
    const nextBtn = document.getElementById('tp-sb-next');

    if (sentEl) sentEl.textContent = sentence;
    if (instrEl) instrEl.textContent = 'Read carefully...';
    if (progEl) progEl.textContent = `${typingState.sentenceIndex + 1} / 10`;
    if (input) { input.value = ''; input.disabled = true; }
    if (comparison) comparison.style.display = 'none';
    if (submitBtn) submitBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';

    typingState.sentencePhase = 'read';

    // After 3 seconds, hide sentence and enable typing
    setTimeout(() => {
        if (typingState.sentencePhase !== 'read') return;
        showSentenceType();
    }, 3000);
}

function showSentenceType() {
    const sentEl = document.getElementById('tp-sb-sentence');
    const instrEl = document.getElementById('tp-sb-instruction');
    const input = document.getElementById('tp-sb-input');
    const submitBtn = document.getElementById('tp-sb-submit');

    if (sentEl) sentEl.textContent = '';
    if (instrEl) instrEl.textContent = 'Now type it from memory!';
    if (input) { input.disabled = false; input.focus(); }
    if (submitBtn) submitBtn.style.display = '';

    typingState.sentencePhase = 'type';

    // Also allow Enter to submit
    if (input) {
        input.onkeydown = function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitSentence();
            }
        };
    }
}

function submitSentence() {
    if (typingState.sentencePhase !== 'type') return;
    typingState.sentencePhase = 'compare';

    const input = document.getElementById('tp-sb-input');
    const submitBtn = document.getElementById('tp-sb-submit');
    const nextBtn = document.getElementById('tp-sb-next');
    const comparison = document.getElementById('tp-sb-comparison');

    const typed = (input ? input.value : '').trim();
    const original = typingState.sentenceList[typingState.sentenceIndex];

    if (input) { input.disabled = true; input.onkeydown = null; }
    if (submitBtn) submitBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = '';

    // Word-level diff
    const origWords = original.split(/\s+/);
    const typedWords = typed.split(/\s+/).filter(w => w.length > 0);
    let correctWords = 0;

    let diffHtml = '<div class="tp-sb-diff-row"><div class="tp-sb-diff-label">Original:</div><div class="tp-sb-diff-words">';
    origWords.forEach((w, i) => {
        diffHtml += `<span class="tp-sb-diff-word">${escapeHtml(w)}</span> `;
    });
    diffHtml += '</div></div>';

    diffHtml += '<div class="tp-sb-diff-row"><div class="tp-sb-diff-label">Yours:</div><div class="tp-sb-diff-words">';
    const maxLen = Math.max(origWords.length, typedWords.length);
    for (let i = 0; i < maxLen; i++) {
        const ow = origWords[i] || '';
        const tw = typedWords[i] || '';
        const match = ow.toLowerCase() === tw.toLowerCase();
        if (match) correctWords++;
        const cls = tw ? (match ? 'tp-sb-match' : 'tp-sb-mismatch') : 'tp-sb-missing';
        diffHtml += `<span class="tp-sb-diff-word ${cls}">${escapeHtml(tw || '\u2022\u2022\u2022')}</span> `;
    }
    diffHtml += '</div></div>';

    const pct = origWords.length > 0 ? Math.round((correctWords / origWords.length) * 100) : 0;
    diffHtml += `<div class="tp-sb-diff-score">${pct}% match (${correctWords}/${origWords.length} words)</div>`;

    if (comparison) {
        comparison.innerHTML = diffHtml;
        comparison.style.display = '';
    }

    typingState.sentenceResults.push({
        original,
        typed,
        correctWords,
        totalWords: origWords.length,
        accuracy: pct
    });
}

function nextSentence() {
    typingState.sentenceIndex++;
    showSentenceRead();
}

function finishSentenceBuilder() {
    typingState.isRunning = false;
    const stopBtn = document.getElementById('tp-sb-stop');
    if (stopBtn) stopBtn.style.display = 'none';
    const totalWords = typingState.sentenceResults.reduce((s, r) => s + r.totalWords, 0);
    const correctWords = typingState.sentenceResults.reduce((s, r) => s + r.correctWords, 0);
    const elapsedSec = typingState.startTime ? (Date.now() - typingState.startTime) / 1000 : 0;
    const totalChars = typingState.sentenceResults.reduce((s, r) => s + r.typed.length, 0);
    const wpm = elapsedSec > 0 ? Math.round((totalChars / 5) / (elapsedSec / 60)) : 0;
    const acc = totalWords > 0 ? Math.round((correctWords / totalWords) * 100) : 0;
    const rating = getSessionRating(wpm, acc);

    showResults({
        mode: 'sentence',
        wpm, accuracy: acc,
        correct: correctWords,
        incorrect: totalWords - correctWords,
        total: totalWords,
        duration: Math.round(elapsedSec),
        rating,
        title: 'Sentence Builder',
        sentenceResults: typingState.sentenceResults
    });
}

// =====================================================================
//   RESULTS CARD
// =====================================================================
function getSessionRating(wpm, acc) {
    if (wpm > 40 && acc > 95) return { label: 'LEGENDARY!', emoji: '\u2728', color: '#FBBF24' };
    if (wpm > 30 && acc > 90) return { label: 'Amazing!', emoji: '\uD83C\uDF1F', color: '#A78BFA' };
    if (wpm > 20 && acc > 80) return { label: 'Great job!', emoji: '\uD83D\uDCAA', color: 'var(--deft-success)' };
    if (wpm > 10 && acc > 70) return { label: 'Keep going!', emoji: '\uD83D\uDE80', color: 'var(--deft-accent)' };
    return { label: 'Good practice!', emoji: '\u2764\uFE0F', color: 'var(--deft-txt-2)' };
}

function showResults(data) {
    const area = document.getElementById('tp-game-area');
    if (!area) return;

    const modeLabels = { paragraph: 'Paragraph Copy', wordflash: 'Word Flash', sentence: 'Sentence Builder' };

    let detailsHtml = '';

    if (data.wordResults) {
        detailsHtml = '<div class="tp-results-detail"><div class="tp-results-detail-title">Word Results</div><div class="tp-results-words-grid">';
        data.wordResults.forEach(r => {
            const cls = r.correct ? 'tp-rw-correct' : 'tp-rw-incorrect';
            const label = r.timedOut ? '(timed out)' : (r.correct ? '' : r.typed || '(empty)');
            detailsHtml += `<div class="tp-rw ${cls}">
                <span class="tp-rw-word">${escapeHtml(r.word)}</span>
                ${label && !r.correct ? `<span class="tp-rw-typed">${escapeHtml(label)}</span>` : ''}
            </div>`;
        });
        detailsHtml += '</div></div>';
    }

    if (data.sentenceResults) {
        detailsHtml = '<div class="tp-results-detail"><div class="tp-results-detail-title">Sentence Scores</div>';
        data.sentenceResults.forEach((r, i) => {
            const pctColor = r.accuracy >= 80 ? 'var(--deft-success)' : (r.accuracy >= 50 ? 'var(--deft-warning, #FBBF24)' : 'var(--deft-danger)');
            detailsHtml += `<div class="tp-sr-row">
                <span class="tp-sr-num">#${i + 1}</span>
                <span class="tp-sr-pct" style="color:${pctColor}">${r.accuracy}%</span>
                <span class="tp-sr-words">${r.correctWords}/${r.totalWords} words</span>
            </div>`;
        });
        detailsHtml += '</div>';
    }

    area.innerHTML = `
        <div class="tp-results-card">
            <div class="tp-results-rating" style="color:${data.rating.color}">
                <span class="tp-results-emoji">${data.rating.emoji}</span>
                ${data.rating.label}
            </div>
            <div class="tp-results-mode">${modeLabels[data.mode] || data.mode} - ${escapeHtml(data.title)}</div>
            <div class="tp-results-grid">
                <div class="tp-results-metric">
                    <div class="tp-results-metric-val">${data.wpm}</div>
                    <div class="tp-results-metric-lbl">WPM</div>
                </div>
                <div class="tp-results-metric">
                    <div class="tp-results-metric-val">${data.accuracy}%</div>
                    <div class="tp-results-metric-lbl">Accuracy</div>
                </div>
                <div class="tp-results-metric">
                    <div class="tp-results-metric-val">${data.correct}<span class="tp-results-denom">/${data.total}</span></div>
                    <div class="tp-results-metric-lbl">Correct</div>
                </div>
                <div class="tp-results-metric">
                    <div class="tp-results-metric-val">${formatDuration(data.duration)}</div>
                    <div class="tp-results-metric-lbl">Time</div>
                </div>
            </div>
            ${detailsHtml}
            <div class="tp-para-actions" style="margin-top: 1.25rem;">
                <button class="tp-btn tp-btn-primary" onclick="renderGameArea()">Play Again</button>
            </div>
        </div>
    `;

    saveTypingSession(data);
}

function formatDuration(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// ─── Save Session ────────────────────────────────────────────────────
async function saveTypingSession(data) {
    if (!activeProfileId) return;

    const modeMap = { paragraph: 'paragraph', wordflash: 'word_flash', sentence: 'sentence' };
    const body = {
        student_id: activeProfileId,
        game_mode: modeMap[data.mode] || data.mode,
        difficulty: typingState.difficulty,
        wpm: data.wpm || 0,
        accuracy: data.accuracy || 0,
        total_characters: data.total || 0,
        correct_characters: data.correct || 0,
        incorrect_characters: data.incorrect || 0,
        duration_secs: data.duration || 0,
        passage_title: data.title || null,
        metadata: {}
    };

    if (data.wordResults) {
        body.metadata.word_results = data.wordResults.map(r => ({
            word: r.word, typed: r.typed, correct: r.correct, timed_out: r.timedOut
        }));
    }
    if (data.sentenceResults) {
        body.metadata.sentence_results = data.sentenceResults.map(r => ({
            accuracy: r.accuracy, correct: r.correctWords, total: r.totalWords
        }));
    }

    const result = await supabaseWrite('school_typing_sessions', 'POST', body);
    if (result) {
        toast('Session saved!', 'success');
        // Mark today's typing as done so the Today tab shows the green check.
        try {
            const today = new Date();
            const todayKey = today.getFullYear() + '-' +
                String(today.getMonth() + 1).padStart(2, '0') + '-' +
                String(today.getDate()).padStart(2, '0');
            localStorage.setItem('school-typing-done-' + activeProfileId + '-' + todayKey, '1');
        } catch (e) { /* ignore localStorage errors */ }
        await loadTypingStats();
        renderStatsBar();
        renderHistory();
    } else {
        // Surface the silent failure path that masked UBR-0121/0122 — every
        // failed save now logs a console error (captured by the bug-report
        // console hook) so the next bug report includes the actual cause.
        console.error('saveTypingSession failed for body', body);
        toast('Could not save session — open a bug report if this keeps happening', 'error');
    }
}

// ─── History Panel ───────────────────────────────────────────────────
function renderHistory() {
    const el = document.getElementById('tp-history-content');
    if (!el) return;

    const rows = (typingState.sessions || []).slice(0, 20);
    if (!rows.length) {
        el.innerHTML = '<div class="tp-history-empty">No sessions yet. Start typing to build your history!</div>';
        return;
    }

    const modeLabels = { paragraph: 'Paragraph', word_flash: 'Word Flash', sentence: 'Sentence' };

    let html = '<table class="tp-history-table"><thead><tr>';
    html += '<th>Date</th><th>Mode</th><th>Difficulty</th><th>WPM</th><th>Accuracy</th><th>Time</th>';
    html += '</tr></thead><tbody>';

    rows.forEach(r => {
        const date = r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        const time = r.created_at ? new Date(r.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
        const accColor = (r.accuracy || 0) >= 80 ? 'var(--deft-success)' : ((r.accuracy || 0) >= 50 ? 'var(--deft-warning, #FBBF24)' : 'var(--deft-danger)');
        html += `<tr>
            <td><span class="tp-hist-date">${date}</span><span class="tp-hist-time">${time}</span></td>
            <td>${modeLabels[r.game_mode] || r.game_mode}</td>
            <td><span class="tp-hist-diff tp-diff-${r.difficulty || 'medium'}">${(r.difficulty || 'medium')}</span></td>
            <td class="tp-hist-wpm">${r.wpm || 0}</td>
            <td style="color:${accColor}">${r.accuracy || 0}%</td>
            <td>${formatDuration(r.duration_secs || 0)}</td>
        </tr>`;
    });

    html += '</tbody></table>';
    el.innerHTML = html;
}

// ─── Utilities ───────────────────────────────────────────────────────
function stopAllTimers() {
    if (typingState.timerId) { clearInterval(typingState.timerId); typingState.timerId = null; }
    if (typingState.wordTimer) { clearInterval(typingState.wordTimer); typingState.wordTimer = null; }
    if (typingState.wordBarTimer) { clearInterval(typingState.wordBarTimer); typingState.wordBarTimer = null; }
}

// ─── CSS Injection ───────────────────────────────────────────────────
function injectTypingStyles() {
    if (document.getElementById('tp-styles')) return;
    const style = document.createElement('style');
    style.id = 'tp-styles';
    style.textContent = `
/* ═══════════════════════════════════════
   Typing Practice Styles
   ═══════════════════════════════════════ */

.tp-wrapper {
    max-width: 820px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

/* ── Stats Bar ── */
.tp-stats-bar {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.5rem;
}

.tp-stat-chip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.75rem;
    border-radius: 0.625rem;
    background: var(--deft-surface-el);
    border: 1px solid var(--deft-border);
}

.tp-stat-val {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--deft-txt);
    line-height: 1;
}

.tp-stat-lbl {
    font-size: 0.65rem;
    color: var(--deft-txt-3, #525E73);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-left: auto;
}

/* ── Mode Tabs ── */
.tp-mode-bar {
    display: flex;
    gap: 0.375rem;
    padding: 0.25rem;
    border-radius: 0.625rem;
    background: var(--deft-surface-el);
    border: 1px solid var(--deft-border);
}

.tp-mode-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    border: none;
    border-radius: 0.5rem;
    background: transparent;
    color: var(--deft-txt-2);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
}

.tp-mode-btn:hover {
    background: rgba(255,255,255,0.04);
    color: var(--deft-txt);
}

.tp-mode-btn.active {
    background: var(--deft-accent);
    color: #0D0F14;
}

/* ── Controls Row ── */
.tp-controls-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
}

.tp-pill-group {
    display: flex;
    gap: 0.25rem;
    padding: 0.1875rem;
    border-radius: 0.5rem;
    background: var(--deft-surface-el);
    border: 1px solid var(--deft-border);
}

.tp-pill {
    padding: 0.3rem 0.75rem;
    border: none;
    border-radius: 0.375rem;
    background: transparent;
    color: var(--deft-txt-2);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s ease;
}

.tp-pill:hover { background: rgba(255,255,255,0.04); color: var(--deft-txt); }

.tp-pill.active {
    background: var(--deft-accent);
    color: #0D0F14;
}

/* ── Game Area ── */
.tp-game-area {
    min-height: 300px;
}

/* ── Action Buttons ── */
.tp-btn {
    padding: 0.5rem 1.25rem;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.12s ease;
}

.tp-btn-primary {
    background: var(--deft-accent);
    color: #0D0F14;
}
.tp-btn-primary:hover { filter: brightness(1.1); transform: translateY(-1px); }

.tp-btn-secondary {
    background: var(--deft-surface-el);
    color: var(--deft-txt-2);
    border: 1px solid var(--deft-border);
}
.tp-btn-secondary:hover { background: rgba(255,255,255,0.06); color: var(--deft-txt); }

.tp-para-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    justify-content: center;
    margin-top: 0.75rem;
}

/* ═══════════════════════════════════════
   PARAGRAPH MODE
   ═══════════════════════════════════════ */
.tp-paragraph-wrapper {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.tp-para-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.tp-para-title {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--deft-txt);
}

.tp-para-live-stats {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
}

#tp-live-wpm { color: var(--deft-accent); }
#tp-live-acc { color: var(--deft-success); }
.tp-live-sep { color: var(--deft-txt-3, #525E73); }

/* Timer Ring */
.tp-timer-ring-row {
    display: flex;
    justify-content: center;
}

.tp-timer-ring-container {
    position: relative;
    width: 80px;
    height: 80px;
}

.tp-timer-ring {
    width: 80px;
    height: 80px;
    transform: rotate(-90deg);
}

.tp-ring-bg {
    fill: none;
    stroke: var(--deft-border);
    stroke-width: 4;
}

.tp-ring-fg {
    fill: none;
    stroke: var(--deft-accent);
    stroke-width: 4;
    stroke-linecap: round;
    transition: stroke-dashoffset 0.1s linear;
}

.tp-ring-label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--deft-txt);
    font-family: 'JetBrains Mono', monospace;
}

/* Source Text Display */
.tp-source-display {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.25rem;
    line-height: 2;
    padding: 1rem 1.25rem;
    border-radius: 0.75rem;
    background: var(--deft-surface-el);
    border: 1px solid var(--deft-border);
    word-wrap: break-word;
    user-select: none;
    cursor: text;
    min-height: 100px;
}

.tp-char {
    color: var(--deft-txt-3, #525E73);
    transition: color 0.08s ease;
    position: relative;
}

.tp-char.correct {
    color: var(--deft-success);
}

.tp-char.incorrect {
    color: var(--deft-danger);
    text-decoration: underline;
    text-decoration-color: var(--deft-danger);
}

.tp-char.current {
    border-bottom: 2px solid var(--deft-accent);
    animation: tp-cursor-pulse 1s ease-in-out infinite;
}

@keyframes tp-cursor-pulse {
    0%, 100% { border-bottom-color: var(--deft-accent); }
    50% { border-bottom-color: transparent; }
}

/* Hidden Input */
.tp-hidden-input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
    overflow: hidden;
}

/* ═══════════════════════════════════════
   WORD FLASH MODE
   ═══════════════════════════════════════ */
.tp-wordflash-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
}

.tp-wf-progress {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--deft-txt-3, #525E73);
    text-transform: uppercase;
    letter-spacing: 0.06em;
}

.tp-wf-display {
    width: 100%;
    padding: 2.5rem 1rem 1rem;
    border-radius: 0.75rem;
    background: var(--deft-surface-el);
    border: 1px solid var(--deft-border);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    transition: background 0.3s ease, border-color 0.3s ease;
}

.tp-wf-display.tp-flash-correct {
    background: rgba(107, 203, 119, 0.1);
    border-color: var(--deft-success);
}

.tp-wf-display.tp-flash-incorrect {
    background: rgba(232, 93, 93, 0.1);
    border-color: var(--deft-danger);
}

.tp-wf-word {
    font-family: 'JetBrains Mono', monospace;
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--deft-txt);
    letter-spacing: 0.04em;
    min-height: 3.5rem;
    display: flex;
    align-items: center;
}

.tp-wf-timer-bar-track {
    width: 80%;
    height: 6px;
    border-radius: 3px;
    background: var(--deft-border);
    overflow: hidden;
}

.tp-wf-timer-bar {
    height: 100%;
    border-radius: 3px;
    background: var(--deft-accent);
    width: 100%;
}

.tp-wf-input {
    width: 100%;
    max-width: 400px;
    padding: 0.625rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid var(--deft-border);
    background: var(--deft-surface-el);
    color: var(--deft-txt);
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.25rem;
    text-align: center;
    outline: none;
    transition: border-color 0.15s ease;
}

.tp-wf-input:focus { border-color: var(--deft-accent); }
.tp-wf-input:disabled { opacity: 0.5; cursor: default; }

/* ═══════════════════════════════════════
   SENTENCE BUILDER MODE
   ═══════════════════════════════════════ */
.tp-sentence-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
}

.tp-sb-progress {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--deft-txt-3, #525E73);
    text-transform: uppercase;
    letter-spacing: 0.06em;
}

.tp-sb-display {
    width: 100%;
    padding: 1.5rem 1.25rem;
    border-radius: 0.75rem;
    background: var(--deft-surface-el);
    border: 1px solid var(--deft-border);
    text-align: center;
    min-height: 120px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.75rem;
}

.tp-sb-instruction {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--deft-accent);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.tp-sb-sentence {
    font-family: 'JetBrains Mono', monospace;
    font-size: 1.15rem;
    line-height: 1.7;
    color: var(--deft-txt);
    min-height: 2em;
}

.tp-sb-input {
    width: 100%;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid var(--deft-border);
    background: var(--deft-surface-el);
    color: var(--deft-txt);
    font-family: 'JetBrains Mono', monospace;
    font-size: 1rem;
    line-height: 1.5;
    outline: none;
    resize: none;
    transition: border-color 0.15s ease;
}

.tp-sb-input:focus { border-color: var(--deft-accent); }
.tp-sb-input:disabled { opacity: 0.5; }

/* Comparison */
.tp-sb-comparison {
    width: 100%;
    padding: 1rem;
    border-radius: 0.625rem;
    background: var(--deft-surface-el);
    border: 1px solid var(--deft-border);
}

.tp-sb-diff-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    align-items: flex-start;
}

.tp-sb-diff-label {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--deft-txt-3, #525E73);
    text-transform: uppercase;
    width: 60px;
    flex-shrink: 0;
    padding-top: 0.2rem;
}

.tp-sb-diff-words {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
}

.tp-sb-diff-word {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
    padding: 0.125rem 0.25rem;
    border-radius: 0.2rem;
    color: var(--deft-txt);
}

.tp-sb-match {
    background: rgba(107, 203, 119, 0.15);
    color: var(--deft-success);
}

.tp-sb-mismatch {
    background: rgba(232, 93, 93, 0.15);
    color: var(--deft-danger);
    text-decoration: line-through;
}

.tp-sb-missing {
    background: rgba(255,255,255,0.04);
    color: var(--deft-txt-3, #525E73);
    font-style: italic;
}

.tp-sb-diff-score {
    margin-top: 0.5rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--deft-txt-2);
    text-align: center;
}

/* ═══════════════════════════════════════
   RESULTS CARD
   ═══════════════════════════════════════ */
.tp-results-card {
    padding: 2rem 1.5rem;
    border-radius: 0.75rem;
    background: var(--deft-surface-el);
    border: 1px solid var(--deft-border);
    text-align: center;
}

.tp-results-rating {
    font-size: 1.75rem;
    font-weight: 800;
    margin-bottom: 0.25rem;
}

.tp-results-emoji {
    margin-right: 0.375rem;
}

.tp-results-mode {
    font-size: 0.8rem;
    color: var(--deft-txt-3, #525E73);
    margin-bottom: 1.25rem;
}

.tp-results-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
    margin-bottom: 0.5rem;
}

.tp-results-metric {
    padding: 0.75rem 0.5rem;
    border-radius: 0.5rem;
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--deft-border);
}

.tp-results-metric-val {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--deft-txt);
    font-family: 'JetBrains Mono', monospace;
}

.tp-results-denom {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--deft-txt-3, #525E73);
}

.tp-results-metric-lbl {
    font-size: 0.65rem;
    color: var(--deft-txt-3, #525E73);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-top: 0.25rem;
}

/* Word Flash Results Detail */
.tp-results-detail {
    margin-top: 1rem;
    text-align: left;
}

.tp-results-detail-title {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--deft-txt-2);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 0.5rem;
}

.tp-results-words-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 0.375rem;
}

.tp-rw {
    display: flex;
    flex-direction: column;
    padding: 0.375rem 0.5rem;
    border-radius: 0.375rem;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
}

.tp-rw-correct { background: rgba(107, 203, 119, 0.1); }
.tp-rw-incorrect { background: rgba(232, 93, 93, 0.1); }

.tp-rw-word {
    font-weight: 600;
    color: var(--deft-txt);
}

.tp-rw-typed {
    font-size: 0.65rem;
    color: var(--deft-danger);
    opacity: 0.8;
}

/* Sentence Results */
.tp-sr-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.375rem 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
}

.tp-sr-num {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--deft-txt-3, #525E73);
    width: 2rem;
}

.tp-sr-pct {
    font-size: 0.85rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    width: 3rem;
}

.tp-sr-words {
    font-size: 0.75rem;
    color: var(--deft-txt-2);
}

/* ═══════════════════════════════════════
   HISTORY PANEL
   ═══════════════════════════════════════ */
.tp-history-panel {
    border-radius: 0.625rem;
    background: var(--deft-surface-el);
    border: 1px solid var(--deft-border);
    overflow: hidden;
}

.tp-history-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--deft-txt-2);
    cursor: pointer;
    user-select: none;
    list-style: none;
}

.tp-history-toggle::-webkit-details-marker { display: none; }

.tp-chevron {
    margin-left: auto;
    transition: transform 0.2s ease;
}

.tp-history-panel[open] .tp-chevron {
    transform: rotate(180deg);
}

.tp-history-content {
    padding: 0 0.75rem 0.75rem;
}

.tp-history-empty {
    padding: 1.5rem;
    text-align: center;
    font-size: 0.8rem;
    color: var(--deft-txt-3, #525E73);
}

.tp-history-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.75rem;
}

.tp-history-table th {
    text-align: left;
    padding: 0.5rem 0.625rem;
    font-size: 0.65rem;
    font-weight: 700;
    color: var(--deft-txt-3, #525E73);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 1px solid var(--deft-border);
}

.tp-history-table td {
    padding: 0.5rem 0.625rem;
    color: var(--deft-txt-2);
    border-bottom: 1px solid rgba(255,255,255,0.03);
}

.tp-hist-date {
    display: block;
    font-weight: 600;
    color: var(--deft-txt);
    font-size: 0.75rem;
}

.tp-hist-time {
    display: block;
    font-size: 0.65rem;
    color: var(--deft-txt-3, #525E73);
}

.tp-hist-wpm {
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    color: var(--deft-accent);
}

.tp-hist-diff {
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: capitalize;
}

.tp-diff-easy { background: rgba(107,203,119,0.12); color: var(--deft-success); }
.tp-diff-medium { background: rgba(251,191,36,0.12); color: #FBBF24; }
.tp-diff-hard { background: rgba(232,93,93,0.12); color: var(--deft-danger); }

/* ── Responsive ── */
@media (max-width: 640px) {
    .tp-stats-bar { grid-template-columns: repeat(2, 1fr); }
    .tp-results-grid { grid-template-columns: repeat(2, 1fr); }
    .tp-wf-word { font-size: 1.75rem; }
    .tp-source-display { font-size: 1rem; line-height: 1.8; padding: 0.75rem; }
    .tp-mode-btn { font-size: 0.7rem; padding: 0.4rem 0.5rem; }
    .tp-mode-btn svg { display: none; }
    .tp-results-metric-val { font-size: 1.15rem; }
    .tp-controls-row { gap: 0.5rem; }
    .tp-sb-diff-row { flex-direction: column; }
    .tp-sb-diff-label { width: auto; }
    .tp-history-table { font-size: 0.65rem; }
    .tp-history-table th,
    .tp-history-table td { padding: 0.375rem 0.375rem; }
}
    `;
    document.head.appendChild(style);
}
