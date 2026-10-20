// --- Переключение вкладок ---
const pillBtns = document.querySelectorAll('.pill-btn');
const tabContents = document.querySelectorAll('.tab-content');

pillBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        pillBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
    });
});

// --- Звуковой сигнал при идеальной настройке (Success Sound) ---
let successAudioCtx = null;
let lastInTuneState = false;

function playSuccessChime() {
    try {
        if (!successAudioCtx) {
            successAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (successAudioCtx.state === 'suspended') {
            successAudioCtx.resume();
        }
        
        const now = successAudioCtx.currentTime;
        const osc = successAudioCtx.createOscillator();
        const gain = successAudioCtx.createGain();

        osc.type = 'sine';
        // Приятный высокий «дзынь» при попадании в ноту (аккорд мажорной терции)
        osc.frequency.setValueAtTime(523.25, now); // До (C5)
        osc.frequency.setValueAtTime(659.25, now + 0.08); // Ми (E5)

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

        osc.connect(gain);
        gain.connect(successAudioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.4);
    } catch (e) {
        console.error(e);
    }
}

// --- АНАЛОГОВЫЙ ТЮНЕР (СПИДОМЕТР) ---
const startBtn = document.getElementById('start-btn');
const noteElem = document.getElementById('note');
const freqElem = document.getElementById('frequency');
const centsBadge = document.getElementById('cents-badge');
const needle = document.getElementById('speedo-needle');
const stringHint = document.getElementById('string-hint');

let audioContext = null;
let analyser = null;
let microphone = null;

let currentAngle = 0;
let targetAngle = 0;

const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const standardStrings = {
    "E2": "6-я струна (E)",
    "A2": "5-я струна (A)",
    "D3": "4-я струна (D)",
    "G3": "3-я струна (G)",
    "B3": "2-я струна (B)",
    "E4": "1-я струна (E)"
};

startBtn.addEventListener('click', async () => {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } 
        });
        
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;

        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);

        startBtn.textContent = 'Тюнер активен';
        startBtn.style.background = '#16a34a';
        startBtn.disabled = true;

        updatePitch();
        animateNeedle();
    } catch (err) {
        alert('Ошибка доступа к микрофону: ' + err.message);
    }
});

function autoCorrelate(buf, sampleRate) {
    let SIZE = buf.length;
    let sumOfSquares = 0;
    for (let i = 0; i < SIZE; i++) {
        sumOfSquares += buf[i] * buf[i];
    }
    let rootMeanSquare = Math.sqrt(sumOfSquares / SIZE);
    if (rootMeanSquare < 0.01) return -1;

    let r1 = 0, r2 = SIZE - 1;
    let threshold = 0.2;
    for (let i = 0; i < SIZE / 2; i++) {
        if (Math.abs(buf[i]) < threshold) { r1 = i; break; }
    }
    for (let i = 1; i < SIZE / 2; i++) {
        if (Math.abs(buf[SIZE - i]) < threshold) { r2 = SIZE - i; break; }
    }

    buf = buf.slice(r1, r2);
    SIZE = buf.length;

    let c = new Array(SIZE).fill(0);
    for (let i = 0; i < SIZE; i++) {
        for (let j = 0; j < SIZE - i; j++) {
            c[i] = c[i] + buf[j] * buf[j + i];
        }
    }

    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < SIZE; i++) {
        if (c[i] > maxval) {
            maxval = c[i];
            maxpos = i;
        }
    }
    let T0 = maxpos;

    let x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    let a = (x1 + x3 - 2 * x2) / 2;
    let b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);

    return sampleRate / T0;
}

function noteFromPitch(frequency) {
    let noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    return Math.round(noteNum) + 69;
}

function frequencyFromNoteNumber(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
}

function centsOffFromPitch(frequency, note) {
    return Math.floor(1200 * Math.log(frequency / frequencyFromNoteNumber(note)) / Math.log(2));
}

function updatePitch() {
    let buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);
    let pitch = autoCorrelate(buffer, audioContext.sampleRate);

    if (pitch !== -1) {
        let note = noteFromPitch(pitch);
        let noteName = noteStrings[note % 12];
        let octave = Math.floor(note / 12) - 1;
        let cents = centsOffFromPitch(pitch, note);

        let fullNoteName = `${noteName}${octave}`;
        noteElem.textContent = fullNoteName;
        freqElem.textContent = `${pitch.toFixed(1)} Hz`;
        centsBadge.textContent = `${cents > 0 ? '+' : ''}${cents} ¢`;

        stringHint.textContent = standardStrings[fullNoteName] || "Хроматический строй";

        // Превращаем центы (-50 до +50) в градусы поворота стрелки спидометра (от -50 до +50 градусов)
        let centsClamped = Math.max(-50, Math.min(50, cents));
        targetAngle = centsClamped; 

        // Идеальная настройка (в пределах ±3 цента)
        if (Math.abs(cents) <= 3) {
            noteElem.style.color = '#2ecc71';
            centsBadge.style.borderColor = '#2ecc71';
            centsBadge.style.color = '#2ecc71';
            
            // Звуковой сигнал срабатывает один раз при переходе в идеальную зону
            if (!lastInTuneState) {
                playSuccessChime();
                lastInTuneState = true;
            }
        } else {
            noteElem.style.color = '#ffffff';
            centsBadge.style.borderColor = '#2c384d';
            centsBadge.style.color = '#cbd5e1';
            lastInTuneState = false;
        }
    } else {
        stringHint.textContent = "Ожидание сигнала...";
        lastInTuneState = false;
    }

    setTimeout(updatePitch, 50);
}

