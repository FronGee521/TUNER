const startBtn = document.getElementById('start-btn');
const display = document.getElementById('display');
const noteElem = document.getElementById('note');
const freqElem = document.getElementById('frequency');
const centsElem = document.getElementById('cents');
const needle = document.getElementById('needle');

let audioContext = null;
let analyser = null;
let microphone = null;

const noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

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

        startBtn.style.display = 'none';
        display.style.display = 'block';

        updatePitch();
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

        noteElem.textContent = `${noteName}${octave}`;
        freqElem.textContent = `${pitch.toFixed(1)} Hz`;
        centsElem.textContent = `${cents > 0 ? '+' : ''}${cents} центов`;

        let needlePos = Math.max(-50, Math.min(50, cents));
        needle.style.transform = `translateX(-50%) rotate(${needlePos * 1.5}deg)`;

        if (Math.abs(cents) < 3) {
            noteElem.style.color = '#4caf50';
        } else {
            noteElem.style.color = '#fff';
        }
    }

    requestAnimationFrame(updatePitch);
}
