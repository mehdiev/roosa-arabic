// ═══════════════════════════════════════════════════════
//  Roosa's Arabic — app.js
//  Reads: window.WORDS, window.CONVERSATIONS, window.SCRAMBLE, window.PATTERNS
// ═══════════════════════════════════════════════════════

/* ── ARABIC ALPHABET ── */
const ALPHABET = [
  {ar:'ا',name:'Alif',sound:'a / ā'},{ar:'ب',name:'Ba',sound:'b'},{ar:'ت',name:'Ta',sound:'t'},{ar:'ث',name:'Tha',sound:'th'},
  {ar:'ج',name:'Jeem',sound:'j'},{ar:'ح',name:'Ha',sound:'ḥ'},{ar:'خ',name:'Kha',sound:'kh'},{ar:'د',name:'Dal',sound:'d'},
  {ar:'ذ',name:'Dhal',sound:'dh'},{ar:'ر',name:'Ra',sound:'r'},{ar:'ز',name:'Zay',sound:'z'},{ar:'س',name:'Seen',sound:'s'},
  {ar:'ش',name:'Sheen',sound:'sh'},{ar:'ص',name:'Sad',sound:'ṣ'},{ar:'ض',name:'Dad',sound:'ḍ'},{ar:'ط',name:'Ta',sound:'ṭ'},
  {ar:'ظ',name:'Dha',sound:'ẓ'},{ar:'ع',name:'Ain',sound:"ʿ"},{ar:'غ',name:'Ghain',sound:'gh'},{ar:'ف',name:'Fa',sound:'f'},
  {ar:'ق',name:'Qaf',sound:'q'},{ar:'ك',name:'Kaf',sound:'k'},{ar:'ل',name:'Lam',sound:'l'},{ar:'م',name:'Meem',sound:'m'},
  {ar:'ن',name:'Noon',sound:'n'},{ar:'ه',name:'Ha',sound:'h'},{ar:'و',name:'Waw',sound:'w / ū'},{ar:'ي',name:'Ya',sound:'y / ī'}
];

/* ── STATE ── */
let stats = JSON.parse(localStorage.getItem('roosa_stats') || '{"learned":0,"correct":0,"streak":0,"lastDate":""}');
function saveStats(){ localStorage.setItem('roosa_stats', JSON.stringify(stats)); }

/* ── RIPPLE ── */
function addRipple(el, e){
  const r = document.createElement('span');
  const rect = el.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  r.className = 'ripple-effect';
  r.style.cssText = `width:${size}px;height:${size}px;left:${(e.clientX-rect.left)-size/2}px;top:${(e.clientY-rect.top)-size/2}px`;
  el.appendChild(r);
  r.addEventListener('animationend', ()=>r.remove());
}
document.addEventListener('click', e=>{
  const t = e.target.closest('.fc-btn,.sc-btn,.quiz-restart,.quiz-next,.tab-pill,.qmode-btn,.home-card');
  if(t) addRipple(t, e);
});

/* ── SPEAK ICON ANIMATION ── */
function speakAnimated(el, text){
  speak(text);
  if(el){ el.classList.add('speaking'); setTimeout(()=>el.classList.remove('speaking'), 600); }
}

/* ── CONFETTI ── */
function confetti(){
  const colors = ['#0284c7','#67e8f9','#0ea5e9','#bae6fd','#6366f1','#cffafe'];
  for(let i=0;i<28;i++){
    const c = document.createElement('div');
    c.style.cssText = `position:fixed;top:${Math.random()*40}%;left:${Math.random()*100}%;width:${6+Math.random()*8}px;height:${6+Math.random()*8}px;background:${colors[i%colors.length]};border-radius:${Math.random()>0.5?'50%':'2px'};pointer-events:none;z-index:9999;animation:confettiFall ${.8+Math.random()*.8}s ease forwards;animation-delay:${Math.random()*.4}s`;
    document.body.appendChild(c);
    c.addEventListener('animationend', ()=>c.remove());
  }
}

