const video = document.querySelector('#video');
const canvas = document.querySelector('#effectCanvas');
const ctx = canvas.getContext('2d');
const startCameraBtn = document.querySelector('#startCamera');
const startPrompt = document.querySelector('#startPrompt');
const cameraStatus = document.querySelector('#cameraStatus');
const captureBtn = document.querySelector('#captureBtn');
const recordBtn = document.querySelector('#recordBtn');
const recordLabel = document.querySelector('#recordLabel');
const switchCameraBtn = document.querySelector('#switchCamera');
const fileInput = document.querySelector('#fileInput');
const gallery = document.querySelector('#gallery');
const emptyGallery = document.querySelector('#emptyGallery');
const mediaCount = document.querySelector('#mediaCount');
const toast = document.querySelector('#toast');
let stream = null, facingMode = 'environment', currentFilter = 'original', currentEffect = 'none';
let mediaRecorder = null, recordedChunks = [], recording = false, animationFrame = null, toastTimer = null;
let brightness = 100, saturation = 100, contrast = 100;
const creations = [];
const filterCSS = {
  original: 'none',
  dream: 'saturate(1.45) hue-rotate(18deg) brightness(1.08)',
  neon: 'saturate(2.3) contrast(1.2) hue-rotate(35deg)',
  sunset: 'sepia(.25) saturate(1.8) hue-rotate(-18deg) contrast(1.08)',
  mono: 'grayscale(1) contrast(1.12)',
  vintage: 'sepia(.48) saturate(.8) contrast(.92) brightness(1.05)'
};
const filterNames = {original:'Original',dream:'Rêve',neon:'Néon',sunset:'Sunset',mono:'Noir & blanc',vintage:'Vintage'};
function showToast(message) {
  toast.textContent = message; toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}
