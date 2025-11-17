// =============================
//  WAVESURFER SETUP
// =============================
let wavesurfer = WaveSurfer.create({
    container: '#waveform',
    waveColor: '#1adfff',
    progressColor: '#b44bff',
    height: 80,
    responsive: true,
    plugins: [
        WaveSurfer.regions.create({})
    ]
});

// AUDIO INPUT
document.getElementById('audio-input').addEventListener('change', (e) => {
    let file = e.target.files[0];
    if (file) {
        wavesurfer.load(URL.createObjectURL(file));
    }
});

// =============================
//  PREVIEW CANVAS
// =============================
const canvas = document.getElementById("preview-canvas");
const ctx = canvas.getContext("2d");

// GREEN BACKGROUND (CHROMA KEY)
function drawBackground() {
    ctx.fillStyle = "#00ff00";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// =============================
//  VISEME IMAGE LOADER
// =============================
function loadImg(src) {
    let img = new Image();
    img.src = src;
    return img;
}

// MAP HURUF → FILE PNG
const visemeMap = {
    A: "visemes/A,E.png",
    E: "visemes/A,E.png",
    B: "visemes/B,M,P.png",
    M: "visemes/B,M,P.png",
    P: "visemes/B,M,P.png",
    C: "visemes/C,J,S.png",
    J: "visemes/C,J,S.png",
    S: "visemes/C,J,S.png",
    D: "visemes/D,G,K,N,S,T,X,Y,Z.png",
    G: "visemes/D,G,K,N,S,T,X,Y,Z.png",
    K: "visemes/D,G,K,N,S,T,X,Y,Z.png",
    N: "visemes/D,G,K,N,S,T,X,Y,Z.png",
    T: "visemes/D,G,K,N,S,T,X,Y,Z.png",
    X: "visemes/D,G,K,N,S,T,X,Y,Z.png",
    Y: "visemes/D,G,K,N,S,T,X,Y,Z.png",
    Z: "visemes/D,G,K,N,S,T,X,Y,Z.png",
    F: "visemes/F,V.png",
    V: "visemes/F,V.png",
    H: "visemes/H.png",
    I: "visemes/I,Q.png",
    Q: "visemes/I,Q.png",
    L: "visemes/L.png",
    O: "visemes/O.png",
    R: "visemes/R.png",
    U: "visemes/U,W.png",
    W: "visemes/U,W.png",
    " ": "visemes/netral.png"
};

// DEFAULT
const neutralImg = loadImg("visemes/netral.png");

// =============================
//  SEGMENT / PENANDA
// =============================
let markerState = 0; // 0 = start, 1 = end
let currentRegion = null;
let regionsList = [];

document.getElementById("add-marker").addEventListener("click", () => {
    let time = wavesurfer.getCurrentTime();

    if (markerState === 0) {
        // START
        currentRegion = wavesurfer.addRegion({
            start: time,
            color: "rgba(255,0,0,0.4)"
        });
        markerState = 1;

    } else {
        // END
        currentRegion.update({
            end: time
        });

        regionsList.push(currentRegion);
        createSegmentInput(currentRegion);
        currentRegion = null;
        markerState = 0;
    }
});

// =============================
//  BUAT INPUT TEKS
// =============================
function createSegmentInput(region) {
    let container = document.getElementById("segments-container");

    let box = document.createElement("div");
    box.className = "segment-box";

    let title = document.createElement("div");
    title.className = "segment-title";
    title.innerText = `Segmen: ${region.start.toFixed(2)} - ${region.end.toFixed(2)}`;

    let input = document.createElement("input");
    input.className = "segment-input";
    input.placeholder = "Teks untuk segmen ini";
    input.dataset.start = region.start;
    input.dataset.end = region.end;

    box.appendChild(title);
    box.appendChild(input);
    container.appendChild(box);
}

// =============================
//  PLAYBACK + ANIMASI VISEME
// =============================
let animationInterval = null;

document.getElementById("play-btn").addEventListener("click", () => {
    wavesurfer.play();
    startVisemeAnimation();
});

function startVisemeAnimation() {

    clearInterval(animationInterval);

    animationInterval = setInterval(() => {
        let now = wavesurfer.getCurrentTime();
        drawBackground();

        // CARI TEKS YANG SEDANG DIPUTAR
        let activeText = "";
        document.querySelectorAll(".segment-input").forEach(input => {
            let start = parseFloat(input.dataset.start);
            let end = parseFloat(input.dataset.end);

            if (now >= start && now <= end) {
                activeText = input.value.toUpperCase();
            }
        });

        // AMBIL HURUF BERDASARKAN WAKTU
        if (activeText.length > 0) {
            let idx = Math.floor((now * 12) % activeText.length); // 12 huruf per detik
            let huruf = activeText[idx] || " ";

            let file = visemeMap[huruf] || "visemes/netral.png";
            let img = loadImg(file);

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        } else {
            ctx.drawImage(neutralImg, 0, 0, canvas.width, canvas.height);
        }

    }, 80); // 12 fps
}

// =============================
//  EKSPOR GIF
// =============================
document.getElementById("export-btn").addEventListener("click", () => {
    let capturer = new CCapture({
        format: "gif",
        framerate: 12,
        workersPath: "libs/"
    });

    capturer.start();

    let duration = wavesurfer.getDuration();
    let t = 0;
    let dt = 1 / 12;

    function recordFrame() {
        if (t >= duration) {
            capturer.save();
            return;
        }

        wavesurfer.seekTo(t / duration);
        startVisemeAnimation();
        drawBackground();

        capturer.capture(canvas);

        t += dt;
        requestAnimationFrame(recordFrame);
    }

    recordFrame();
});
