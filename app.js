// Sudoku MVP+ Daily v2 su laikmačiu iki kito daily, pasirinktu daily lygiu ir suvestine
const boardEl = document.getElementById('board');
const newGameBtn = document.getElementById('newGameBtn');
const dailyBtn = document.getElementById('dailyBtn');
const historyBtn = document.getElementById('historyBtn');
const checkBtn = document.getElementById('checkBtn');
const hintBtn = document.getElementById('hintBtn');
const clearNotesBtn = document.getElementById('clearNotesBtn');
const difficultyEl = document.getElementById('difficulty');
const dailyDifficultyEl = document.getElementById('dailyDifficulty');
const livesEl = document.getElementById('lives');
const overlay = document.getElementById('overlay');
const overlayBtn = document.getElementById('overlayBtn');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const timeEl = document.getElementById('time');
const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const bestScoreEl = document.getElementById('bestScore');
const dailyTag = document.getElementById('dailyTag');
const countdownWrap = document.getElementById('dailyCountdown');
const countdownText = document.getElementById('countdownText');
const dailyOpts = document.getElementById('dailyOpts');

const historyModal = document.getElementById('historyModal');
const historyTable = document.getElementById('historyTable');
const closeHistory = document.getElementById('closeHistory');
const clearHistory = document.getElementById('clearHistory');

let puzzle = [];
let solution = [];
let cells = [];
let lives = 3;
let gameOver = false;
let score = 0;
let combo = 0;
let timer = null;
let secondsElapsed = 0;
let started = false;
let dailyMode = false;
let dailySeed = null;
let countdownTimer = null;

// Tools state
let inputMode = 'pencil'; // 'pencil' or 'marker'
let activeCell = null; // {r,c,cell,input,notes}

const pencilBtn = document.getElementById('pencilBtn');
const markerBtn = document.getElementById('markerBtn');
const eraserBtn = document.getElementById('eraserBtn');
const clearCellBtn = document.getElementById('clearCellBtn');

function setMode(mode){
  inputMode = mode;
  pencilBtn.classList.toggle('active', mode==='pencil');
  markerBtn.classList.toggle('active', mode==='marker');
}
pencilBtn.addEventListener('click', ()=> { setMode('pencil'); updateNumpadForActive(); });
markerBtn.addEventListener('click', ()=> { setMode('marker'); updateNumpadForActive(); });
eraserBtn.addEventListener('click', ()=> eraseActive());

function eraseActive(){
  if(!activeCell || gameOver) return;
  const {input,cell,notes} = activeCell;
  if(input.readOnly) return;
  input.value='';
  cell.classList.remove('invalid');
  input.dataset.lastWrong='';
  for(const n of notes.children) n.textContent='';
  afterErase();
}

clearCellBtn.addEventListener('click', eraseActive);

// Numpad
document.querySelectorAll('.numpad .n').forEach(btn => {
  btn.addEventListener('click', () => {
    const d = parseInt(btn.dataset.n,10);
    handleDigit(d);
  });
});


// Smart notes settings
const smartNotesChk = document.getElementById('smartNotes');
const autoSinglesChk = document.getElementById('autoSingles');

function peersOf(r,c){
  const peers = new Set();
  for(let i=0;i<9;i++){ if(i!==c) peers.add(`${r},${i}`); if(i!==r) peers.add(`${i},${c}`); }
  const br = Math.floor(r/3)*3, bc = Math.floor(c/3)*3;
  for(let i=0;i<3;i++) for(let j=0;j<3;j++){
    const rr = br+i, cc = bc+j;
    if(rr!==r || cc!==c) peers.add(`${rr},${cc}`);
  }
  return Array.from(peers).map(s => {
    const [rr,cc] = s.split(',').map(Number);
    return cells[rr*9+cc];
  });
}

function currentGridValue(r,c){
  const {input} = cells[r*9+c];
  const v = parseInt(input.value||'0',10);
  return v||0;
}

function isCandidateAllowedAt(r,c,d){
  // check row
  for(let i=0;i<9;i++){ if(i!==c && currentGridValue(r,i)===d) return false; }
  // col
  for(let i=0;i<9;i++){ if(i!==r && currentGridValue(i,c)===d) return false; }
  // box
  const br = Math.floor(r/3)*3, bc = Math.floor(c/3)*3;
  for(let i=0;i<3;i++) for(let j=0;j<3;j++){
    const rr=br+i, cc=bc+j;
    if((rr!==r || cc!==c) && currentGridValue(rr,cc)===d) return false;
  }
  return true;
}

