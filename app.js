/* app.js - updated: play/pause, draggable/resizable regions, handles, zoom slider */
/* assumes wavesurfer.min.js and wavesurfer.regions.min.js ada di /libs/ */

const CANVAS = document.getElementById('preview-canvas');
const CTX = CANVAS.getContext('2d');
const AUDIO_INPUT = document.getElementById('audio-input');
const ADD_MARKER_BTN = document.getElementById('add-marker');
const PLAY_BTN = document.getElementById('play-btn');
const EXPORT_BTN = document.getElementById('export-btn');
const SEGMENTS_CONTAINER = document.getElementById('segments-container');
const ZOOM_SLIDER = document.getElementById('zoom-slider');
const WAVEFORM_EL = document.getElementById('waveform');

const CANVAS_W = CANVAS.width;
const CANVAS_H = CANVAS.height;
const CHROMA = '#8CCF67'; // sesuai permintaan (pakai warna yang png mu pakai)

// draw chroma background
function drawBackground(){
  CTX.fillStyle = CHROMA;
  CTX.fillRect(0,0,CANVAS_W,CANVAS_H);
}

// wavesurfer init
let wavesurfer = WaveSurfer.create({
  container: '#waveform',
  waveColor: '#1adfff',
  progressColor: '#b44bff',
  height: 88,
  normalize: true,
  plugins: [
    WaveSurfer.regions.create({})
  ]
});

// viseme mapping (sama seperti sebelumnya)
const visemeMap = {
  A: "visemes/A,E.png", E: "visemes/A,E.png",
  B: "visemes/B,M,P.png", M: "visemes/B,M,P.png", P: "visemes/B,M,P.png",
  C: "visemes/C,J,S.png", J: "visemes/C,J,S.png", S: "visemes/C,J,S.png",
  D: "visemes/D,G,K,N,T,X,Y,Z.png", G: "visemes/D,G,K,N,T,X,Y,Z.png",
  K: "visemes/D,G,K,N,T,X,Y,Z.png", N: "visemes/D,G,K,N,T,X,Y,Z.png",
  T: "visemes/D,G,K,N,T,X,Y,Z.png", X: "visemes/D,G,K,N,T,X,Y,Z.png",
  Y: "visemes/D,G,K,N,T,X,Y,Z.png", Z: "visemes/D,G,K,N,T,X,Y,Z.png",
  F: "visemes/F,V.png", V: "visemes/F,V.png", H:"visemes/H.png",
  I:"visemes/I,Q.png", Q:"visemes/I,Q.png", L:"visemes/L.png",
  O:"visemes/O.png", R:"visemes/R.png", U:"visemes/U,W.png", W:"visemes/U,W.png",
  " ": "visemes/netral.png"
};
const neutralImg = new Image(); neutralImg.src = "visemes/netral.png";

// cache loaded images
const imgCache = {};
function getVisemeImg(letter){
  const key = (letter||' ').toUpperCase();
  const file = visemeMap[key] || "visemes/netral.png";
  if (imgCache[file]) return imgCache[file];
  const i = new Image();
  i.src = file;
  imgCache[file] = i;
  return i;
}

// --- audio load
AUDIO_INPUT.addEventListener('change', (e)=>{
  const f = e.target.files[0];
  if (!f) return;
  wavesurfer.load(URL.createObjectURL(f));
  // reset segments container
  SEGMENTS_CONTAINER.innerHTML = '';
});

// --- add marker (start/end toggle)
let pendingStart = null;
ADD_MARKER_BTN.addEventListener('click', ()=>{
  if (!wavesurfer || !wavesurfer.isReady) return alert('Upload audio dulu');
  const cur = wavesurfer.getCurrentTime();
  if (pendingStart === null){
    // create a temporary region with start == cur and no end yet
    pendingStart = cur;
    // visual feedback: create short region
    const r = wavesurfer.addRegion({ start: cur, end: cur + 0.2, color: 'rgba(200,20,20,0.45)', drag: true, resize:true });
    // mark as pending by storing on element
    r.update({ data: { pending: true } });
  } else {
    const start = Math.min(pendingStart, cur);
    const end = Math.max(pendingStart, cur);
    // create real region
    const region = wavesurfer.addRegion({ start, end, color:'rgba(200,20,20,0.45)', drag:true, resize:true, data:{ text:'' } });
    // remove any tiny pending region(s)
    for (const id in wavesurfer.regions.list){
      const rr = wavesurfer.regions.list[id];
      if (rr.data && rr.data.pending) rr.remove();
    }
    addSegmentUI(region);
    pendingStart = null;
  }
});

// handle region created by other means (e.g. program) - add UI & handles
wavesurfer.on('region-created', (region) => {
  // ensure draggable/resizable
  region.update({ drag: true, resize: true });
  // create or update UI
  addSegmentUI(region);
  addHandlesToRegion(region);
});

// when region is updated (drag/resize) update UI
wavesurfer.on('region-updated', (region) => {
  syncRegionToUI(region);
});

