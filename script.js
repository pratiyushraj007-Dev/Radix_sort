/* ========================================
   RADIX SORT VISUALIZER — ENGINE
   ======================================== */

// ============ BACKGROUND PARTICLES ============
(function initBackground() {
    const canvas = document.getElementById('bg-canvas');
    const ctx = canvas.getContext('2d');
    let particles = [];
    let w, h;

    function resize() {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    class Particle {
        constructor() {
            this.reset();
        }
        reset() {
            this.x = Math.random() * w;
            this.y = Math.random() * h;
            this.size = Math.random() * 2 + 0.5;
            this.speedX = (Math.random() - 0.5) * 0.3;
            this.speedY = (Math.random() - 0.5) * 0.3;
            this.opacity = Math.random() * 0.4 + 0.1;
            this.hue = Math.random() > 0.5 ? 260 : 200; // purple or blue
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            if (this.x < 0 || this.x > w || this.y < 0 || this.y > h) this.reset();
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${this.hue}, 80%, 70%, ${this.opacity})`;
            ctx.fill();
        }
    }

    for (let i = 0; i < 80; i++) particles.push(new Particle());

    function animate() {
        ctx.clearRect(0, 0, w, h);
        particles.forEach(p => { p.update(); p.draw(); });

        // Connect nearby particles
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 150) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(167, 139, 250, ${0.06 * (1 - dist / 150)})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
        requestAnimationFrame(animate);
    }
    animate();
})();

// ============ STATE ============
const state = {
    algorithm: 'lsd',       // 'lsd' | 'msd' | 'both'
    arraySize: 8,
    maxDigits: 3,
    speed: 3,
    originalArray: [],
    isPlaying: false,
    isPaused: false,
    // For single mode
    singleEngine: null,
    // For dual mode
    lsdEngine: null,
    msdEngine: null,
};

const speedMap = { 1: 1200, 2: 800, 3: 500, 4: 300, 5: 100 };
const speedLabels = { 1: 'Very Slow', 2: 'Slow', 3: 'Medium', 4: 'Fast', 5: 'Very Fast' };

// ============ UTILITY FUNCTIONS ============
function generateArray(size, maxDigits) {
    const max = Math.pow(10, maxDigits) - 1;
    const min = Math.pow(10, maxDigits - 1);
    const arr = [];
    for (let i = 0; i < size; i++) {
        arr.push(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    return arr;
}

function getDigit(num, pos) {
    return Math.floor(Math.abs(num) / Math.pow(10, pos)) % 10;
}

function getMaxDigitCount(arr) {
    let max = 0;
    for (const n of arr) {
        const count = n === 0 ? 1 : Math.floor(Math.log10(Math.abs(n))) + 1;
        if (count > max) max = count;
    }
    return max;
}

function padNumber(num, digits) {
    return String(num).padStart(digits, '0');
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ RADIX SORT ENGINE ============
class RadixSortEngine {
    constructor(type, array, elements) {
        this.type = type; // 'lsd' or 'msd'
        this.array = [...array];
        this.maxDigitCount = getMaxDigitCount(array);
        this.steps = [];
        this.currentStep = 0;
        this.elements = elements; // DOM element references
        this.cancelled = false;

        // Generate all steps
        if (type === 'lsd') {
            this._generateLSDSteps();
        } else {
            this._generateMSDSteps();
        }
    }

    _generateLSDSteps() {
        let arr = [...this.array];
        const maxD = this.maxDigitCount;

        for (let digitPos = 0; digitPos < maxD; digitPos++) {
            this.steps.push({
                action: 'start-pass',
                digitPos,
                array: [...arr],
                description: `Starting pass for digit position ${digitPos} (${['ones', 'tens', 'hundreds', 'thousands'][digitPos] || `10^${digitPos}`})`
            });

            // Create buckets
            const buckets = Array.from({ length: 10 }, () => []);

            for (let i = 0; i < arr.length; i++) {
                const digit = getDigit(arr[i], digitPos);
                buckets[digit].push(arr[i]);

                this.steps.push({
                    action: 'distribute',
                    digitPos,
                    index: i,
                    value: arr[i],
                    digit,
                    buckets: buckets.map(b => [...b]),
                    array: [...arr],
                    description: `${padNumber(arr[i], maxD)}: digit at position ${digitPos} is ${digit} → Bucket ${digit}`
                });
            }

            // Collect from buckets
            arr = [];
            for (let b = 0; b < 10; b++) {
                for (const val of buckets[b]) {
                    arr.push(val);
                }
            }

            this.steps.push({
                action: 'collect',
                digitPos,
                array: [...arr],
                buckets: buckets.map(b => [...b]),
                description: `Collected from buckets. Array after processing digit position ${digitPos}`
            });
        }

        this.steps.push({
            action: 'done',
            array: [...arr],
            description: '✅ Sorting complete! Array is now sorted.'
        });
    }

    _generateMSDSteps() {
        let arr = [...this.array];
        const maxD = this.maxDigitCount;

        const msdSort = (subArr, digitPos, depth) => {
            if (subArr.length <= 1 || digitPos < 0) return subArr;

            this.steps.push({
                action: 'start-pass',
                digitPos,
                array: [...subArr],
                depth,
                description: `MSD pass: sorting ${subArr.length} elements by digit position ${digitPos} (${['ones', 'tens', 'hundreds', 'thousands'][digitPos] || `10^${digitPos}`})${depth > 0 ? ` [recursion depth ${depth}]` : ''}`
            });

            const buckets = Array.from({ length: 10 }, () => []);

            for (let i = 0; i < subArr.length; i++) {
                const digit = getDigit(subArr[i], digitPos);
                buckets[digit].push(subArr[i]);

                this.steps.push({
                    action: 'distribute',
                    digitPos,
                    index: i,
                    value: subArr[i],
                    digit,
                    buckets: buckets.map(b => [...b]),
                    array: [...subArr],
                    depth,
                    description: `${padNumber(subArr[i], maxD)}: digit at position ${digitPos} is ${digit} → Bucket ${digit}`
                });
            }

            this.steps.push({
                action: 'buckets-filled',
                digitPos,
                buckets: buckets.map(b => [...b]),
                depth,
                description: `All elements distributed. Recursing into non-empty buckets...`
            });

            // Recursively sort each bucket
            let result = [];
            for (let b = 0; b < 10; b++) {
                if (buckets[b].length > 1 && digitPos > 0) {
                    const sorted = msdSort(buckets[b], digitPos - 1, depth + 1);
                    result = result.concat(sorted);
                } else {
                    result = result.concat(buckets[b]);
                }
            }

            this.steps.push({
                action: 'collect',
                digitPos,
                array: [...result],
                depth,
                description: `Collected from buckets at digit position ${digitPos}${depth > 0 ? ` [depth ${depth}]` : ''}`
            });

            return result;
        };

        arr = msdSort(arr, maxD - 1, 0);

        this.steps.push({
            action: 'done',
            array: [...arr],
            description: '✅ Sorting complete! Array is now sorted.'
        });
    }

    cancel() {
        this.cancelled = true;
    }

    getStep(index) {
        return this.steps[index] || null;
    }

    get totalSteps() {
        return this.steps.length;
    }
}


// ============ RENDERER ============
class Renderer {
    constructor(prefix, isMSD = false) {
        this.prefix = prefix;
        this.isMSD = isMSD;
        this.arrayEl = document.getElementById(`${prefix}-array`);
        this.bucketsEl = document.getElementById(`${prefix}-buckets`);
        this.digitIndicatorEl = document.getElementById(`${prefix}-digit-indicator`);
        this.stepDescEl = document.getElementById(`${prefix}-step-desc`);
        this.statusEl = document.getElementById(`${prefix}-status`);
    }

    getArrayHTML(array, digitPos = -1, highlightIndex = -1, maxDigits = 3, sorted = false) {
        const maxVal = Math.max(...array);
        return array.map((val, i) => {
            const height = Math.max(20, (val / maxVal) * 130);
            const padded = padNumber(val, maxDigits);
            let valueHTML = '';

            if (digitPos >= 0 && i === highlightIndex) {
                const chars = padded.split('');
                const highlightPos = padded.length - 1 - digitPos;
                valueHTML = chars.map((c, ci) =>
                    ci === highlightPos
                        ? `<span class="digit-highlight">${c}</span>`
                        : c
                ).join('');
            } else if (digitPos >= 0) {
                const chars = padded.split('');
                const highlightPos = padded.length - 1 - digitPos;
                valueHTML = chars.map((c, ci) =>
                    ci === highlightPos
                        ? `<span class="digit-highlight" style="opacity:0.5">${c}</span>`
                        : c
                ).join('');
            } else {
                valueHTML = padded;
            }

            const classes = ['num-bar'];
            if (i === highlightIndex) classes.push('highlight', 'comparing');
            if (sorted) classes.push('sorted');

            return `
                <div class="${classes.join(' ')}" style="order: ${i}">
                    <div class="num-bar-value">${valueHTML}</div>
                    <div class="num-bar-visual" style="height: ${height}px"></div>
                </div>
            `;
        }).join('');
    }

    renderArray(array, digitPos = -1, highlightIndex = -1, maxDigits = 3, sorted = false) {
        if (!this.arrayEl) return;
        this.arrayEl.innerHTML = this.getArrayHTML(array, digitPos, highlightIndex, maxDigits, sorted);
    }

    getBucketsHTML(buckets, activeBucket = -1, maxDigits = 3) {
        return Array.from({ length: 10 }, (_, i) => {
            const items = buckets && buckets[i] ? buckets[i] : [];
            const isActive = i === activeBucket;
            return `
                <div class="bucket ${isActive ? 'active' : ''}">
                    <div class="bucket-label">${i}</div>
                    <div class="bucket-items">
                        ${items.map(v => `<div class="bucket-item">${padNumber(v, maxDigits)}</div>`).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderBuckets(buckets, activeBucket = -1, maxDigits = 3) {
        if (!this.bucketsEl) return;
        this.bucketsEl.innerHTML = this.getBucketsHTML(buckets, activeBucket, maxDigits);
    }

    renderDigitIndicator(maxDigits, currentDigitPos, processedPositions = []) {
        if (!this.digitIndicatorEl) return;
        const labels = ['ones', 'tens', 'hund', 'thou'];
        let html = `<span class="digit-label">${this.isMSD ? 'MSD → LSD:' : 'LSD → MSD:'}</span>`;

        const positions = this.isMSD
            ? Array.from({ length: maxDigits }, (_, i) => maxDigits - 1 - i)
            : Array.from({ length: maxDigits }, (_, i) => i);

        positions.forEach(pos => {
            let cls = 'digit-pos';
            if (pos === currentDigitPos) cls += ' active';
            else if (processedPositions.includes(pos)) cls += ' done';
            html += `<div class="${cls}">${labels[pos] || `10^${pos}`}</div>`;
        });

        this.digitIndicatorEl.innerHTML = html;
    }

    setStepDescription(text) {
        if (this.stepDescEl) this.stepDescEl.textContent = text;
    }

    setStatus(status) {
        if (!this.statusEl) return;
        this.statusEl.textContent = status;
        this.statusEl.className = 'status-badge';
        if (status === 'Sorting...') this.statusEl.classList.add('active');
        else if (status === 'Done!') this.statusEl.classList.add('done');
    }

    clearBuckets() {
        this.renderBuckets(null);
    }
}


// ============ DOM REFERENCES ============
const DOM = {
    algoToggle: document.getElementById('algo-toggle'),
    toggleLSD: document.getElementById('toggle-lsd'),
    toggleMSD: document.getElementById('toggle-msd'),
    toggleBoth: document.getElementById('toggle-both'),
    sizeSlider: document.getElementById('size-slider'),
    sizeValue: document.getElementById('size-value'),
    speedSlider: document.getElementById('speed-slider'),
    speedValue: document.getElementById('speed-value'),
    generateBtn: document.getElementById('generate-btn'),
    playBtn: document.getElementById('play-btn'),
    stepBtn: document.getElementById('step-btn'),
    resetBtn: document.getElementById('reset-btn'),
    singlePanel: document.getElementById('single-panel'),
    dualPanel: document.getElementById('dual-panel'),
    singleTitle: document.getElementById('single-panel-title'),
    playIcon: document.querySelector('.play-icon'),
    pauseIcon: document.querySelector('.pause-icon'),
    btnText: document.querySelector('.btn-text'),
    digitBtns: document.querySelectorAll('.digit-btn'),
};


// ============ RENDERERS ============
let singleRenderer = new Renderer('single');
let lsdRenderer = new Renderer('lsd');
let msdRenderer = new Renderer('msd', true);


// ============ TOGGLE SLIDER MANAGEMENT ============
function updateToggleSlider() {
    const slider = document.querySelector('.toggle-slider');
    const activeBtn = DOM.algoToggle.querySelector('.toggle-btn.active');
    if (!slider || !activeBtn) return;
    slider.style.width = `${activeBtn.offsetWidth}px`;
    slider.style.left = `${activeBtn.offsetLeft}px`;
}

function setAlgorithm(algo) {
    state.algorithm = algo;
    DOM.algoToggle.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-algo="${algo}"]`).classList.add('active');
    updateToggleSlider();

    if (algo === 'both') {
        DOM.singlePanel.style.display = 'none';
        DOM.dualPanel.style.display = 'grid';
    } else {
        DOM.singlePanel.style.display = 'flex';
        DOM.dualPanel.style.display = 'none';
        DOM.singleTitle.textContent = algo === 'lsd' ? 'LSD Radix Sort' : 'MSD Radix Sort';
    }

    resetVisualization();
    generateAndRender();
}


// ============ INITIALIZATION ============
function generateAndRender() {
    state.originalArray = generateArray(state.arraySize, state.maxDigits);
    const maxD = getMaxDigitCount(state.originalArray);

    if (state.algorithm === 'both') {
        lsdRenderer.renderArray(state.originalArray, -1, -1, maxD);
        lsdRenderer.renderBuckets(null);
        lsdRenderer.renderDigitIndicator(maxD, -1, []);
        lsdRenderer.setStepDescription('Click Play or Step to begin');
        lsdRenderer.setStatus('Ready');

        msdRenderer.renderArray(state.originalArray, -1, -1, maxD);
        msdRenderer.renderBuckets(null);
        msdRenderer.renderDigitIndicator(maxD, -1, []);
        msdRenderer.setStepDescription('Click Play or Step to begin');
        msdRenderer.setStatus('Ready');
    } else {
        const renderer = singleRenderer;
        renderer.renderArray(state.originalArray, -1, -1, maxD);
        renderer.renderBuckets(null);
        renderer.renderDigitIndicator(maxD, -1, []);
        renderer.setStepDescription('Click Play or Step to begin');
        renderer.setStatus('Ready');
    }
}


// ============ ANIMATION CONTROLLER ============
class AnimationController {
    constructor(engine, renderer, isMSD = false) {
        this.engine = engine;
        this.renderer = renderer;
        this.isMSD = isMSD;
        this.currentStepIndex = 0;
        this.processedDigits = [];
        this.isRunning = false;
        this.cancelled = false;
    }

    cancel() {
        this.cancelled = true;
        this.isRunning = false;
        this.engine.cancel();
    }

    async playStep() {
        if (this.currentStepIndex >= this.engine.totalSteps) return false;

        const step = this.engine.getStep(this.currentStepIndex);
        if (!step) return false;

        const maxD = this.engine.maxDigitCount;

        switch (step.action) {
            case 'start-pass':
                this.renderer.setStatus('Sorting...');
                this.renderer.renderDigitIndicator(maxD, step.digitPos, this.processedDigits);
                this.renderer.renderArray(step.array, step.digitPos, -1, maxD);
                this.renderer.clearBuckets();
                this.renderer.setStepDescription(step.description);
                break;

            case 'distribute':
                this.renderer.renderArray(step.array, step.digitPos, step.index, maxD);
                this.renderer.renderBuckets(step.buckets, step.digit, maxD);
                this.renderer.setStepDescription(step.description);
                break;

            case 'buckets-filled':
                this.renderer.renderBuckets(step.buckets, -1, maxD);
                this.renderer.setStepDescription(step.description);
                break;

            case 'collect':
                if (!this.processedDigits.includes(step.digitPos)) {
                    this.processedDigits.push(step.digitPos);
                }
                this.renderer.renderDigitIndicator(maxD, step.digitPos, this.processedDigits);
                this.renderer.renderArray(step.array, -1, -1, maxD);
                this.renderer.renderBuckets(step.buckets || null, -1, maxD);
                this.renderer.setStepDescription(step.description);
                this.appendHistoryCard(step, maxD);
                break;

            case 'done':
                this.renderer.renderArray(step.array, -1, -1, maxD, true);
                this.renderer.renderDigitIndicator(maxD, -1, this.processedDigits);
                this.renderer.clearBuckets();
                this.renderer.setStepDescription(step.description);
                this.renderer.setStatus('Done!');
                this.appendHistoryCard(step, maxD);
                break;
        }

        this.currentStepIndex++;
        return this.currentStepIndex < this.engine.totalSteps;
    }

    appendHistoryCard(step, maxDigits) {
        const feedContainer = document.getElementById('history-feed-container');
        const feed = document.getElementById('history-feed');
        if (!feedContainer || !feed) return;
        
        feedContainer.style.display = 'block';
        
        const card = document.createElement('div');
        card.className = 'history-card';
        
        const algoName = this.isMSD ? 'MSD Radix Sort' : 'LSD Radix Sort';
        const title = step.action === 'done' ? `${algoName} - Final Sorted Array` : `${algoName} - End of Digit Pass ${step.digitPos}`;
        
        // Use the new Renderer methods to easily generate markup
        const arrayHTML = this.renderer.getArrayHTML(step.array, -1, -1, maxDigits, step.action === 'done');
        let bucketsHTML = '';
        if (step.buckets && step.action !== 'done') {
            bucketsHTML = `
                <h4 class="sub-panel-title" style="margin-top: 16px;">Buckets Output</h4>
                <div class="buckets-container">${this.renderer.getBucketsHTML(step.buckets, -1, maxDigits)}</div>
            `;
        }

        card.innerHTML = `
            <div class="history-card-header">
                <h4>${title}</h4>
                <span class="history-card-desc">${step.description}</span>
            </div>
            <div class="array-display">${arrayHTML}</div>
            ${bucketsHTML}
        `;
        
        feed.appendChild(card);
    }

    async playAll() {
        this.isRunning = true;
        while (this.currentStepIndex < this.engine.totalSteps && !this.cancelled) {
            if (!state.isPlaying) {
                // Paused
                this.isRunning = false;
                return;
            }
            await this.playStep();
            if (!this.cancelled) {
                await sleep(speedMap[state.speed]);
            }
        }
        this.isRunning = false;
        if (!this.cancelled) {
            updatePlayButton(false);
        }
    }

    get isDone() {
        return this.currentStepIndex >= this.engine.totalSteps;
    }
}


// ============ ANIMATION STATE ============
let singleController = null;
let lsdController = null;
let msdController = null;


function resetVisualization() {
    state.isPlaying = false;
    state.isPaused = false;

    if (singleController) singleController.cancel();
    if (lsdController) lsdController.cancel();
    if (msdController) msdController.cancel();

    singleController = null;
    lsdController = null;
    msdController = null;

    updatePlayButton(false);
    
    // Clear history feed
    const feedContainer = document.getElementById('history-feed-container');
    const feed = document.getElementById('history-feed');
    if (feedContainer && feed) {
        feedContainer.style.display = 'none';
        feed.innerHTML = '';
    }
}


function ensureEnginesCreated() {
    const maxD = getMaxDigitCount(state.originalArray);

    if (state.algorithm === 'both') {
        if (!lsdController) {
            const lsdEngine = new RadixSortEngine('lsd', state.originalArray, null);
            lsdController = new AnimationController(lsdEngine, lsdRenderer, false);
        }
        if (!msdController) {
            const msdEngine = new RadixSortEngine('msd', state.originalArray, null);
            msdController = new AnimationController(msdEngine, msdRenderer, true);
        }
    } else {
        if (!singleController) {
            const type = state.algorithm;
            const engine = new RadixSortEngine(type, state.originalArray, null);
            const isMSD = type === 'msd';
            singleController = new AnimationController(engine, singleRenderer, isMSD);
        }
    }
}


function updatePlayButton(playing) {
    state.isPlaying = playing;
    DOM.playIcon.style.display = playing ? 'none' : 'block';
    DOM.pauseIcon.style.display = playing ? 'block' : 'none';
    DOM.btnText.textContent = playing ? 'Pause' : 'Play';
}


// ============ EVENT HANDLERS ============

// Algorithm toggle
[DOM.toggleLSD, DOM.toggleMSD, DOM.toggleBoth].forEach(btn => {
    btn.addEventListener('click', () => setAlgorithm(btn.dataset.algo));
});

// Size slider
DOM.sizeSlider.addEventListener('input', (e) => {
    state.arraySize = parseInt(e.target.value);
    DOM.sizeValue.textContent = state.arraySize;
    resetVisualization();
    generateAndRender();
});

// Speed slider
DOM.speedSlider.addEventListener('input', (e) => {
    state.speed = parseInt(e.target.value);
    DOM.speedValue.textContent = speedLabels[state.speed];
});

// Digit buttons
DOM.digitBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        DOM.digitBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.maxDigits = parseInt(btn.dataset.digits);
        resetVisualization();
        generateAndRender();
    });
});

// Generate button
DOM.generateBtn.addEventListener('click', () => {
    resetVisualization();
    generateAndRender();
});

// Play/Pause button
DOM.playBtn.addEventListener('click', async () => {
    if (state.isPlaying) {
        // Pause
        updatePlayButton(false);
        return;
    }

    ensureEnginesCreated();

    // Check if already done
    if (state.algorithm === 'both') {
        if (lsdController.isDone && msdController.isDone) {
            resetVisualization();
            generateAndRender();
            ensureEnginesCreated();
        }
    } else {
        if (singleController && singleController.isDone) {
            resetVisualization();
            generateAndRender();
            ensureEnginesCreated();
        }
    }

    updatePlayButton(true);

    if (state.algorithm === 'both') {
        // Run both in parallel
        Promise.all([
            lsdController.playAll(),
            msdController.playAll()
        ]);
    } else {
        singleController.playAll();
    }
});

// Step button
DOM.stepBtn.addEventListener('click', async () => {
    ensureEnginesCreated();

    if (state.algorithm === 'both') {
        if (lsdController.isDone && msdController.isDone) {
            resetVisualization();
            generateAndRender();
            ensureEnginesCreated();
        }
        await lsdController.playStep();
        await msdController.playStep();
    } else {
        if (singleController.isDone) {
            resetVisualization();
            generateAndRender();
            ensureEnginesCreated();
        }
        await singleController.playStep();
    }
});

// Reset button
DOM.resetBtn.addEventListener('click', () => {
    resetVisualization();
    generateAndRender();
});

// Initialize toggle slider position
window.addEventListener('load', () => {
    updateToggleSlider();
    generateAndRender();
});

window.addEventListener('resize', updateToggleSlider);

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// Intersection Observer for scroll animations
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.algo-card, .comparison-table-wrapper, .controls-panel').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});

// Initialize
generateAndRender();