function updateNotesConflicts(){
  for(const {r,c,input,notes} of cells){
    if(input.value) { // if cell filled, clear notes
      for(const n of notes.children){ n.textContent=''; n.classList.remove('invalid'); }
      continue;
    }
    for(let k=1;k<=9;k++){
      const node = notes.children[k-1];
      if(node.textContent){
        const ok = isCandidateAllowedAt(r,c,k);
        node.classList.toggle('invalid', !ok);
      }else{
        node.classList.remove('invalid');
      }
    }
  }
}

function smartEliminate(r,c,val){
  if(!smartNotesChk.checked) return;
  for(const peer of peersOf(r,c)){
    const node = peer.notes.children[val-1];
    if(node && node.textContent===''+val){
      node.textContent='';
      node.classList.remove('invalid');
    }
  }
}

function countNotes(notes){
  let cnt=0, last=0;
  for(let k=1;k<=9;k++){
    if(notes.children[k-1].textContent){ cnt++; last = k; }
  }
  return {cnt,last};
}

function autoFillSingles(){
  if(!autoSinglesChk.checked) return;
  for(const ref of cells){
    const {input,notes,r,c,cell} = ref;
    if(input.readOnly) continue;
    if(input.value) continue;
    const {cnt,last} = countNotes(notes);
    if(cnt===1){
      input.value = String(last);
      for(const n of notes.children) n.textContent='';
      validateCell(r,c,input,cell,true,true);
      // po užpildymo dar kartą pravalom peer pastabas
      smartEliminate(r,c,last);
    }
  }
}

// Run maintenance after any placement or erase
function afterPlacement(r,c,val){
  updateNotesConflicts();
  smartEliminate(r,c,val);
  autoFillSingles();
  updateNumpadForActive();
}

function afterErase(){
  updateNotesConflicts();
  autoFillSingles();
  updateNumpadForActive();
}


// === Rule guards & UI helpers ===
const toastEl = document.getElementById('toast');
let toastTimer = null;
function showToast(msg){
  if(!toastEl) return alert(msg);
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> toastEl.classList.add('hidden'), 1400);
}

function allowedDigitsForCell(r,c){
  const allowed = [];
  for(let d=1; d<=9; d++){
    if(isCandidateAllowedAt(r,c,d)) allowed.push(d);
  }
  return allowed;
}

function updateNumpadForActive(){
  const pad = document.querySelectorAll('.numpad .n');
  if(!activeCell){
    pad.forEach(b=> b.classList.remove('disabled'));
    return;
  }
  const {r,c,input} = activeCell;
  if(input.readOnly){
    pad.forEach(b=> b.classList.add('disabled'));
    return;
  }
  const allowed = new Set(allowedDigitsForCell(r,c));
  pad.forEach(b => {
    const d = parseInt(b.dataset.n,10);
    if(inputMode==='pencil'){
      b.classList.toggle('disabled', !allowed.has(d));
    }else{
      // marker: leidžiam tik teisiškai galimus
      b.classList.toggle('disabled', !allowed.has(d));
    }
  });
}

function flashCell(cell){
  cell.classList.add('flash');
  setTimeout(()=> cell.classList.remove('flash'), 300);
}

function handleDigit(d){
  if(!activeCell || gameOver) return;
  const {r,c,input,cell,notes} = activeCell;
  if(input.readOnly) return;
  if(inputMode==='pencil'){
    const idx = d-1;
    const t = notes.children[idx];
    t.textContent = t.textContent ? '' : String(d);
    vibrate(10);
  }else{
    input.value = String(d);
    for(const n of notes.children) n.textContent='';
    validateCell(r,c,input,cell,true,true);
  }
}

// When building, track active cell focus

const DIFF_CLUES = { easy:45, medium:36, hard:30, expert:24 };
const HISTORY_KEY = 'sudoku_daily_history';

// Vibracija
function vibrate(pattern){ if(navigator.vibrate){ navigator.vibrate(pattern); } }