// region removed -> remove UI
wavesurfer.on('region-removed', (region) => {
  removeSegmentUI(region);
});

// --- UI list for segments
function addSegmentUI(region){
  // do not duplicate
  if (document.querySelector(`[data-region-id="${region.id}"]`)) return;

  const box = document.createElement('div');
  box.className = 'segment-box';
  box.dataset.regionId = region.id;

  const title = document.createElement('div');
  title.className = 'segment-title';
  title.textContent = `Segmen: ${region.start.toFixed(2)} - ${region.end.toFixed(2)}`;

  const input = document.createElement('input');
  input.className = 'segment-input';
  input.placeholder = 'Teks untuk segmen ini';
  input.dataset.regionId = region.id;
  input.addEventListener('input', ()=> {
    // no-op: text used by renderer
  });

  const del = document.createElement('button');
  del.textContent = 'Hapus segmen';
  del.style.marginTop='8px';
  del.addEventListener('click', ()=>{
    region.remove();
    box.remove();
  });

  box.appendChild(title);
  box.appendChild(input);
  box.appendChild(del);
  SEGMENTS_CONTAINER.appendChild(box);
}

// update UI when region changes
function syncRegionToUI(region){
  const box = document.querySelector(`[data-region-id="${region.id}"]`);
  if (!box) return;
  const title = box.querySelector('.segment-title');
  title.textContent = `Segmen: ${region.start.toFixed(2)} - ${region.end.toFixed(2)}`;
  const input = box.querySelector('.segment-input');
  input.dataset.start = region.start;
  input.dataset.end = region.end;
}

// remove UI
function removeSegmentUI(region){
  const box = document.querySelector(`[data-region-id="${region.id}"]`);
  if (box) box.remove();
}

// --- add visible handle on top of region (cantolan)
function addHandlesToRegion(region){
  // region.element is a DOM element rendered by wavesurfer plugin
  const el = region.element;
  if (!el) return;
  // create handle if none
  if (el.querySelector('.region-handle')) return;

  const handle = document.createElement('div');
  handle.className = 'region-handle';
  handle.textContent = '✦'; // icon / label, simple
  el.style.position = 'relative';
  el.appendChild(handle);

  // position handle center above region; keep updated as region moves
  function updateHandlePos(){
    // region.element has style left/width percents; place handle at center
    const rect = el.getBoundingClientRect();
    const parentRect = el.parentElement.getBoundingClientRect();
    const left = (rect.left - parentRect.left) + rect.width/2;
    handle.style.left = `${left}px`;
  }

  updateHandlePos();

  // observe changes to element's style (left/width) using MutationObserver
  const mo = new MutationObserver(updateHandlePos);
  mo.observe(el, { attributes: true, attributeFilter: ['style','class'] });

  // enable dragging by handle (drag entire region)
  let dragging = false;
  handle.addEventListener('mousedown', (ev) => {
    ev.preventDefault();
    dragging = true;
    handle.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  });
  window.addEventListener('mousemove', (ev) => {
    if (!dragging) return;
    // translate mouse x to time and move region so its center aligns under cursor
    const t = pxToTime(ev.clientX);
    const half = (region.end - region.start)/2;
    let s = t - half;
    let e = t + half;
    const dur = wavesurfer.getDuration() || 0;
    if (s < 0){ s = 0; e = region.end - region.start; }
    if (e > dur){ e = dur; s = dur - (region.end - region.start); if (s<0) s=0; }
    region.update({ start: s, end: e });
  });
  window.addEventListener('mouseup', ()=> {
    if (!dragging) return;
    dragging = false;
    handle.style.cursor = 'grab';
    document.body.style.userSelect = '';
  });

  // add small visual grips inside region (left/right) to hint resize (they won't break built-in resize)
  const gripL = document.createElement('div'); gripL.className='grip left';
  const gripR = document.createElement('div'); gripR.className='grip right';
  el.appendChild(gripL); el.appendChild(gripR);

  // Also allow manual resize via dragging grips: implement simple pointer move
  let resizing = null; // {which:'start'|'end', region}
  gripL.addEventListener('mousedown', (ev)=> {
    ev.stopPropagation(); ev.preventDefault();
    resizing = { which:'start', region, originClientX: ev.clientX };
    document.body.style.userSelect='none';
  });
  gripR.addEventListener('mousedown', (ev)=> {
    ev.stopPropagation(); ev.preventDefault();
    resizing = { which:'end', region, originClientX: ev.clientX };
    document.body.style.userSelect='none';
  });
  window.addEventListener('mousemove', (ev)=> {
    if (!resizing) return;
    const t = pxToTime(ev.clientX);
    if (resizing.which === 'start'){
      // keep start < end - tiny epsilon
      const newStart = Math.min(t, region.end - 0.01);
      region.update({ start: Math.max(0, newStart) });
    } else {
      const newEnd = Math.max(t, region.start + 0.01);
      const dur = wavesurfer.getDuration() || 0;
      region.update({ end: Math.min(dur, newEnd) });
    }
  });
  window.addEventListener('mouseup', ()=> {
    if (resizing) {
      resizing = null;
      document.body.style.userSelect='';
    }
  });
}

