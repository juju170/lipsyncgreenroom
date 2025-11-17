/* app.js - MARKER MODE 1 implementation
   - custom markers (box+triangle)
   - start/end pair -> segment block
   - draggable markers
   - zoom slider + pinch gesture
   - play/pause toggle
   - segments list with text input
*/

/* UI refs */
const canvas = document.getElementById('preview-canvas');
const ctx = canvas.getContext('2d');
const audioInput = document.getElementById('audio-input');
const addMarkerBtn = document.getElementById('add-marker');
const playBtn = document.getElementById('play-btn');
const exportBtn = document.getElementById('export-btn');
const zoomSlider = document.getElementById('zoom-slider');
const waveformEl = document.getElementById('waveform');
const overlay = document.getElementById('overlay');
const segmentsContainer = document.getElementById('segments-container');

const CANVAS_W = canvas.width, CANVAS_H = canvas.height;
const CHROMA = '#8CCF67'; // canvas background

/* draw canvas background initially */
function drawBackground(){
  ctx.fillStyle = CHROMA;
  ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
}
drawBackground();

/* Wavesurfer init */
let wavesurfer = WaveSurfer.create({
  container: '#waveform',
  waveColor: '#1adfff',
  progressColor: '#b44bff',
  height: 88,
  normalize: true
});

/* viseme mapping (same as earlier) */
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
const imgCache = {};
function getVisemeImg(letter){
  const key = (letter||' ').toUpperCase();
  const file = visemeMap[key] || "visemes/netral.png";
  if (imgCache[file]) return imgCache[file];
  const i = new Image(); i.src = file; imgCache[file] = i; return i;
}

/* state */
let markers = []; // {id, el, time, type:'start'|'end'}
let segments = []; // {id, startMarkerId, endMarkerId, elBlock, data}
let pendingStartMarker = null;
let markerCounter = 0;

/* helper: waveform dimensions -> px/time conversions */
function waveformRect(){
  return waveformEl.getBoundingClientRect();
}
function timeToPx(time){
  const dur = wavesurfer.getDuration() || 1;
  const rect = waveformRect();
  return (time / dur) * rect.width;
}
function pxToTime(px){
  const dur = wavesurfer.getDuration() || 1;
  const rect = waveformRect();
  let x = px;
  if (x < 0) x = 0;
  if (x > rect.width) x = rect.width;
  return (x / rect.width) * dur;
}

/* create visual marker element (box+triangle+line) */
function createMarkerEl(type){
  const id = 'm' + (++markerCounter);
  const m = document.createElement('div');
  m.className = 'marker' + (type === 'end' ? ' end' : '');
  m.dataset.id = id;
  m.dataset.type = type;

  const box = document.createElement('div');
  box.className = 'box';
  box.textContent = (type === 'start' ? 'S' : 'E');

  const tri = document.createElement('div');
  tri.className = 'triangle';

  const line = document.createElement('div');
  line.className = 'line';

  m.appendChild(box);
  m.appendChild(tri);
  m.appendChild(line);

  // enable pointer events on marker (overlay uses pointer-events:none globally)
  m.style.pointerEvents = 'auto';

  overlay.appendChild(m);
  return m;
}

/* create marker at current time */
function createMarkerAt(time, type){
  const el = createMarkerEl(type);
  const rect = waveformRect();
  const left = Math.round(timeToPx(time));
  el.style.left = left + 'px';
  // attach drag behavior
  attachDragForMarker(el);
  const obj = { id: el.dataset.id, el, time, type };
  markers.push(obj);
  return obj;
}

/* attach drag events (mouse + touch) to a marker */
function attachDragForMarker(el){
  let dragging = false;
  let startX = 0;
  let origLeft = 0;

  function onDown(e){
    e.preventDefault();
    dragging = true;
    el.classList.add('dragging');
    startX = (e.touches ? e.touches[0].clientX : e.clientX);
    origLeft = el.offsetLeft;
    // ensure we can receive move events
    document.body.style.userSelect = 'none';
  }
  function onMove(e){
    if (!dragging) return;
    const clientX = (e.touches ? e.touches[0].clientX : e.clientX);
    const dx = clientX - startX;
    const rect = waveformRect();
    let newLeft = origLeft + dx;
    // clamp to waveform area
    const minLeft = 0;
    const maxLeft = rect.width;
    if (newLeft < minLeft) newLeft = minLeft;
    if (newLeft > maxLeft) newLeft = maxLeft;
    el.style.left = newLeft + 'px';
    // update marker time in state
    const id = el.dataset.id;
    const m = markers.find(x=>x.id===id);
    if (m){
      m.time = pxToTime(newLeft);
      // if marker part of a segment, update segment block
      updateSegmentsForMarker(m.id);
      // update segment UI times
      syncSegmentUIForMarker(m.id);
    }
  }
  function onUp(e){
    if (!dragging) return;
    dragging = false;
    el.classList.remove('dragging');
    document.body.style.userSelect = '';
  }

  el.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);

  el.addEventListener('touchstart', onDown, {passive:false});
  window.addEventListener('touchmove', onMove, {passive:false});
  window.addEventListener('touchend', onUp);
}

