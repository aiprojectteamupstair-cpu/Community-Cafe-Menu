const imageVersion = '20261021';
const files = ['Cover.jpg', ...Array.from({length:19},(_,i)=>`${i+1}.jpg`), 'BACK-Cover.jpg']
  .map(src => `${src}?v=${imageVersion}`);
const lastPage = files.length - 1;
const menuPageCount = files.length - 2;
const $ = id => document.getElementById(id);
const mobile = matchMedia('(max-width:700px)');
const reducedMotion = matchMedia('(prefers-reduced-motion:reduce)');
const flipAudio = new Audio('page-flip-trimmed.wav');
flipAudio.preload = 'auto'; flipAudio.volume = .72;
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const audioContext = AudioContextClass ? new AudioContextClass({latencyHint:'interactive'}) : null;
let paperBuffer = null;
const audioReady = audioContext ? fetch('page-flip-trimmed.wav')
  .then(response => { if (!response.ok) throw new Error('Sound unavailable'); return response.arrayBuffer(); })
  .then(bytes => audioContext.decodeAudioData(bytes))
  .then(buffer => { paperBuffer = buffer; })
  .catch(()=>{}) : Promise.resolve();
function unlockAudio() { if (audioContext?.state === 'suspended') audioContext.resume().catch(()=>{}); }
let current = 0, busy = false, gesture = null;
const cache = files.map(src => { const image = new Image(); image.src = src; return image; });
const decoded = new Map();
function ready(index) {
  if (index < 0 || index >= files.length) return Promise.resolve();
  if (!decoded.has(index)) decoded.set(index, cache[index].decode().catch(() => { decoded.delete(index); }));
  return decoded.get(index);
}
function warmPages() {
  for (let index = Math.max(0,current-2); index <= Math.min(lastPage,current+3); index++) ready(index);
}
function sound(state,duration=.98) {
  if (state.soundStarted) return;
  state.soundStarted = true;
  if (paperBuffer && audioContext?.state === 'running') {
    const source = audioContext.createBufferSource();
    source.buffer = paperBuffer;
    // Stretch the short paper rustle to follow the remaining turn.
    source.playbackRate.value = Math.max(.6,Math.min(1.8,paperBuffer.duration/duration));
    const gain = audioContext.createGain(); gain.gain.value = .72;
    source.connect(gain); gain.connect(audioContext.destination);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    source.start(audioContext.currentTime);
  } else { flipAudio.currentTime = 0; flipAudio.play().catch(()=>{}); }
}
function targetFor(direction) {
  if (mobile.matches) return current + direction;
  return direction > 0 ? current === 0 ? 1 : current + 2 : current <= 1 ? 0 : current - 2;
}
function setImage(id,index) {
  const image = $(id);
  if (index >= 0 && index < files.length) { image.src = files[index]; image.style.visibility = 'visible'; image.alt = index === 0 ? 'The Community Café menu cover' : index === lastPage ? 'The Community Café menu back cover' : `Café menu page ${index}`; }
  else { image.removeAttribute('src'); image.style.visibility = 'hidden'; image.alt = ''; }
}
function render() {
  $('book').classList.toggle('closed',current === 0);
  if (mobile.matches || current === 0) { setImage('right-image',current); setImage('left-image',-1); }
  else { setImage('left-image',current); setImage('right-image',current+1); }
  $('previous').disabled = current === 0; $('next').disabled = targetFor(1) >= files.length;
  $('page-status').textContent = current === 0 ? 'Menu cover' : current === lastPage ? 'Menu back cover' : mobile.matches ? `Menu page ${current} of ${menuPageCount}` : current+1 === lastPage ? `Menu page ${current} of ${menuPageCount} and back cover` : `Menu pages ${current} and ${current+1} of ${menuPageCount}`;
  warmPages();
}
function prepare(direction) {
  const target = targetFor(direction);
  if (busy || target < 0 || target >= files.length) return null;
  const forward = direction > 0;
  if (mobile.matches) {
    setImage('front-image',forward ? current : target); setImage('back-image',forward ? target : current);
    if (forward) setImage('right-image',target);
  } else {
    setImage('front-image',forward ? current === 0 ? 0 : current+1 : target === 0 ? 0 : target+1);
    setImage('back-image',forward ? target : current);
    if (current === 0 && forward) { $('book').classList.remove('closed'); setImage('left-image',-1); }
    if (forward) setImage('right-image',target+1); else setImage('left-image',target === 0 ? -1 : target);
  }
  const state = {direction,target,progress:0};
  showProgress(state);
  $('book').classList.add('turning');
  $('leaf').classList.add('active');
  return state;
}
function showProgress(state) {
  const angle = state.direction > 0 ? -180*state.progress : -180+180*state.progress;
  const lift = Math.sin(state.progress*Math.PI);
  $('leaf').style.transform = `rotateY(${angle}deg) rotateZ(${lift * (state.direction > 0 ? -.65 : .65)}deg)`;
  $('leaf').style.setProperty('--curl',lift);
  $('book').style.setProperty('--right-shadow',Math.max(0,Math.sin((angle+180)*Math.PI/180))*.32);
  $('book').style.setProperty('--left-shadow',lift*.24);
}
async function finish(state,commit) {
  if (!state) return;
  busy = true;
  const end = commit ? 1 : 0;
  if (!reducedMotion.matches) {
    const startProgress = state.progress;
    const duration = Math.max(220,980*Math.abs(end-startProgress));
    await new Promise(resolve => {
      let start;
      function frame(time) {
        if (start === undefined && commit) sound(state,duration/1000);
        start ??= time;
        const elapsed = Math.min(1,(time-start)/duration);
        // A gentle acceleration and a soft landing, shared by the page and shadows.
        const eased = elapsed*elapsed*(3-2*elapsed);
        state.progress = startProgress+(end-startProgress)*eased;
        showProgress(state);
        if (elapsed < 1) requestAnimationFrame(frame); else resolve();
      }
      requestAnimationFrame(frame);
    });
  } else if (commit) sound(state);
  if (commit) current = state.target;
  render();
  $('leaf').classList.remove('active'); $('book').classList.remove('turning');
  $('book').style.removeProperty('--right-shadow'); $('book').style.removeProperty('--left-shadow');
  $('leaf').style.transform = ''; busy = false;
}
async function turn(direction) {
  if (busy || gesture) return;
  const target = targetFor(direction);
  if (target < 0 || target >= files.length) return;
  busy = true;
  unlockAudio();
  await Promise.all([audioReady,ready(current),ready(current+1),ready(target),ready(target+1)]);
  busy = false;
  const state = prepare(direction);
  if (state) finish(state,true);
}
// A finger, pen, or mouse drags the leaf directly; taps turn the page halves.
$('book').addEventListener('pointerdown',event => {
  if (busy || gesture || !event.isPrimary || event.button !== 0) return;
  unlockAudio();
  const bounds = $('book').getBoundingClientRect();
  gesture = {id:event.pointerId,x:event.clientX,y:event.clientY,width:mobile.matches ? bounds.width : bounds.width/2,tapDirection:event.clientX < bounds.left+bounds.width/2 ? -1 : 1,state:null};
  $('book').setPointerCapture(event.pointerId);
});
$('book').addEventListener('pointermove',event => {
  if (!gesture || gesture.id !== event.pointerId || busy) return;
  const dx = event.clientX-gesture.x, dy = event.clientY-gesture.y;
  if (!gesture.state && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) gesture.state = prepare(dx < 0 ? 1 : -1);
  if (gesture.state) { gesture.state.progress = Math.min(.97,Math.max(0,(gesture.state.direction > 0 ? -dx : dx)/gesture.width)); if (gesture.state.progress > 0) sound(gesture.state); showProgress(gesture.state); }
});
function release(event,cancelled=false) {
  if (!gesture || gesture.id !== event.pointerId) return;
  const saved = gesture; gesture = null;
  if ($('book').hasPointerCapture(event.pointerId)) $('book').releasePointerCapture(event.pointerId);
  if (saved.state) finish(saved.state,!cancelled && saved.state.progress > .16);
  else if (!cancelled && Math.hypot(event.clientX-saved.x,event.clientY-saved.y) < 12) turn(saved.tapDirection);
}
$('book').addEventListener('pointerup',event => release(event));
$('book').addEventListener('pointercancel',event => release(event,true));
$('previous').addEventListener('click',event => { if (event.detail === 0) turn(-1); });
$('next').addEventListener('click',event => { if (event.detail === 0) turn(1); });
 document.addEventListener('keydown',event => { if (event.altKey || event.ctrlKey || event.metaKey) return; if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); turn(event.key === 'ArrowRight' ? 1 : -1); } });
mobile.addEventListener('change',()=>{ if (!busy && !gesture) { if (!mobile.matches && current > 0 && current % 2 === 0) current--; render(); } });
render();