function updateFilter() {
  video.style.filter = `${filterCSS[currentFilter]} brightness(${brightness}%) saturate(${saturation}%) contrast(${contrast}%)`;
  document.querySelector('#filterName').textContent = filterNames[currentFilter];
}
async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast('Caméra indisponible : ouvrez le site en HTTPS ou sur localhost.'); return;
  }
  try {
    if (stream) stream.getTracks().forEach(track => track.stop());
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 960 } }
    });
    video.srcObject = stream;
    await video.play();
    video.classList.add('ready');
    startPrompt.hidden = true;
    cameraStatus.textContent = facingMode === 'user' ? 'Caméra avant active' : 'Caméra arrière active';
    document.querySelector('#viewfinder').classList.toggle('mirror', facingMode === 'user');
    resizeCanvas(); drawEffects();
    showToast('Caméra activée — choisissez votre filtre !');
  } catch (error) {
    console.error(error);
    showToast(error.name === 'NotAllowedError' ? 'Autorisez l’accès à la caméra dans votre navigateur.' : 'Impossible d’ouvrir la caméra sur cet appareil.');
  }
}
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function drawEffects() {
  cancelAnimationFrame(animationFrame);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  if (currentEffect === 'scan') {
    const y = (Date.now() / 8) % Math.max(h, 1);
    ctx.fillStyle = 'rgba(90,255,239,.14)'; ctx.fillRect(0, y, w, 3);
    ctx.strokeStyle = 'rgba(90,255,239,.25)'; ctx.lineWidth = 1;
    for (let x=0; x<w; x+=36) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
  } else if (currentEffect === 'sparkles' || currentEffect === 'hearts') {
    const count = Math.max(12, Math.floor(w / 14));
    for (let i=0; i<count; i++) {
      const x = ((i * 71 + Date.now() / (currentEffect === 'hearts' ? 45 : 28)) % (w + 20)) - 10;
      const y = (i * 47 + (Date.now() / (currentEffect === 'hearts' ? 65 : 90))) % (h + 20) - 10;
      const size = 2 + (i % 4);
      ctx.globalAlpha = .4 + ((i % 5) / 8);
      ctx.fillStyle = currentEffect === 'hearts' ? '#ff72c6' : (i % 2 ? '#fff7c2' : '#8dfaff');
      if (currentEffect === 'hearts') {
        ctx.font = `${size * 4}px sans-serif`; ctx.fillText('♥', x, y);
      } else {
        ctx.beginPath(); ctx.arc(x,y,size/2,0,Math.PI*2); ctx.fill();
        ctx.fillRect(x-size*1.5,y-.5,size*3,1);
        ctx.fillRect(x-.5,y-size*1.5,1,size*3);
      }
    }
    ctx.globalAlpha = 1;
  }
  if (stream) animationFrame = requestAnimationFrame(drawEffects);
}
function makeCaptureCanvas() {
  if (!video.videoWidth) return null;
  const out = document.createElement('canvas');
  out.width = video.videoWidth; out.height = video.videoHeight;
  const c = out.getContext('2d');
  c.save();
  if (facingMode === 'user') { c.translate(out.width, 0); c.scale(-1, 1); }
  c.filter = `${filterCSS[currentFilter]} brightness(${brightness}%) saturate(${saturation}%) contrast(${contrast}%)`;
  c.drawImage(video, 0, 0, out.width, out.height);
  c.restore();
  // Draw current live effect onto the saved photo at its original resolution.
  if (currentEffect !== 'none') {
    const oldW = canvas.width, oldH = canvas.height;
    const copy = document.createElement('canvas'); copy.width = oldW; copy.height = oldH;
    copy.getContext('2d').drawImage(canvas,0,0);
    c.drawImage(copy,0,0,out.width,out.height);
  }
  return out;
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function addCreation(blob, type, name) {
  const url = URL.createObjectURL(blob);
  creations.unshift({blob,url,type,name});
  renderGallery();
}
function renderGallery() {
  gallery.innerHTML = '';
  if (!creations.length) {
    gallery.appendChild(emptyGallery); emptyGallery.hidden = false;
  } else {
    emptyGallery.hidden = true;
    creations.forEach((item, index) => {
      const card = document.createElement('article'); card.className = 'media-item';
      const media = item.type === 'video' ? document.createElement('video') : document.createElement('img');
      media.className = 'media-thumb'; media.src = item.url;
      if (item.type === 'video') { media.controls = true; media.playsInline = true; }
      else media.alt = item.name;
      const info = document.createElement('div'); info.className = 'media-info';
      const label = document.createElement('span'); label.textContent = item.name;
      const actions = document.createElement('div'); actions.className = 'media-actions';
      const save = document.createElement('button'); save.textContent = '↓'; save.title = 'Télécharger';
      save.addEventListener('click', () => downloadBlob(item.blob, item.name));
      const remove = document.createElement('button'); remove.textContent = '×'; remove.title = 'Supprimer';
      remove.addEventListener('click', () => { URL.revokeObjectURL(item.url); creations.splice(index,1); renderGallery(); });
      actions.append(save, remove); info.append(label, actions); card.append(media, info); gallery.append(card);
    });
  }
  mediaCount.textContent = `${creations.length} création${creations.length === 1 ? '' : 's'}`;
}
startCameraBtn.addEventListener('click', startCamera);
switchCameraBtn.addEventListener('click', () => { facingMode = facingMode === 'user' ? 'environment' : 'user'; startCamera(); });
document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => {
  currentFilter = button.dataset.filter;
  document.querySelectorAll('.filter').forEach(b => b.classList.toggle('active', b === button));
  updateFilter();
}));
document.querySelectorAll('.effect-row').forEach(button => button.addEventListener('click', () => {
  currentEffect = button.dataset.effect;
  document.querySelectorAll('.effect-row').forEach(b => b.classList.toggle('active', b === button));
  if (stream) drawEffects();
}));
function bindSlider(id, key, outId, suffix='%') {
  document.querySelector(`#${id}`).addEventListener('input', e => {
    const value = Number(e.target.value);
    if (key === 'brightness') brightness = value;
    if (key === 'saturation') saturation = value;
    if (key === 'contrast') contrast = value;
    document.querySelector(`#${outId}`).textContent = `${value}${suffix}`;
    updateFilter();
  });
}
bindSlider('brightness','brightness','brightnessOut');
bindSlider('saturation','saturation','saturationOut');
bindSlider('contrast','contrast','contrastOut');
document.querySelector('#resetAdjustments').addEventListener('click', () => {
  brightness = saturation = contrast = 100;
  for (const id of ['brightness','saturation','contrast']) document.querySelector(`#${id}`).value = 100;
  for (const id of ['brightnessOut','saturationOut','contrastOut']) document.querySelector(`#${id}`).textContent = '100%';
  updateFilter(); showToast('Réglages réinitialisés.');
});
captureBtn.addEventListener('click', async () => {
  if (!stream) { showToast('Activez d’abord la caméra.'); return; }
  const shot = makeCaptureCanvas();
  if (!shot) return;
  shot.toBlob(blob => {
    if (!blob) return showToast('La photo n’a pas pu être créée.');
    const name = `prismacam-${Date.now()}.jpg`;
    addCreation(blob, 'image', name); showToast('Photo ajoutée à votre galerie !');
  }, 'image/jpeg', .94);
});
recordBtn.addEventListener('click', () => {
  if (!stream) { showToast('Activez d’abord la caméra.'); return; }
  if (recording) { mediaRecorder.stop(); return; }
  if (!window.MediaRecorder) { showToast('L’enregistrement vidéo n’est pas pris en charge ici.'); return; }
  let videoStream;
  try {
    // Capture the filtered camera preview through a canvas stream so video includes color filters and effects.
    const recordCanvas = document.createElement('canvas');
    recordCanvas.width = video.videoWidth || 1280; recordCanvas.height = video.videoHeight || 960;
    const rctx = recordCanvas.getContext('2d');
    const paint = () => {
      if (!recording && !mediaRecorder) return;
      rctx.save();
      if (facingMode === 'user') { rctx.translate(recordCanvas.width,0); rctx.scale(-1,1); }
      rctx.filter = `${filterCSS[currentFilter]} brightness(${brightness}%) saturate(${saturation}%) contrast(${contrast}%)`;
      rctx.drawImage(video,0,0,recordCanvas.width,recordCanvas.height); rctx.restore();
      // Add a lightweight overlay by scaling the live effect canvas.
      if (currentEffect !== 'none') rctx.drawImage(canvas,0,0,recordCanvas.width,recordCanvas.height);
      if (recording) requestAnimationFrame(paint);
    };
    recording = true; paint();
    videoStream = recordCanvas.captureStream(24);
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' :
      (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '');
    mediaRecorder = new MediaRecorder(videoStream, mime ? {mimeType:mime} : undefined);
    recordedChunks = [];
    mediaRecorder.ondataavailable = e => { if (e.data.size) recordedChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      recording = false;
      const blob = new Blob(recordedChunks, {type: mediaRecorder.mimeType || 'video/webm'});
      const name = `prismacam-${Date.now()}.webm`;
      addCreation(blob, 'video', name);
      videoStream.getTracks().forEach(t => t.stop());
      mediaRecorder = null; recordBtn.classList.remove('recording'); recordLabel.textContent = 'Vidéo';
      showToast('Vidéo enregistrée dans votre galerie !');
    };
    mediaRecorder.start(250);
    recordBtn.classList.add('recording'); recordLabel.textContent = 'Arrêter';
    showToast('Enregistrement en cours…');
  } catch (e) {
    console.error(e); recording = false; mediaRecorder = null;
    showToast('Impossible de démarrer la vidéo sur ce navigateur.');
  }
});
document.querySelector('#galleryBtn').addEventListener('click', () => {
  fileInput.click();
});
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0]; if (!file) return;
  const type = file.type.startsWith('video/') ? 'video' : 'image';
  addCreation(file, type, file.name || `import-${Date.now()}`);
  showToast('Fichier ajouté à votre galerie.');
  fileInput.value = '';
});
window.addEventListener('resize', resizeCanvas);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.warn));
}
let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); installPrompt = e; document.querySelector('#installBtn').hidden = false;
});
document.querySelector('#installBtn').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null;
  document.querySelector('#installBtn').hidden = true;
});
updateFilter();