/* create a segment block between two marker objects */
function createSegment(startMarker, endMarker){
  // ensure start < end by time
  let s = startMarker.time, e = endMarker.time;
  if (s > e){ const tmp = s; s = e; e = tmp; }

  // create visual block
  const block = document.createElement('div');
  block.className = 'segment-block';
  // compute left & width in px
  const rect = waveformRect();
  const left = Math.round((s / (wavesurfer.getDuration()||1)) * rect.width);
  const right = Math.round((e / (wavesurfer.getDuration()||1)) * rect.width);
  block.style.left = left + 'px';
  block.style.width = Math.max(2, right - left) + 'px';
  overlay.appendChild(block);

  // create data structure and UI
  const segId = 'seg' + (segments.length + 1);
  const seg = { id: segId, startMarkerId: startMarker.id, endMarkerId: endMarker.id, elBlock: block, data:{ text:'' } };
  segments.push(seg);

  // build segment UI (title + input)
  const box = document.createElement('div');
  box.className = 'segment-box';
  box.dataset.segmentId = seg.id;

  const title = document.createElement('div');
  title.className = 'segment-title';
  title.textContent = `Segmen: ${s.toFixed(2)} - ${e.toFixed(2)}`;

  const input = document.createElement('input');
  input.className = 'segment-input';
  input.placeholder = 'Teks untuk segmen ini';
  input.addEventListener('input', () => {
    seg.data.text = input.value;
  });

  const del = document.createElement('button');
  del.textContent = 'Hapus segmen';
  del.addEventListener('click', () => {
    // remove block and ui and markers (both)
    block.remove();
    box.remove();
    // remove markers
    removeMarkerById(startMarker.id);
    removeMarkerById(endMarker.id);
    // remove segment from array
    segments = segments.filter(sx => sx.id !== seg.id);
  });

  box.appendChild(title);
  box.appendChild(input);
  box.appendChild(del);
  segmentsContainer.appendChild(box);

  return seg;
}

/* remove marker helper */
function removeMarkerById(id){
  const idx = markers.findIndex(m=>m.id===id);
  if (idx === -1) return;
  const m = markers[idx];
  if (m.el && m.el.parentElement) m.el.remove();
  markers.splice(idx,1);
  // also remove segments referencing this marker
  const segsToRemove = segments.filter(s => s.startMarkerId===id || s.endMarkerId===id);
  for (const s of segsToRemove){
    if (s.elBlock) s.elBlock.remove();
    const ui = document.querySelector(`[data-segment-id="${s.id}"]`);
    if (ui) ui.remove();
  }
  segments = segments.filter(s => s.startMarkerId !== id && s.endMarkerId !== id);
}

/* update segments visuals when one of its markers moved */
function updateSegmentsForMarker(markerId){
  for (const seg of segments){
    if (seg.startMarkerId === markerId || seg.endMarkerId === markerId){
      const startM = markers.find(m=>m.id===seg.startMarkerId);
      const endM = markers.find(m=>m.id===seg.endMarkerId);
      if (!startM || !endM) continue;
      let s = startM.time, e = endM.time;
      if (s > e){ const tmp=s; s=e; e=tmp; }
      const rect = waveformRect();
      const left = Math.round((s / (wavesurfer.getDuration()||1)) * rect.width);
      const right = Math.round((e / (wavesurfer.getDuration()||1)) * rect.width);
      seg.elBlock.style.left = left + 'px';
      seg.elBlock.style.width = Math.max(2, right - left) + 'px';
      // update segment UI title
      const ui = document.querySelector(`[data-segment-id="${seg.id}"]`);
      if (ui) ui.querySelector('.segment-title').textContent = `Segmen: ${s.toFixed(2)} - ${e.toFixed(2)}`;
    }
  }
}

/* sync marker movement to UI (if marker moved update linked segment UI) */
function syncSegmentUIForMarker(markerId){
  for (const seg of segments){
    if (seg.startMarkerId===markerId || seg.endMarkerId===markerId){
      const startM = markers.find(m=>m.id===seg.startMarkerId);
      const endM = markers.find(m=>m.id===seg.endMarkerId);
      if (!startM || !endM) continue;
      let s = Math.min(startM.time, endM.time);
      let e = Math.max(startM.time, endM.time);
      const ui = document.querySelector(`[data-segment-id="${seg.id}"]`);
      if (ui) ui.querySelector('.segment-title').textContent = `Segmen: ${s.toFixed(2)} - ${e.toFixed(2)}`;
    }
  }
}