// Seeded RNG
function xmur3(str){ for(var i=0,h=1779033703^str.length;i<str.length;i++){ h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return function(){ h = Math.imul(h ^ (h>>>16), 2246822507); h = Math.imul(h ^ (h>>>13), 3266489909); return (h ^= h>>>16) >>> 0; } }
function mulberry32(a){ return function(){ var t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; } }
function seededRandom(seedStr){ const seed = xmur3(seedStr)(); return mulberry32(seed); }
function todaySeed(){ const d = new Date(); const y=d.getUTCFullYear(); const m=String(d.getUTCMonth()+1).padStart(2,'0'); const day=String(d.getUTCDate()).padStart(2,'0'); return `${y}${m}${day}`; }
function nextUtcMidnightMs(){ const d=new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()+1, 0,0,0,0); }

function deepCopy(grid){ return grid.map(row => row.slice()); }
function createEmptyGrid(){ return Array.from({length:9}, () => Array(9).fill(0)); }

function isSafe(grid, r, c, val){
  for(let i=0;i<9;i++){ if(grid[r][i]===val || grid[i][c]===val) return false; }
  const br = Math.floor(r/3)*3, bc = Math.floor(c/3)*3;
  for(let i=0;i<3;i++) for(let j=0;j<3;j++){ if(grid[br+i][bc+j]===val) return false; }
  return true;
}