/* ── COUNTER ANIMATION ── */
function animateCount(el, target){
  const start = parseInt(el.textContent)||0;
  const dur = 600;
  const t0 = performance.now();
  function step(t){
    const p = Math.min((t-t0)/dur, 1);
    el.textContent = Math.round(start + (target-start)*p);
    if(p<1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function updateStreak(){
  const today = new Date().toDateString();
  if(stats.lastDate !== today){
    const yesterday = new Date(Date.now()-86400000).toDateString();
    stats.streak = stats.lastDate === yesterday ? stats.streak+1 : 1;
    stats.lastDate = today;
    saveStats();
  }
}
updateStreak();

/* ── NAVIGATION ── */
function showPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  document.querySelector(`.nav-tab[data-page="${id}"]`).classList.add('active');
  if(id==='home') renderHome();
  if(id==='vocab') renderVocab();
  if(id==='flashcards') initFlashcards();
  if(id==='speak') initSpeak();
  if(id==='quiz') initQuiz();
}
document.querySelectorAll('.nav-tab').forEach(t=>t.addEventListener('click',()=>showPage(t.dataset.page)));
document.querySelectorAll('.home-card[data-goto]').forEach(c=>c.addEventListener('click',()=>showPage(c.dataset.goto)));

/* ── HOME ── */
function renderHome(){
  animateCount(document.getElementById('stat-learned'), stats.learned);
  animateCount(document.getElementById('stat-correct'), stats.correct);
  animateCount(document.getElementById('stat-streak'), stats.streak);
}

/* ── SPEECH ── */
function speak(text, lang='ar-SA'){
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang; u.rate = 0.85; u.pitch = 1;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

/* ══════════════════════════════════════════════════════
   VOCAB PAGE
══════════════════════════════════════════════════════ */
const CATS = ['all','basics','greetings','numbers','time','family','body','food','drinks',
  'clothing','home','places','nature','weather','animals','transport','work',
  'school','health','sports','emotions','adjectives','colors','verbs','tech',
  'shopping','directions','expressions'];
let vocabCat = 'all', vocabPage = 1, vocabPer = 40;

function renderVocab(){
  renderCatTabs();
  renderVocabTable();
}

function renderCatTabs(){
  const row = document.getElementById('vocab-cats');
  row.innerHTML = CATS.map(c=>`<button class="tab-pill ${c===vocabCat?'active':''}" onclick="setVocabCat('${c}')">${c==='all'?'All ('+window.WORDS.length+')':c.charAt(0).toUpperCase()+c.slice(1)}</button>`).join('');
}

function setVocabCat(c){ vocabCat=c; vocabPage=1; renderVocab(); }

function renderVocabTable(){
  const words = vocabCat==='all' ? window.WORDS : window.WORDS.filter(w=>w.cat===vocabCat);
  const total = words.length;
  const pages = Math.ceil(total/vocabPer);
  if(vocabPage > pages) vocabPage = pages||1;
  const slice = words.slice((vocabPage-1)*vocabPer, vocabPage*vocabPer);

  document.getElementById('vocab-info').textContent = `${total} words · page ${vocabPage}/${pages}`;

  let rows = '';
  slice.forEach((w,i)=>{
    const hasEx = w.ex && w.ex.ar;
    rows += `<tr>
      <td class="ar">${w.ar}</td>
      <td>${w.en}</td>
      <td class="fi-col">${w.fi}</td>
      <td class="tr-col">${w.tr||''}</td>
      <td><span class="speak-icon" onclick="speak('${w.ar.replace(/'/g,"\\'")}')">🔊</span></td>
    </tr>`;
    if(hasEx){
      rows += `<tr class="ex-row"><td colspan="5"><div class="ex-bubble">
        <span class="ex-ar">${w.ex.ar}</span>
        <span class="ex-en">${w.ex.en}</span><br>
        <span class="ex-fi">${w.ex.fi}</span>
      </div></td></tr>`;
    }
  });

  document.getElementById('vocab-tbody').innerHTML = rows;

  // pagination
  let pag = '';
  for(let p=1;p<=pages;p++){
    pag += `<button class="tab-pill ${p===vocabPage?'active':''}" style="min-width:36px" onclick="setVocabPage(${p})">${p}</button>`;
  }
  document.getElementById('vocab-pag').innerHTML = pag;

  const prog = (vocabPage/pages)*100;
  document.getElementById('vocab-prog').style.width = prog+'%';
}

function setVocabPage(p){ vocabPage=p; renderVocabTable(); window.scrollTo(0,0); }

/* ── ALPHABET tab inside vocab ── */
let vocabTab = 'words';
function setVocabTab(t){
  vocabTab = t;
  document.querySelectorAll('.vtab-pill').forEach(p=>p.classList.toggle('active', p.dataset.t===t));
  document.getElementById('vocab-words-panel').style.display = t==='words' ? '' : 'none';
  document.getElementById('vocab-alpha-panel').style.display = t==='alpha' ? '' : 'none';
  if(t==='alpha') renderAlphabet();
}

function renderAlphabet(){
  const grid = document.getElementById('alpha-grid');
  grid.innerHTML = ALPHABET.map((l,i)=>`
    <div class="letter-card" style="animation:fadeSlideIn .25s ${i*.03}s both" onclick="playLetter(this,'${l.ar}')">
      <div class="arabic">${l.ar}</div>
      <div class="name">${l.name}</div>
      <div class="sound">${l.sound}</div>
    </div>`).join('');
}
function playLetter(el, ar){
  speak(ar);
  el.classList.remove('played'); void el.offsetWidth; el.classList.add('played');
  setTimeout(()=>el.classList.remove('played'), 500);
}

/* ══════════════════════════════════════════════════════
   FLASHCARDS PAGE
══════════════════════════════════════════════════════ */
let fcWords = [], fcIndex = 0, fcFlipped = false, fcCorrect = 0, fcTotal = 0;

function initFlashcards(){
  const sel = document.getElementById('fc-cat-sel');
  if(!sel.dataset.built){
    const opts = ['<option value="all">All words</option>'];
    CATS.filter(c=>c!=='all').forEach(c=>opts.push(`<option value="${c}">${c.charAt(0).toUpperCase()+c.slice(1)}</option>`));
    sel.innerHTML = opts.join('');
    sel.dataset.built = '1';
    sel.addEventListener('change', shuffleFlashcards);
  }
  shuffleFlashcards();
}

function shuffleFlashcards(){
  const cat = document.getElementById('fc-cat-sel').value;
  let pool = cat==='all' ? [...window.WORDS] : window.WORDS.filter(w=>w.cat===cat);
  fcWords = shuffle(pool);
  fcIndex = 0; fcFlipped = false; fcCorrect = 0; fcTotal = 0;
  document.getElementById('fc-card').classList.remove('flipped');
  renderFlashcard();
}

function renderFlashcard(){
  if(!fcWords.length) return;
  const w = fcWords[fcIndex];
  document.getElementById('fc-ar').textContent = w.ar;
  document.getElementById('fc-en').textContent = w.en;
  document.getElementById('fc-fi').textContent = w.fi;
  document.getElementById('fc-tr').textContent = w.tr||'';
  document.getElementById('fc-cat').textContent = w.cat;
  const prog = fcTotal > 0 ? (fcIndex/fcWords.length)*100 : 0;
  document.getElementById('fc-prog').style.width = prog+'%';
  document.getElementById('fc-counter').textContent = `${fcIndex+1} / ${fcWords.length}`;
  document.getElementById('fc-score').textContent = `✓ ${fcCorrect}`;
  fcFlipped = false;
  const card = document.getElementById('fc-card');
  card.classList.remove('flipped','new-card');
  void card.offsetWidth; // reflow
  card.classList.add('new-card');
}

function flipCard(){
  fcFlipped = !fcFlipped;
  document.getElementById('fc-card').classList.toggle('flipped', fcFlipped);
}

function markCard(correct){
  if(!fcFlipped){ flipCard(); return; }
  if(correct){ fcCorrect++; stats.correct++; saveStats(); }
  stats.learned = Math.max(stats.learned, fcIndex+1);
  saveStats();
  fcTotal++;
  fcIndex = (fcIndex+1) % fcWords.length;
  if(fcIndex === 0){ showFcDone(); return; }
  renderFlashcard();
}

function showFcDone(){
  const pct = Math.round(fcCorrect/fcWords.length*100);
  document.getElementById('fc-card-wrap').innerHTML = `
    <div style="text-align:center;padding:32px">
      <div style="font-size:54px;font-weight:800;color:var(--rose)">${pct}%</div>
      <div style="font-size:18px;font-weight:700;margin:8px 0">Great job!</div>
      <div style="color:var(--g500);font-size:14px;margin-bottom:18px">${fcCorrect}/${fcWords.length} correct</div>
      <button onclick="shuffleFlashcards()" style="padding:9px 24px;background:var(--rose);color:white;border:none;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer">Again 🔄</button>
    </div>`;
}

function speakCurrent(){
  if(fcWords.length) speak(fcWords[fcIndex].ar);
}

/* ══════════════════════════════════════════════════════
   SPEAK PAGE  (Dialogues · Patterns · Scramble)
══════════════════════════════════════════════════════ */
let speakTab = 'conv', convIndex = 0, scrIndex = 0, scrAnswer = [], scrBank = [];
let speakReady = false;

function initSpeak(){
  if(speakReady) return;
  speakReady = true;
  renderConv();
}

// sub-tab switch
function setSpeakTab(t){
  speakTab=t;
  document.querySelectorAll('.stab-pill').forEach(p=>p.classList.toggle('active',p.dataset.t===t));
  ['conv','patt','scram'].forEach(id=>{
    document.getElementById('speak-'+id).style.display = id===t ? '' : 'none';
  });
  if(t==='conv') renderConv();
  if(t==='patt') renderPatterns();
  if(t==='scram') renderScramble();
}

/* ── CONVERSATIONS ── */
function buildConvTabs(){
  return window.CONVERSATIONS.map((c,i)=>
    `<button class="tab-pill ${i===convIndex?'active':''}" onclick="setConv(${i})" style="font-size:11px">${c.title}</button>`
  ).join('');
}

function renderConv(){
  document.getElementById('conv-tabs').innerHTML = buildConvTabs();
  const cv = window.CONVERSATIONS[convIndex];
  let html = `<div style="font-size:12px;color:var(--g500);margin-bottom:16px;background:var(--amber-l);padding:8px 12px;border-radius:8px">${cv.situation}</div>`;
  html += `<div class="dialogue">`;
  cv.lines.forEach(ln=>{
    html += `<div class="dial-line ${ln.side}">
      <div>
        <div class="speaker-lbl">${ln.speaker}</div>
        <div class="bubble">
          <span class="b-ar">${ln.ar}</span>
          <span class="b-tr">${ln.tr}</span>
          <span class="b-en">${ln.en}</span>
          <span class="b-fi">${ln.fi}</span>
        </div>
      </div>
      <span class="b-spk" onclick="speak('${ln.ar.replace(/'/g,"\\'")}')">🔊</span>
    </div>`;
  });
  html += '</div>';
  document.getElementById('conv-body').innerHTML = html;
}

function setConv(i){ convIndex=i; renderConv(); }

/* ── PATTERNS ── */
function renderPatterns(){
  let html = '';
  window.PATTERNS.forEach(p=>{
    html += `<div class="pattern-card">
      <div class="pattern-title">${p.title}</div>
      <div class="pattern-note">${p.note}</div>
      <div class="pattern-examples">
        ${p.examples.map(e=>`<div class="pex">
          <span class="p-ar">${e.ar}</span>
          <span class="p-en">${e.en}</span>
          <span class="p-fi">${e.fi}</span>
          <span class="speak-icon" onclick="speak('${e.ar.replace(/'/g,"\\'")}')">🔊</span>
        </div>`).join('')}
      </div>
    </div>`;
  });
  document.getElementById('patt-body').innerHTML = html;
}

/* ── SCRAMBLE ── */
let scrPool = [], scrDone = 0, scrCorrectCount = 0;

function initScramble(){
  scrPool = shuffle([...window.SCRAMBLE]);
  scrIndex = 0; scrDone = 0; scrCorrectCount = 0;
  loadScrambleSentence();
}

function loadScrambleSentence(){
  if(scrIndex >= scrPool.length){ showScrDone(); return; }
  const s = scrPool[scrIndex];
  scrAnswer = [];
  scrBank = shuffle([...s.words]);
  renderScramble();
}

function renderScramble(){
  const s = scrPool[scrIndex];
  document.getElementById('scr-score').innerHTML = `Sentence <span>${scrIndex+1}</span>/${scrPool.length} · Correct: <span>${scrCorrectCount}</span>`;
  document.getElementById('scr-en').textContent = s.en;
  document.getElementById('scr-fi').textContent = s.fi;
  document.getElementById('scr-note').textContent = s.note || '';
  document.getElementById('scr-feedback').className = 'sc-feedback';
  document.getElementById('scr-feedback').textContent = '';

  // answer zone
  const ans = document.getElementById('scr-answer');
  ans.className = 'sc-answer';
  ans.innerHTML = scrAnswer.map((w,i)=>
    `<span class="wchip placed" onclick="returnToBank(${i})">${w}</span>`
  ).join('');

  // word bank
  const bank = document.getElementById('scr-bank');
  bank.innerHTML = scrBank.map((w,i)=>
    `<span class="wchip" onclick="placeWord(${i})">${w}</span>`
  ).join('');
}

function placeWord(i){
  scrAnswer.push(scrBank[i]);
  scrBank.splice(i,1);
  renderScramble();
}

function returnToBank(i){
  scrBank.push(scrAnswer[i]);
  scrAnswer.splice(i,1);
  renderScramble();
}

function clearAnswer(){
  scrBank = [...scrBank, ...scrAnswer];
  scrAnswer = [];
  renderScramble();
}

function checkScramble(){
  const s = scrPool[scrIndex];
  const correct = JSON.stringify(scrAnswer) === JSON.stringify(s.words);
  const fb = document.getElementById('scr-feedback');
  const ans = document.getElementById('scr-answer');
  if(correct){
    fb.className='sc-feedback show ok';
    fb.innerHTML = `✓ Correct! "${s.note || s.words.join(' ')}"`;
    ans.classList.add('ok');
    scrCorrectCount++;
  } else {
    fb.className='sc-feedback show err';
    fb.innerHTML = `✗ Not quite. Answer: <span style="font-family:'Amiri',serif;font-size:18px;direction:rtl"> ${s.words.join(' ')} </span>`;
    ans.classList.add('err');
  }
  scrDone++;
  setTimeout(()=>{ scrIndex++; loadScrambleSentence(); }, 2200);
}

function skipScramble(){
  scrIndex++;
  loadScrambleSentence();
}

function showScrDone(){
  const pct = Math.round(scrCorrectCount/scrDone*100)||0;
  document.getElementById('scr-body').innerHTML = `
    <div style="text-align:center;padding:40px 0">
      <div style="font-size:52px;font-weight:800;color:var(--rose)">${pct}%</div>
      <div style="font-size:18px;font-weight:700;margin:8px 0">Round complete!</div>
      <div style="color:var(--g500);margin-bottom:18px;font-size:14px">${scrCorrectCount}/${scrDone} correct</div>
      <button onclick="initScramble()" style="padding:9px 24px;background:var(--rose);color:white;border:none;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer">Play again 🔄</button>
    </div>`;
}

/* ══════════════════════════════════════════════════════
   QUIZ PAGE
══════════════════════════════════════════════════════ */
const QUIZ_MODES = ['ar→en','ar→fi','en→ar','fi→ar'];
let qMode = 'ar→en', qPool = [], qIndex = 0, qCorrect = 0, qAnswered = false;

function initQuiz(){
  if(!window.quizInited){
    window.quizInited = true;
    renderQuizModes();
  }
  startQuiz();
}

function renderQuizModes(){
  document.getElementById('quiz-modes').innerHTML = QUIZ_MODES.map(m=>
    `<button class="qmode-btn ${m===qMode?'active':''}" onclick="setQuizMode('${m}')">${m}</button>`
  ).join('');
}

function setQuizMode(m){
  qMode=m;
  document.querySelectorAll('.qmode-btn').forEach(b=>b.classList.toggle('active',b.textContent===m));
  startQuiz();
}

function startQuiz(){
  qPool = shuffle([...window.WORDS]).slice(0,100); // draw 100 each session
  qIndex = 0; qCorrect = 0;
  showQuestion();
}

function showQuestion(){
  if(qIndex >= qPool.length){ showQuizDone(); return; }
  qAnswered = false;
  const w = qPool[qIndex];
  document.getElementById('quiz-fb').className = 'quiz-fb';
  document.getElementById('quiz-next').className = 'quiz-next';
  document.getElementById('quiz-counter').textContent = qIndex+1;
  document.getElementById('quiz-total').textContent = qPool.length;
  document.getElementById('quiz-score').textContent = qCorrect;
  document.getElementById('quiz-done-screen').style.display='none';
  document.getElementById('quiz-q-wrap').style.display='';

  const [prompt, opts, isAr] = buildQuestion(w);
  document.getElementById('quiz-qlbl').textContent = qMode;
  const pEl = document.getElementById('quiz-prompt');
  pEl.textContent = prompt;
  pEl.className = isAr ? 'quiz-prompt' : 'quiz-prompt en';
  document.getElementById('quiz-tr').textContent = isAr ? (w.tr||'') : '';

  document.getElementById('quiz-opts').innerHTML = opts.map(o=>
    `<button class="qopt ${o.ar?'ar-opt':''}" onclick="pickAnswer(this,'${escQ(o.val)}','${escQ(w[o.answerKey])}')">${o.label}</button>`
  ).join('');
}

function escQ(s){ return (s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

function buildQuestion(w){
  // pick 3 distractors
  const pool = window.WORDS.filter(x=>x!==w);
  const dist = shuffle(pool).slice(0,3);

  if(qMode==='ar→en'){
    const opts = shuffle([w,...dist]).map(x=>({label:x.en,val:x.en,answerKey:'en'}));
    return [w.ar, opts, true];
  } else if(qMode==='ar→fi'){
    const opts = shuffle([w,...dist]).map(x=>({label:x.fi,val:x.fi,answerKey:'fi'}));
    return [w.ar, opts, true];
  } else if(qMode==='en→ar'){
    const opts = shuffle([w,...dist]).map(x=>({label:x.ar,val:x.ar,answerKey:'ar',ar:true}));
    return [w.en, opts, false];
  } else { // fi→ar
    const opts = shuffle([w,...dist]).map(x=>({label:x.ar,val:x.ar,answerKey:'ar',ar:true}));
    return [w.fi, opts, false];
  }
}

function pickAnswer(btn, val, correctVal){
  if(qAnswered) return;
  qAnswered = true;
  const correct = val === correctVal;
  if(correct){ qCorrect++; stats.correct++; saveStats();
    const sc = document.getElementById('quiz-score');
    sc.textContent = qCorrect;
    sc.classList.remove('bump'); void sc.offsetWidth; sc.classList.add('bump');
  }
  btn.classList.add(correct?'correct':'wrong');
  document.querySelectorAll('.qopt').forEach(b=>{
    b.disabled = true;
    if(b.textContent.trim() === correctVal || b.getAttribute('onclick').includes(escQ(correctVal))){
      b.classList.add('correct');
    }
  });
  const fb = document.getElementById('quiz-fb');
  const w = qPool[qIndex];
  fb.className = `quiz-fb show ${correct?'ok':'err'}`;
  fb.innerHTML = correct
    ? `✓ Correct! &nbsp;<span style="font-family:'Amiri',serif;font-size:18px">${w.ar}</span> = ${w.en} (${w.fi})`
    : `✗ <span style="font-family:'Amiri',serif;font-size:18px">${w.ar}</span> = ${w.en} (${w.fi})`;
  document.getElementById('quiz-next').className = 'quiz-next show';
}

function nextQuestion(){ qIndex++; showQuestion(); }

function showQuizDone(){
  document.getElementById('quiz-q-wrap').style.display='none';
  document.getElementById('quiz-done-screen').style.display='';
  const pct = Math.round(qCorrect/qPool.length*100);
  animateCount(document.getElementById('quiz-pct'), pct);
  document.getElementById('quiz-pct').textContent; // ensure visible before confetti
  setTimeout(()=>{ document.getElementById('quiz-pct').textContent = pct+'%'; }, 650);
  document.getElementById('quiz-done-msg').textContent = pct>=80?'Mahtavaa! Amazing work! 🎉':pct>=60?'Keep it up! Jatka niin! 💪':'Practice makes perfect! 📚';
  document.getElementById('quiz-done-sub').textContent = `${qCorrect} / ${qPool.length} correct`;
  if(pct >= 60) confetti();
}

/* ── UTILITY ── */
function shuffle(a){
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

/* ── INIT ── */
renderHome();