/* when audio loaded */
audioInput.addEventListener('change', (e)=>{
  const f = e.target.files[0];
  if (!f) return;
  wavesurfer.load(URL.createObjectURL(f));
  // clean overlay + state
  markers.forEach(m=> m.el.remove());
  segments.forEach(s=> s.elBlock.remove());
  markers = []; segments = []; pendingStartMarker = null;
  segmentsContainer.innerHTML = '';
});

/* add-marker button flow (MODE 1: start -> end) */
addMarkerBtn.addEventListener('click', ()=>{
  if (!wavesurfer.isReady) return alert('Upload audio dulu');
  const cur = wavesurfer.getCurrentTime();
  if (!pendingStartMarker){
    // create start marker
    const m = createMarkerAt(cur, 'start');
    pendingStartMarker = m;
  } else {
    // create end marker and a segment
    const m2 = createMarkerAt(cur, 'end');
    // pair them (ensure proper order when times swapped)
    const startM = pendingStartMarker.time <= m2.time ? pendingStartMarker : m2;
    const endM = pendingStartMarker.time <= m2.time ? m2 : pendingStartMarker;
    // create segment
    const seg = createSegment(startM, endM);
    pendingStartMarker = null;
  }
});

/* play/pause toggle using wavesurfer playback */
let raf = null;
playBtn.addEventListener('click', async ()=>{
  if (!wavesurfer.isReady) return alert('Upload audio dulu');
  if (wavesurfer.isPlaying()){
    wavesurfer.pause();
    playBtn.textContent = '▶';
    if (raf) cancelAnimationFrame(raf);
  } else {
    try { await wavesurfer.backend.getAudioContext().resume(); } catch(e){}
    wavesurfer.play();
    playBtn.textContent = '⏸';
    startRenderLoop();
  }
});

/* render loop draws canvas preview based on active segment and its text */
function startRenderLoop(){
  function loop(){
    drawBackground();
    const t = wavesurfer.getCurrentTime();
    // find active segment by time
    const activeSeg = segments.find(s=>{
      const sm = markers.find(m=>m.id===s.startMarkerId);
      const em = markers.find(m=>m.id===s.endMarkerId);
      if (!sm || !em) return false;
      const start = Math.min(sm.time, em.time);
      const end = Math.max(sm.time, em.time);
      return t >= start && t <= end;
    });
    if (!activeSeg){
      ctx.drawImage(neutralImg, 0,0, CANVAS_W, CANVAS_H);
    } else {
      const sm = markers.find(m=>m.id===activeSeg.startMarkerId);
      const em = markers.find(m=>m.id===activeSeg.endMarkerId);
      if (!sm || !em){ ctx.drawImage(neutralImg,0,0,CANVAS_W,CANVAS_H); }
      else {
        const start = Math.min(sm.time, em.time);
        const end = Math.max(sm.time, em.time);
        const text = activeSeg.data.text || '';
        if (!text) { ctx.drawImage(neutralImg,0,0,CANVAS_W,CANVAS_H); }
        else {
          const letters = text.replace(/\s+/g,'').split('');
          const frac = (t - start) / Math.max(0.0001, (end - start));
          const idx = Math.floor(frac * letters.length);
          const letter = letters[Math.max(0, Math.min(letters.length-1, idx))];
          const img = getVisemeImg(letter);
          if (img && img.complete){
            const scale = Math.min(CANVAS_W / img.width, CANVAS_H / img.height) * 0.9;
            const w = img.width * scale, h = img.height * scale;
            ctx.drawImage(img, (CANVAS_W - w)/2, (CANVAS_H - h)/2, w, h);
          } else {
            ctx.drawImage(neutralImg,0,0,CANVAS_W,CANVAS_H);
          }
        }
      }
    }
    raf = requestAnimationFrame(loop);
  }
  if (!raf) loop();
}

/* stop when audio finishes */
wavesurfer.on('finish', ()=>{
  playBtn.textContent = '▶';
  if (raf) cancelAnimationFrame(raf);
  raf = null;
});