function solveGrid(grid){
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      if(grid[r][c]===0){
        for(let val=1; val<=9; val++){
          if(isSafe(grid, r, c, val)){
            grid[r][c] = val;
            if(solveGrid(grid)) return true;
            grid[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

function generateSudoku(diff='easy', rngFn=null){
  let grid = createEmptyGrid();
  const rand = rngFn || Math.random;
  // maišymas
  const numbers = [1,2,3,4,5,6,7,8,9];
  for(let i=numbers.length-1;i>0;i--){ const j = Math.floor(rand()*(i+1)); [numbers[i], numbers[j]] = [numbers[j], numbers[i]]; }
  for(let b=0;b<9;b+=3){
    let nums = numbers.slice();
    for(let r=0;r<3;r++){ for(let c=0;c<3;c++){ const idx = Math.floor(rand()*nums.length); const val = nums.splice(idx,1)[0]; grid[b+r][b+c] = val; } }
  }
  const filled = deepCopy(grid);
  solveGrid(filled);
  const clues = DIFF_CLUES[diff] ?? 36;
  let puz = deepCopy(filled);
  let cellsToRemove = 81 - clues;
  const positions = Array.from({length:81}, (_,i)=>i);
  for(let i=positions.length-1;i>0;i--){ const j = Math.floor(rand()*(i+1)); [positions[i], positions[j]] = [positions[j], positions[i]]; }
  let idx=0;
  while(cellsToRemove>0 && idx<positions.length){
    const pos = positions[idx++];
    const r = Math.floor(pos/9), c = pos%9;
    if(puz[r][c]!==0){ puz[r][c]=0; cellsToRemove--; }
  }
  return { puzzle: puz, solution: filled };
}

function updateLivesUI(){
  livesEl.innerHTML='';
  for(let i=1;i<=3;i++){
    const heart = document.createElement('div');
    heart.className = 'heart' + (i<=lives ? '' : ' off');
    heart.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path d="M12 21s-6.7-4.1-9.5-7.7C.3 10.1 1.3 6.6 4.2 5.1c2-1 4.4-.4 5.8 1.1 1.4-1.5 3.9-2.1 5.8-1.1 2.9 1.5 3.9 5 1.7 8.2C18.7 16.9 12 21 12 21z" fill="#ff4d6d"/></svg>`;
    livesEl.appendChild(heart);
  }
}

function showOverlay(title, text){ overlayTitle.textContent = title; overlayText.textContent = text; overlay.classList.remove('hidden'); }
function hideOverlay(){ overlay.classList.add('hidden'); }

function disableInputs(disabled){ for(const {input} of cells){ if(!input.readOnly){ input.disabled = disabled; } } }

function formatTime(s){ const m = Math.floor(s/60).toString().padStart(2,'0'); const sec = (s%60).toString().padStart(2,'0'); return `${m}:${sec}`; }
function startTimer(){ if(timer) return; timer = setInterval(()=>{ secondsElapsed++; timeEl.textContent = formatTime(secondsElapsed); },1000); }
function stopTimer(){ if(timer){ clearInterval(timer); timer=null; } }

function setScore(val){ score = Math.max(0, val); scoreEl.textContent = score.toString(); }
function addScore(amount){ setScore(score + amount); }
function setCombo(n){ const prev = combo; combo = Math.max(0, n); const mult = 1 + Math.min(combo,5)-1; comboEl.textContent = `x${mult}`; if(combo>prev){ vibrate(20); } }
function incCombo(){ setCombo(combo+1); }
function resetCombo(){ setCombo(0); }

function buildBoard(){
  boardEl.innerHTML='';
  cells = [];
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      const cell = document.createElement('div');
      cell.className = 'cell';
      if(r===2 || r===5) cell.classList.add('rowSep');
      if(c===2 || c===5) cell.classList.add('colSep');

      const input = document.createElement('input');
      input.setAttribute('inputmode','numeric');
      input.setAttribute('maxlength','1');
      input.setAttribute('aria-label', `Langelis ${r+1}-${c+1}`);
      input.dataset.lastWrong = '';
      input.dataset.correct = '0';

      const notes = document.createElement('div');
      notes.className = 'notes';
      for(let k=1;k<=9;k++){ const n = document.createElement('div'); n.className = 'note'; n.textContent=''; notes.appendChild(n); }

      if(puzzle[r][c]!==0){ input.value = puzzle[r][c]; input.readOnly = true; input.dataset.correct = '1'; cell.classList.add('readonly'); }
      else { input.value = ''; }

      input.addEventListener('focus', () => { activeCell = ref; updateNumpadForActive(); });
      cell.addEventListener('click', () => { input.focus(); activeCell = ref; updateNumpadForActive(); });
      input.addEventListener('keydown', e => {
        if(gameOver) return;
        if(!started){ started = true; startTimer(); }
        if(inputMode==='pencil' || e.altKey){
          const d = parseInt(e.key,10);
          if(d>=1 && d<=9){
            e.preventDefault();
            const notesCells = notes.children;
            notesCells[d-1].textContent = notesCells[d-1].textContent ? '' : d.toString();
            return;
          }
          return;
        }
        const d = parseInt(e.key,10);
        if(d>=1 && d<=9){
          e.preventDefault();
          if(inputMode==='pencil' && !e.altKey){
            if(!isCandidateAllowedAt(r,c,d)){ showToast('Tas skaičius negalimas čia'); vibrate([80]); flashCell(cell); return; }
            const idx = d-1; const t = notes.children[idx]; t.textContent = t.textContent ? '' : String(d);
            updateNotesConflicts();
            autoFillSingles();
          } else {
            if(!isCandidateAllowedAt(r,c,d)){ showToast('Skaičius jau egzistuoja eilutėje, stulpelyje ar bloke'); vibrate([120]); flashCell(cell); return; }
            input.value = d.toString();
            for(const n of notes.children) n.textContent='';
            validateCell(r,c,input,cell,true,true);
            afterPlacement(r,c,d);
          }
        }else if(e.key==='Backspace' || e.key==='Delete' || e.key==='0'){
          input.value='';
          cell.classList.remove('invalid');
          input.dataset.lastWrong='';
          for(const n of notes.children) n.textContent='';
        }
      });

      cell.appendChild(input);
      cell.appendChild(notes);
      boardEl.appendChild(cell);
      const ref = {r,c,cell,input,notes};
      cells.push(ref);
    }
  }
}

function validateCell(r,c,input,cell,penalize=false,award=false){
  const val = parseInt(input.value||'0',10);
  if(!val){ cell.classList.remove('invalid'); return; }
  if(solution[r][c] !== val){
    cell.classList.add('invalid');
    if(penalize){
      if(input.dataset.lastWrong !== String(val)){
        input.dataset.lastWrong = String(val);
        addScore(-50);
        resetCombo();
        loseLife();
        vibrate([120]);
      }
    }
  }else{
    cell.classList.remove('invalid');
    input.dataset.lastWrong='';
    if(input.dataset.correct !== '1'){
      input.dataset.correct = '1';
      if(award){
        incCombo();
        const mult = Math.min(combo,5);
        addScore(100 * mult);
      }
    }
    if(isSolved()) finishSuccess();
  }
}

function isSolved(){ for(const {r,c,input} of cells){ const val = parseInt(input.value||'0',10); if(val !== solution[r][c]) return false; } return true; }

function loseLife(){
  if(lives<=0) return;
  lives--;
  updateLivesUI();
  if(lives===0){
    gameOver = true;
    stopTimer();
    disableInputs(true);
    saveBest();
    showOverlay('Žaidimas baigtas', `Baigėsi gyvybės. Taškai: ${score}. Laikas: ${formatTime(secondsElapsed)}.`);
  }
}

function checkBoard(){
  if(gameOver) return;
  let ok = true;
  for(const {r,c,input,cell} of cells){
    if(input.readOnly) continue;
    const val = parseInt(input.value||'0',10);
    if(!val || val!==solution[r][c]){ cell.classList.add('invalid'); ok = false; }
    else { cell.classList.remove('invalid'); }
  }
  if(ok){ finishSuccess(); }
  else { alert('Dar ne viskas gerai. Pažiūrėk į pažymėtus langelius.'); }
}

function finishSuccess(){
  gameOver = true;
  stopTimer();
  disableInputs(true);
  const speedBonus = Math.max(0, 600 - secondsElapsed);
  const livesBonus = lives * 200;
  addScore(speedBonus + livesBonus);
  saveBest();
  if(dailyMode){ saveDailyHistory(); }
  vibrate([30,50,120]);
  const title = dailyMode ? 'Daily įveikta!' : 'Puiku';
  showOverlay(title, `Teisingai išspręsta! Laikas: ${formatTime(secondsElapsed)}. Taškai: ${score}. (+${speedBonus} greičio, +${livesBonus} už gyvybes)`);
}

function giveHint(){
  if(gameOver) return;
  const candidates = cells.filter(({r,c,input}) => { const val = parseInt(input.value||'0',10); return val!==solution[r][c]; });
  if(candidates.length===0){ alert('Užuominų nebereikia. Viskas teisinga.'); return; }
  const pick = candidates[Math.floor(Math.random()*candidates.length)];
  pick.input.value = solution[pick.r][pick.c];
  pick.cell.classList.remove('invalid');
  pick.input.dataset.lastWrong='';
  resetCombo();
  pick.input.dataset.correct='1';
  for(const n of pick.notes.children) n.textContent='';
  if(isSolved()) finishSuccess();
}

function clearNotes(){ for(const {notes} of cells){ for(const n of notes.children) n.textContent=''; } }

function saveBest(){
  const key = dailyMode ? `sudoku_daily_best_${dailySeed}` : 'sudoku_mvp_best';
  const prev = JSON.parse(localStorage.getItem(key) || 'null');
  const entry = { score, seconds: secondsElapsed, diff: difficultyEl.value, time: Date.now(), daily: dailyMode, seed: dailySeed };
  if(!prev || score > prev.score){ localStorage.setItem(key, JSON.stringify(entry)); }
  const best = JSON.parse(localStorage.getItem(key) || 'null');
  bestScoreEl.textContent = best ? `${best.score}` : '–';
}

// Daily istorija
function loadHistory(){
  return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
}
function saveHistory(arr){
  localStorage.setItem(HISTORY_KEY, JSON.stringify(arr.slice(-50))); // laikom paskutinius 50
}
function saveDailyHistory(){
  const arr = loadHistory();
  // atnaujinam įrašą pagal seed+diff
  const diff = dailyDifficultyEl.value;
  const existing = arr.find(x => x.seed===dailySeed && x.diff===diff);
  const entry = { seed: dailySeed, diff, score, seconds: secondsElapsed, dateUTC: new Date().toISOString() };
  if(existing){ Object.assign(existing, entry); }
  else { arr.push(entry); }
  saveHistory(arr);
}

function renderHistory(){
  const arr = loadHistory().slice().reverse(); // naujausi viršuje
  if(arr.length===0){
    historyTable.innerHTML = '<p>Kol kas nėra įrašų.</p>';
    return;
  }
  const rows = arr.map(e => {
    const d = e.seed; // YYYYMMDD
    const pretty = `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
    return `<tr><td>${pretty}</td><td>${labelForDiff(e.diff)}</td><td>${e.score}</td><td>${formatTime(e.seconds)}</td></tr>`;
  }).join('');
  historyTable.innerHTML = `<div class="table"><table><thead><tr><th>Diena</th><th>Lygis</th><th>Taškai</th><th>Laikas</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function labelForDiff(d){ return d==='easy'?'Lengvas':d==='medium'?'Vidutinis':d==='hard'?'Sunkus':'Ekspertas'; }

function loadBest(){
  const key = dailyMode ? `sudoku_daily_best_${dailySeed}` : 'sudoku_mvp_best';
  const best = JSON.parse(localStorage.getItem(key) || 'null');
  bestScoreEl.textContent = best ? `${best.score}` : '–';
}

function setDailyUI(on){
  dailyMode = on;
  dailyTag.classList.toggle('hidden', !on);
  countdownWrap.classList.toggle('hidden', !on);
  dailyOpts.classList.toggle('hidden', !on);
  difficultyEl.disabled = on;
  // paleidžiam arba stabdom countdown
  if(on){ startCountdown(); } else { stopCountdown(); }
}

function newGame(){ hideOverlay(); setDailyUI(false); startNewRound(); }

function startNewRound(seed=null){
  gameOver = false;
  started = false;
  stopTimer();
  secondsElapsed = 0;
  timeEl.textContent = '00:00';
  setScore(0);
  resetCombo();
  lives = 3;
  updateLivesUI();

  let rng = null;
  if(seed){ rng = seededRandom(seed); }
  const diff = dailyMode ? dailyDifficultyEl.value : difficultyEl.value;
  const data = generateSudoku(diff, rng);
  puzzle = data.puzzle;
  solution = data.solution;
  buildBoard();
  disableInputs(false);
  updateNotesConflicts();
  autoFillSingles();
  updateNumpadForActive();
  loadBest();
  updateNumpadForActive();
}

function startDaily(){
  hideOverlay();
  dailySeed = todaySeed();
  setDailyUI(true);
  startNewRound(dailySeed);
}

// Countdown iki kito UTC vidurnakčio
function startCountdown(){
  stopCountdown();
  function tick(){
    const now = Date.now();
    const target = nextUtcMidnightMs();
    let delta = Math.max(0, target - now);
    const h = Math.floor(delta/3600000); delta -= h*3600000;
    const m = Math.floor(delta/60000); delta -= m*60000;
    const s = Math.floor(delta/1000);
    countdownText.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  tick();
  countdownTimer = setInterval(tick, 1000);
}
function stopCountdown(){ if(countdownTimer){ clearInterval(countdownTimer); countdownTimer=null; } }

overlayBtn.addEventListener('click', () => { dailyMode ? startDaily() : newGame(); });
newGameBtn.addEventListener('click', newGame);
dailyBtn.addEventListener('click', startDaily);
historyBtn.addEventListener('click', () => { renderHistory(); historyModal.classList.remove('hidden'); });
closeHistory.addEventListener('click', () => historyModal.classList.add('hidden'));
clearHistory.addEventListener('click', () => { localStorage.removeItem(HISTORY_KEY); renderHistory(); });

checkBtn.addEventListener('click', checkBoard);
hintBtn.addEventListener('click', giveHint);

// Dalinimosi kortelė
const shareCanvas = document.getElementById('shareCanvas');
const shareBtn = document.getElementById('shareBtn');
const downloadBtn = document.getElementById('downloadBtn');

function formatDateUTC(seedStr){
  // seedStr YYYYMMDD
  if(!seedStr || seedStr.length!==8) return '—';
  return `${seedStr.slice(0,4)}-${seedStr.slice(4,6)}-${seedStr.slice(6,8)}`;
}

function drawShareCard(){
  const c = shareCanvas;
  const ctx = c.getContext('2d');
  // background
  ctx.fillStyle = '#0e1320';
  ctx.fillRect(0,0,c.width,c.height);

  // gradient header
  const grad = ctx.createLinearGradient(0,0,c.width,0);
  grad.addColorStop(0,'#1b2a4b');
  grad.addColorStop(1,'#243b6b');
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,c.width,120);

  // title
  ctx.fillStyle = '#e8ecf1';
  ctx.font = 'bold 48px system-ui, -apple-system, Segoe UI, Roboto';
  ctx.fillText('Sudoku Daily rezultatas', 40, 78);

  // info box
  const pad = 40;
  const left = 40, top = 160, right = c.width - 40, bottom = c.height - 40;
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#2a3b68';
  ctx.lineWidth = 2;
  roundRect(ctx, left, top, right-left, bottom-top, 24, true, true);

  // labels
  ctx.fillStyle = '#9fb0c6';
  ctx.font = '22px system-ui, -apple-system, Segoe UI, Roboto';
  const lineH = 40;
  const labels = [
    ['Data', formatDateUTC(dailySeed || todaySeed())],
    ['Režimas', dailyMode ? 'Dienos iššūkis' : 'Klasikinis'],
    ['Lygis', labelForDiff(dailyMode ? dailyDifficultyEl.value : difficultyEl.value)],
    ['Laikas', formatTime(secondsElapsed)],
    ['Taškai', String(score)],
    ['Gyvybės', String(lives)],
  ];
  let y = top + 60;
  labels.forEach(([k,v]) => {
    ctx.fillStyle = '#9fb0c6'; ctx.fillText(k, left+32, y);
    ctx.fillStyle = '#e8ecf1'; ctx.font = 'bold 28px system-ui, -apple-system, Segoe UI, Roboto';
    ctx.fillText(v, left+220, y);
    ctx.font = '22px system-ui, -apple-system, Segoe UI, Roboto';
    y += lineH;
  });

  // tiny 9x9 preview
  const cell = 18;
  const previewX = right - (cell*9) - 32;
  const previewY = top + 32;
  ctx.fillStyle = '#243047';
  roundRect(ctx, previewX-8, previewY-8, cell*9+16, cell*9+16, 12, true, false);
  for(let r=0;r<9;r++){
    for(let ccol=0; ccol<9; ccol++){
      const x = previewX + ccol*cell;
      const y2 = previewY + r*cell;
      ctx.strokeStyle = '#16203a'; ctx.strokeRect(x, y2, cell, cell);
      const val = solution[r][ccol];
      ctx.fillStyle = '#a7c0ff';
      ctx.font = 'bold 14px system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(val, x+cell/2, y2+cell/2);
    }
  }
  // 3x3 thicker lines
  ctx.strokeStyle = '#2b3b68'; ctx.lineWidth = 2;
  for(let i=0;i<=9;i+=3){
    ctx.beginPath(); ctx.moveTo(previewX, previewY + i*cell); ctx.lineTo(previewX + 9*cell, previewY + i*cell); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(previewX + i*cell, previewY); ctx.lineTo(previewX + i*cell, previewY + 9*cell); ctx.stroke();
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

function roundRect(ctx, x, y, w, h, r, fill, stroke){
  if (typeof r === 'number') r = {tl:r, tr:r, br:r, bl:r};
  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + w - r.tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr);
  ctx.lineTo(x + w, y + h - r.br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
  ctx.lineTo(x + r.bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r.bl);
  ctx.lineTo(x, y + r.tl);
  ctx.quadraticCurveTo(x, y, x + r.tl, y);
  ctx.closePath();
  if(fill) ctx.fill();
  if(stroke) ctx.stroke();
}

async function shareImage(){
  drawShareCard();
  const blob = await new Promise(res => shareCanvas.toBlob(res, 'image/png'));
  const file = new File([blob], 'sudoku_result.png', { type: 'image/png' });

  if(navigator.canShare && navigator.canShare({ files: [file] })){
    try{
      await navigator.share({ files: [file], title: 'Mano Sudoku rezultatas', text: 'Išsprendžiau Sudoku!' });
    }catch(e){ /* user cancelled */ }
  }else if(navigator.clipboard && window.ClipboardItem){
    try{
      await navigator.clipboard.write([ new ClipboardItem({ 'image/png': blob }) ]);
      alert('Kortelė nukopijuota į iškarpinę. Įklijuok kur reikia.');
    }catch(e){
      // fallback to download
      downloadImage();
    }
  }else{
    downloadImage();
  }
}

function downloadImage(){
  drawShareCard();
  shareCanvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'sudoku_result.png';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

shareBtn.addEventListener('click', shareImage);
downloadBtn.addEventListener('click', downloadImage);

clearNotesBtn.addEventListener('click', clearNotes);

// Start normal
newGame();
