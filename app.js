const files = ['Cover.jpg', ...Array.from({length:19},(_,i)=>`${i+1}.jpg`)];
const $ = id => document.getElementById(id);
const mobile = matchMedia('(max-width:700px)');
const reducedMotion = matchMedia('(prefers-reduced-motion:reduce)');
const flipAudio = new Audio('page-flip.wav');
flipAudio.preload = 'auto'; flipAudio.volume = .72;
let current = 0, busy = false, gesture = null;
const cache = files.map(src => { const image = new Image(); image.src = src; return image; });
function sound() { flipAudio.currentTime = 0; flipAudio.play().catch(()=>{}); }
function targetFor(direction) {
  if (mobile.matches) return current + direction;
  return direction > 0 ? current === 0 ? 1 : current + 2 : current <= 1 ? 0 : current - 2;
}
function setImage(id,index) {
  const image = $(id);
  if (index >= 0 && index < files.length) { image.src = files[index]; image.style.visibility = 'visible'; image.alt = index === 0 ? 'The Community Café menu cover' : `Café menu page ${index}`; }
  else { image.removeAttribute('src'); image.style.visibility = 'hidden'; image.alt = ''; }
}
function render() {
  $('book').classList.toggle('closed',current === 0);
  if (mobile.matches || current === 0) { setImage('right-image',current); setImage('left-image',-1); }
  else { setImage('left-image',current); setImage('right-image',current+1); }
  $('previous').disabled = current === 0; $('next').disabled = targetFor(1) >= files.length;
  $('page-status').textContent = current === 0 ? 'Menu cover' : mobile.matches || current === 19 ? `Menu page ${current} of 19` : `Menu pages ${current} and ${current+1} of 19`;
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
  $('leaf').classList.add('active');
  return {direction,target,progress:0};
}
function showProgress(state) {
  const angle = state.direction > 0 ? -180*state.progress : -180+180*state.progress;
  $('leaf').style.transform = `rotateY(${angle}deg)`;
  $('leaf').style.filter = `brightness(${1-Math.sin(state.progress*Math.PI)*.25})`;
}
async function finish(state,commit) {
  if (!state) return;
  busy = true; if (commit) sound();
  const end = commit ? 1 : 0;
  const startAngle = state.direction > 0 ? -180*state.progress : -180+180*state.progress;
  const endAngle = state.direction > 0 ? -180*end : -180+180*end;
  if (!reducedMotion.matches) {
    const animation = $('leaf').animate([{transform:`rotateY(${startAngle}deg)`},{transform:`rotateY(${endAngle}deg)`}],{duration:Math.max(180,760*Math.abs(end-state.progress)),easing:'cubic-bezier(.25,.1,.25,1)',fill:'forwards'});
    try { await animation.finished; } catch (_) {}
    if (commit) current = state.target;
    render(); $('leaf').classList.remove('active'); animation.cancel();
  } else { if (commit) current = state.target; render(); $('leaf').classList.remove('active'); }
  $('leaf').style.transform = ''; $('leaf').style.filter = ''; busy = false;
}
function turn(direction) { const state = prepare(direction); if (state) { showProgress(state); finish(state,true); } }
// A finger, pen, or mouse drags the leaf directly; taps turn the page halves.
$('book').addEventListener('pointerdown',event => {
  if (busy || gesture || !event.isPrimary || event.button !== 0) return;
  const bounds = $('book').getBoundingClientRect();
  gesture = {id:event.pointerId,x:event.clientX,y:event.clientY,width:mobile.matches ? bounds.width : bounds.width/2,tapDirection:event.clientX < bounds.left+bounds.width/2 ? -1 : 1,state:null};
  $('book').setPointerCapture(event.pointerId);
});
$('book').addEventListener('pointermove',event => {
  if (!gesture || gesture.id !== event.pointerId || busy) return;
  const dx = event.clientX-gesture.x, dy = event.clientY-gesture.y;
  if (!gesture.state && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) gesture.state = prepare(dx < 0 ? 1 : -1);
  if (gesture.state) { gesture.state.progress = Math.min(.97,Math.max(0,(gesture.state.direction > 0 ? -dx : dx)/gesture.width)); showProgress(gesture.state); }
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