/* Zoom slider -> try wavesurfer.zoom if available, else no-op visual */
zoomSlider.addEventListener('input', (e)=>{
  const val = Number(e.target.value);
  if (typeof wavesurfer.zoom === 'function') {
    wavesurfer.zoom(val);
  } else {
    // fallback: scale waveform element horizontally (visual only)
    waveformEl.style.transformOrigin = 'left center';
    waveformEl.style.transform = `scaleX(${val/100})`;
    // reposition overlay accordingly (we keep overlay absolute so markers still map correctly via time->px)
  }
});

/* pinch gesture to change zoom (mobile) */
let pinchStartDist = null, pinchStartVal = null;
waveformEl.addEventListener('touchstart', (ev)=>{
  if (ev.touches && ev.touches.length === 2){
    const dx = ev.touches[0].clientX - ev.touches[1].clientX;
    const dy = ev.touches[0].clientY - ev.touches[1].clientY;
    pinchStartDist = Math.hypot(dx,dy);
    pinchStartVal = Number(zoomSlider.value);
  }
}, {passive:false});
waveformEl.addEventListener('touchmove', (ev)=>{
  if (ev.touches && ev.touches.length === 2 && pinchStartDist){
    ev.preventDefault();
    const dx = ev.touches[0].clientX - ev.touches[1].clientX;
    const dy = ev.touches[0].clientY - ev.touches[1].clientY;
    const dist = Math.hypot(dx,dy);
    const ratio = dist / pinchStartDist;
    let newVal = Math.round(pinchStartVal * ratio);
    newVal = Math.max(20, Math.min(600, newVal));
    zoomSlider.value = newVal;
    // trigger zoom handler
    const evt = new Event('input'); zoomSlider.dispatchEvent(evt);
  }
}, {passive:false});
waveformEl.addEventListener('touchend', (ev)=>{ if (ev.touches.length < 2) { pinchStartDist = null; pinchStartVal = null; } });

/* utility: reposition all overlays (markers + segments) on resize or zoom change */
function repositionOverlay(){
  const rect = waveformRect();
  // markers
  for (const m of markers){
    const left = Math.round(timeToPx(m.time));
    if (m.el) m.el.style.left = left + 'px';
  }
  // segments
  for (const s of segments){
    const sm = markers.find(x=>x.id===s.startMarkerId);
    const em = markers.find(x=>x.id===s.endMarkerId);
    if (!sm || !em) continue;
    let start = Math.min(sm.time, em.time), end = Math.max(sm.time, em.time);
    const left = Math.round(timeToPx(start));
    const right = Math.round(timeToPx(end));
    s.elBlock.style.left = left + 'px';
    s.elBlock.style.width = Math.max(2, right - left) + 'px';
    // update UI title too
    const ui = document.querySelector(`[data-segment-id="${s.id}"]`);
    if (ui) ui.querySelector('.segment-title').textContent = `Segmen: ${start.toFixed(2)} - ${end.toFixed(2)}`;
  }
}

/* window resize handler */
window.addEventListener('resize', () => {
  setTimeout(repositionOverlay,120);
});

/* reposition overlay when wave is ready/zoomed */
wavesurfer.on('ready', ()=>{
  repositionOverlay();
});
zoomSlider.addEventListener('change', ()=> setTimeout(repositionOverlay,120));

/* helper: waveform rect */
function waveformRect(){ return waveformEl.getBoundingClientRect(); }

/* export: basic webm capture of canvas + audio (keamanan/performance mobile) */
exportBtn.addEventListener('click', async ()=>{
  if (!wavesurfer.isReady) return alert('Upload audio dulu');
  const backend = wavesurfer.backend;
  const ac = backend.getAudioContext();
  // try to get audio element
  let audioEl = document.querySelector('audio') || backend.getMediaElement && backend.getMediaElement();
  if (!audioEl) {
    alert('Tidak menemukan elemen audio untuk direkam. Gunakan webm manual.');
    return;
  }
  const dest = ac.createMediaStreamDestination();
  try { backend.gainNode.connect(dest); } catch(e){ try{ ac.destination.connect(dest);}catch(_){} }
  const canvasStream = canvas.captureStream(25);
  const mixed = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(mixed, {mimeType:'video/webm; codecs=vp8,opus'});
  const parts = [];
  rec.ondataavailable = e=> { if (e.data && e.data.size) parts.push(e.data); };
  rec.onstop = ()=> {
    const blob = new Blob(parts, {type:'video/webm'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'lipsync_export.webm'; a.click();
  };
  wavesurfer.seekTo(0);
  rec.start();
  wavesurfer.play();
  if (!raf) startRenderLoop();
  wavesurfer.on('finish', ()=> { rec.stop(); });
});

/* helper: waveformRect used above (declared again due to scope) */
function waveformRect(){ return waveformEl.getBoundingClientRect(); }

/* done */
console.log('Marker-mode app.js loaded');