// Плавная физика стрелки спидометра (LERP)
function animateNeedle() {
    currentAngle += (targetAngle - currentAngle) * 0.15;
    needle.style.transform = `rotate(${currentAngle}deg)`;
    requestAnimationFrame(animateNeedle);
}


// --- КАСТОМНЫЙ ВЫПАДАЮЩИЙ СПИСОК МЕТРОНОМА ---
const metroSelect = document.getElementById('metro-select');
const metroTrigger = document.getElementById('metro-trigger');
const metroSelectedText = document.getElementById('metro-selected-text');
const metroOptions = document.querySelectorAll('.m-option');

metroTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    metroSelect.classList.toggle('open');
});

document.addEventListener('click', () => {
    metroSelect.classList.remove('open');
});

metroOptions.forEach(opt => {
    opt.addEventListener('click', () => {
        metroOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        metroSelectedText.textContent = `Размер: ${opt.textContent}`;
        beatsPerMeasure = parseInt(opt.dataset.val);
        currentBeat = 0;
        createDots();
        if (isPlaying) {
            stopMetronome();
            startMetronome();
        }
    });
});


// --- МЕТРОНОМ ---
let bpm = 120;
let beatsPerMeasure = 4;
let isPlaying = false;
let currentBeat = 0;
let metroTimer = null;
let metroAudioCtx = null;

const bpmVal = document.getElementById('bpm-val');
const bpmSlider = document.getElementById('bpm-slider');
const bpmMinus = document.getElementById('bpm-minus');
const bpmPlus = document.getElementById('bpm-plus');
const metroStartBtn = document.getElementById('metro-start-btn');
const dotsContainer = document.getElementById('dots-container');

function createDots() {
    dotsContainer.innerHTML = '';
    for (let i = 0; i < beatsPerMeasure; i++) {
        const dot = document.createElement('div');
        dot.classList.add('dot');
        dotsContainer.appendChild(dot);
    }
}
createDots();

function updateBpm(newBpm) {
    bpm = Math.max(30, Math.min(250, newBpm));
    bpmVal.textContent = bpm;
    bpmSlider.value = bpm;
    if (isPlaying) {
        stopMetronome();
        startMetronome();
    }
}

bpmSlider.addEventListener('input', (e) => updateBpm(parseInt(e.target.value)));
bpmMinus.addEventListener('click', () => updateBpm(bpm - 1));
bpmPlus.addEventListener('click', () => updateBpm(bpm + 1));

function playClickSound(isAccent) {
    if (!metroAudioCtx) {
        metroAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const osc = metroAudioCtx.createOscillator();
    const gain = metroAudioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.value = isAccent ? 1200 : 800;
    
    gain.gain.setValueAtTime(1, metroAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, metroAudioCtx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(metroAudioCtx.destination);

    osc.start();
    osc.stop(metroAudioCtx.currentTime + 0.04);
}

function tick() {
    const dots = dotsContainer.children;
    for (let i = 0; i < dots.length; i++) {
        dots[i].classList.remove('active', 'accent');
    }

    const isAccent = currentBeat === 0;
    playClickSound(isAccent);

    if (dots[currentBeat]) {
        dots[currentBeat].classList.add('active');
        if (isAccent) dots[currentBeat].classList.add('accent');
    }

    currentBeat = (currentBeat + 1) % beatsPerMeasure;
}

function startMetronome() {
    isPlaying = true;
    metroStartBtn.textContent = 'Остановить метроном';
    metroStartBtn.classList.add('stop');
    currentBeat = 0;
    tick();
    const interval = (60 / bpm) * 1000;
    metroTimer = setInterval(tick, interval);
}

function stopMetronome() {
    isPlaying = false;
    metroStartBtn.textContent = 'Запустить метроном';
    metroStartBtn.classList.remove('stop');
    clearInterval(metroTimer);
    const dots = dotsContainer.children;
    for (let i = 0; i < dots.length; i++) {
        dots[i].classList.remove('active', 'accent');
    }
}

metroStartBtn.addEventListener('click', () => {
    if (isPlaying) {
        stopMetronome();
    } else {
        startMetronome();
    }
});