// convert clientX in waveform to time
function pxToTime(clientX){
  const rect = WAVEFORM_EL.getBoundingClientRect();
  const x = clientX - rect.left;
  const w = rect.width;
  const duration = wavesurfer.getDuration() || 1;
  let t = (x / w) * duration;
  if (t < 0) t = 0;
  if (t > duration) t = duration;
  return t;
}

// --- playback + renderer
let rafId = null;
function renderLoop(){
  drawBackground();
  const t = wavesurfer.getCurrentTime();
  // find active region
  const regions = Object.values(wavesurfer.regions.list || {});
  const active = regions.find(r => t >= r.start && t <= r.end);
  if (!active){
    // draw neutral
    CTX.drawImage(neutralImg, 0, 0, CANVAS_W, CANVAS_H);
  } else {
    // get corresponding text from UI
    const ui = document.querySelector(`[data-region-id="${active.id}"]`);
    let text = '';
    if (ui) text = (ui.querySelector('.segment-input').value || '').replace(/\s+/g,'');
    if (!text) {
      CTX.drawImage(neutralImg, 0, 0, CANVAS_W, CANVAS_H);
    } else {
      // distribute letters evenly across region duration
      const letters = text.split('');
      const index = Math.floor(((t - active.start) / (active.end - active.start)) * letters.length);
      const letter = letters[Math.max(0, Math.min(letters.length - 1, index))];
      const img = getVisemeImg(letter);
      // draw centered scaled
      const scale = Math.min(CANVAS_W / img.width, CANVAS_H / img.height) * 0.9;
      const w = img.width * scale, h = img.height * scale;
      CTX.drawImage(img, (CANVAS_W - w)/2, (CANVAS_H - h)/2, w, h);
    }
  }
  rafId = requestAnimationFrame(renderLoop);
}

PLAY_BTN.addEventListener('click', async ()=>{
  if (!wavesurfer.isReady) return alert('Upload audio dulu');
  if (wavesurfer.isPlaying()) {
    wavesurfer.pause();
    PLAY_BTN.textContent = '▶';
    if (rafId) cancelAnimationFrame(rafId);
  } else {
    // ensure audio context resumed on user gesture
    try { await wavesurfer.backend.getAudioContext().resume(); } catch(e){}
    wavesurfer.play();
    PLAY_BTN.textContent = '⏸';
    if (!rafId) renderLoop();
  }
});

// stop render when audio finishes
wavesurfer.on('finish', ()=> {
  if (rafId) cancelAnimationFrame(rafId);
  PLAY_BTN.textContent = '▶';
});

// --- zoom slider: uses wavesurfer.zoom(pxPerSec)
ZOOM_SLIDER.addEventListener('input', (e)=>{
  const val = Number(e.target.value);
  // wavesurfer.zoom exists in many builds; fallback safe-guard
  if (typeof wavesurfer.zoom === 'function'){
    wavesurfer.zoom(val);
  } else {
    console.warn('zoom API tidak tersedia di versi wavesurfer ini');
  }
});

// when graph ready, set default zoom
wavesurfer.on('ready', ()=>{
  // default zoom from slider
  if (typeof wavesurfer.zoom === 'function') wavesurfer.zoom(Number(ZOOM_SLIDER.value));
});

// --- export (basic webm recording as fallback)
// simple: capture canvas frames + play audio simultaneously and build webm via MediaRecorder
EXPORT_BTN.addEventListener('click', async ()=>{
  if (!wavesurfer.isReady) return alert('Upload audio dulu');
  // prepare audio element from wavesurfer backend
  const backend = wavesurfer.backend;
  // get media stream from audio context
  const ac = backend.getAudioContext();
  const src = backend.getMediaElement(); // if supported
  // fallback: use wavesurfer.backend.media (depending on build)
  let audioEl = src || document.querySelector('audio');
  if (!audioEl){
    alert('Tidak dapat menemukan elemen audio untuk direkam. Gunakan export manual (webm) nanti).');
    return;
  }

  // route audio into MediaStreamDestination
  const dest = ac.createMediaStreamDestination();
  try {
    // try to connect backend gain to dest
    backend.gainNode.connect(dest);
  } catch(e){
    try { ac.destination.connect(dest); } catch(e2){}
  }

  const canvasStream = CANVAS.captureStream(25);
  const mixedStream = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);

  const rec = new MediaRecorder(mixedStream, { mimeType: 'video/webm; codecs=vp8,opus' });
  const parts = [];
  rec.ondataavailable = (e)=> { if (e.data && e.data.size) parts.push(e.data); };
  rec.onstop = ()=> {
    const blob = new Blob(parts, { type:'video/webm' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lipsync_export.webm';
    a.click();
  };

  // play from start and record
  wavesurfer.seekTo(0);
  rec.start();
  wavesurfer.play();
  if (!rafId) renderLoop();

  wavesurfer.on('finish', ()=> {
    rec.stop();
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  });
});
