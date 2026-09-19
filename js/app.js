// ─── Constants ────────────────────────────────────────────────────────────────
const SAVE_KEY = 'scv_save';

const DIFF_LABELS = {
  novice:   'Первопроходец',
  explorer: 'Исследователь',
  keeper:   'Хранитель',
};

const ACHIEVEMENTS = [
  { id: 'first_word',   name: 'Первая грамота',       desc: 'Найди первое слово',          icon: 'scroll-text', color: '#c9a84c', bg: 'rgba(201,168,76,0.12)' },
  { id: 'act1_done',    name: 'Знаток Скриптория',    desc: 'Пройди Акт I',                icon: 'feather',     color: '#81c784', bg: 'rgba(100,200,100,0.12)' },
  { id: 'words_5',      name: 'Собиратель слов',      desc: 'Найди 5 слов',                icon: 'library',     color: '#64b5f6', bg: 'rgba(100,150,200,0.12)' },
  { id: 'score_50',     name: 'Острый ум',            desc: 'Набери 50 очков',             icon: 'zap',         color: '#ffb74d', bg: 'rgba(255,180,80,0.12)'  },
  { id: 'glagolica',    name: 'Знаток Глаголицы',     desc: 'Пройди Акт II',               icon: 'type',        color: '#f48fb1', bg: 'rgba(240,140,180,0.12)' },
  { id: 'dialects',     name: 'Покоритель Диалектов', desc: 'Пройди Акт IV',               icon: 'globe',       color: '#80cbc4', bg: 'rgba(100,200,190,0.12)' },
  { id: 'words_15',     name: 'Мастер Словесности',   desc: 'Найди 15 слов',               icon: 'award',       color: '#b39ddb', bg: 'rgba(150,100,200,0.12)' },
  { id: 'all_acts',     name: 'Летопись Единства',    desc: 'Пройди все 5 актов',          icon: 'crown',       color: '#f0d080', bg: 'rgba(240,210,80,0.12)'  },
];

// ─── State ────────────────────────────────────────────────────────────────────
let gameData = null;
let state = {
  score: 0,
  foundWords: [],
  completedLocations: [],
  unlockedAchievements: [],
  difficulty: 'explorer',
  currentDialogueId: null,
  currentLocation: null,
  currentDialogue: null,
  lastScreen: 'game',
};

// ─── Save / Load ──────────────────────────────────────────────────────────────
function saveProgress() {
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    score: state.score,
    foundWords: state.foundWords,
    completedLocations: state.completedLocations,
    unlockedAchievements: state.unlockedAchievements,
    difficulty: state.difficulty,
  }));
}

function loadProgress() {
  const saved = localStorage.getItem(SAVE_KEY);
  if (!saved) return;
  const d = JSON.parse(saved);
  state.score = d.score ?? 0;
  state.foundWords = d.foundWords ?? [];
  state.completedLocations = d.completedLocations ?? [];
  state.unlockedAchievements = d.unlockedAchievements ?? [];
  state.difficulty = d.difficulty ?? 'explorer';
}

function hasSave() {
  return !!localStorage.getItem(SAVE_KEY);
}

// ─── Screens ──────────────────────────────────────────────────────────────────
const GAME_SCREENS = ['game', 'map', 'inventory'];

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(`screen-${name}`);
  if (el) el.classList.add('active');

  const isGame = GAME_SCREENS.includes(name);
  document.getElementById('game-topbar').style.display = isGame ? 'flex' : 'none';

  if (name === 'map') { renderMap(); state.lastScreen = 'map'; }
  if (name === 'inventory') { renderInventory(); state.lastScreen = 'inventory'; }
  if (name === 'game') state.lastScreen = 'game';

  lucide.createIcons();
}

// ─── Difficulty ───────────────────────────────────────────────────────────────
function _syncDiffCards(containerSelector, diff) {
  document.querySelectorAll(containerSelector + ' .diff-card').forEach(c => {
    const sel = c.dataset.diff === diff;
    c.classList.toggle('selected', sel);
    // handle both landing (check-icon-*) and modal (mcheck-icon-*) prefixes
    c.querySelectorAll('[id*="check-icon-"]').forEach(ic => {
      ic.style.display = sel ? 'block' : 'none';
    });
  });
}

function selectDifficulty(diff) {
  state.difficulty = diff;
  _syncDiffCards('#difficulty', diff);
  document.getElementById('diff-badge').textContent = DIFF_LABELS[diff];
  saveProgress();
  lucide.createIcons();
}

function selectDifficultyModal(diff) {
  state.difficulty = diff;
  _syncDiffCards('#modal-diff-grid', diff);
  document.getElementById('diff-badge').textContent = DIFF_LABELS[diff];
  saveProgress();
  lucide.createIcons();
}

function openDifficultyModal() {
  // sync modal cards to current state
  _syncDiffCards('#modal-diff-grid', state.difficulty);
  lucide.createIcons();
  document.getElementById('modal-difficulty').classList.add('open');
}

function closeDifficultyModal() {
  document.getElementById('modal-difficulty').classList.remove('open');
}

// ─── Landing helpers ──────────────────────────────────────────────────────────
function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

function continueGame() {
  showScreen('game');
  if (state.currentDialogue && state.currentDialogueId) {
    showDialogue(state.currentDialogueId);
  } else {
    showScreen('map');
  }
}

// ─── Intro cutscene ───────────────────────────────────────────────────────────
function startIntro(playPromise) {
  showScreen('intro');
  const video = document.getElementById('intro-video');
  const placeholder = document.getElementById('intro-placeholder');
  const skipBtn = document.getElementById('btn-skip-intro');
  let done = false;

  function showFallback() {
    if (video) video.style.display = 'none';
    placeholder.style.display = 'flex';
    const timer = setTimeout(finish, 4500);
    skipBtn.onclick = () => { clearTimeout(timer); finish(); };
  }

  function finish() {
    if (done) return;
    done = true;
    if (video) video.pause();
    launchGame();
  }

  skipBtn.onclick = finish;

  if (!video) { showFallback(); return; }

  video.onended = finish;
  video.onerror = showFallback;

  const p = playPromise !== undefined ? playPromise : video.play();
  if (p !== undefined) p.catch(showFallback);
}

function launchGame() {
  showActSplash('Пролог', 'Слово через века', 'Начало путешествия', startPrologue);
}

// ─── Act Splash ───────────────────────────────────────────────────────────────
function showActSplash(eyebrow, title, sub, onDone) {
  const splash = document.getElementById('act-splash');
  document.getElementById('act-splash-eyebrow').textContent = eyebrow;
  document.getElementById('act-splash-title').textContent = title;
  document.getElementById('act-splash-sub').textContent = sub;
  splash.classList.add('visible');
  setTimeout(() => {
    splash.style.transition = 'opacity 0.8s ease';
    splash.style.opacity = '0';
    setTimeout(() => {
      splash.classList.remove('visible');
      splash.style.opacity = '';
      splash.style.transition = '';
      onDone?.();
    }, 800);
  }, 2200);
}

// ─── Background crossfade ─────────────────────────────────────────────────────
function setGameBg(value) {
  const bg = document.getElementById('game-bg');
  const next = document.getElementById('game-bg-next');
  const css = (value && (value.startsWith('assets') || value.startsWith('mori')))
    ? `url('${value}') center/cover no-repeat`
    : value;
  next.style.background = css;
  next.style.opacity = '1';
  setTimeout(() => {
    bg.style.background = css;
    next.style.opacity = '0';
  }, 700);
}
function startPrologue() {
  const p = gameData.prologue;
  state.currentDialogue = p.dialogue;
  state.currentDialogueId = p.dialogue[0].id;
  state.currentLocation = { id: 'prologue', title: p.title };
  document.getElementById('location-title').textContent = '';
  setGameBg(p.background);
  showScreen('game');
  showDialogue(state.currentDialogueId);
}

// ─── Mori sprite ─────────────────────────────────────────────────────────────
const MORI_SPRITES = {
  default:  'mori/mori_full.png',
  happy:    'mori/mori_happy.png',
  idea:     'mori/mori_idea.png',
  pout:     'mori/mori_pout.png',
  shock:    'mori/mori_shock.png',
  confused: 'mori/mori_confused.png',
  funny:    'mori/mori_funny..png',
  none:     null,
};

const MORI_FALLBACKS = {
  shock:    'mori/mori_full.png',
  confused: 'mori/mori_full.png',
  funny:    'mori/mori_idea.png',
};

function setMoriEmotion(emotion) {
  const container = document.querySelector('.mori-container');
  const img = document.getElementById('mori-sprite');
  if (emotion === 'none') {
    container.style.display = 'none';
    return;
  }
  container.style.display = '';
  const src = MORI_SPRITES[emotion] || MORI_SPRITES.default;
  if (img.src.endsWith(src)) return;
  img.classList.add('fade-out');
  setTimeout(() => {
    img.src = src;
    img.onerror = () => {
      img.src = MORI_FALLBACKS[emotion] || MORI_SPRITES.default;
      img.onerror = null;
    };
    img.classList.remove('fade-out');
  }, 200);
}

// ─── Dialogue engine ──────────────────────────────────────────────────────────
function getDialogueNode(id) {
  return state.currentDialogue.find(d => d.id === id);
}

function showDialogue(nodeId) {
  const node = getDialogueNode(nodeId);
  if (!node) return;
  state.currentDialogueId = nodeId;
  setMoriEmotion(node.emotion || 'default');
  // switch background if node specifies one
  if (node.bg) {
    setGameBg(node.bg);
  }
  document.getElementById('speaker-name').textContent = node.speaker;
  document.getElementById('choices-container').innerHTML = '';
  typeText(node.text, () => renderChoices(node));
}

function typeText(text, onDone) {
  const el = document.getElementById('dialogue-text');
  el.textContent = '';
  let i = 0;
  const iv = setInterval(() => {
    el.textContent += text[i++];
    if (i >= text.length) { clearInterval(iv); onDone?.(); }
  }, 22);
  el.onclick = () => {
    clearInterval(iv);
    el.textContent = text;
    el.onclick = null;
    onDone?.();
  };
}

function renderChoices(node) {
  const c = document.getElementById('choices-container');
  c.innerHTML = '';

  if (node.reward) applyReward(node.reward);
  if (node.action === 'complete_location') completeLocation();
  if (node.action === 'complete_act1') { showAct1Finale(); return; }
  if (node.action === 'quiz') { startQuiz(node.quiz_id); return; }
  if (node.action === 'start_act1') {
    setTimeout(() => {
      showActSplash('Акт I', 'Древняя Русь', 'Встреча с Мори', () => startLocation('act1', 'scriptorium'));
    }, 400);
    return;
  }

  if (node.choices?.length) {
    node.choices.forEach(choice => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = choice.text;
      btn.onclick = () => {
        state.score += choice.score || 0;
        updateScoreUI();
        saveProgress();
        checkAchievements();
        showDialogue(choice.next);
      };
      c.appendChild(btn);
    });
  } else if (node.next) {
    const btn = document.createElement('button');
    btn.className = 'choice-btn choice-btn--continue';
    btn.innerHTML = 'Продолжить <i data-lucide="arrow-right" style="width:14px;height:14px;display:inline;vertical-align:middle"></i>';
    btn.onclick = () => { showDialogue(node.next); lucide.createIcons(); };
    c.appendChild(btn);
    lucide.createIcons();
  } else {
    const btn = document.createElement('button');
    btn.className = 'choice-btn choice-btn--continue';
    btn.innerHTML = '<i data-lucide="map" style="width:14px;height:14px;display:inline;vertical-align:middle"></i> Открыть карту';
    btn.onclick = () => showScreen('map');
    c.appendChild(btn);
    lucide.createIcons();
  }
}

// ─── Quiz engine ─────────────────────────────────────────────────────────────
function startQuiz(quizId) {
  const quiz = gameData.quizzes[quizId];
  if (!quiz) return;
  document.getElementById('quiz-bg').style.background =
    document.getElementById('game-bg').style.background ||
    'linear-gradient(135deg, #0e0a18, #1a0e2a)';
  showScreen('quiz');
  const c = document.getElementById('quiz-container');
  c.innerHTML = '';
  if (quiz.type === 'choice') renderChoiceQuiz(quiz, c);
  else if (quiz.type === 'fill')  renderFillQuiz(quiz, c);
  else if (quiz.type === 'match') renderMatchQuiz(quiz, c);
}

function quizDone(quiz, correct) {
  if (correct) {
    const wordIds = quiz.reward_words || (quiz.reward_word ? [quiz.reward_word] : []);
    wordIds.forEach(id => {
      if (!state.foundWords.includes(id)) {
        state.foundWords.push(id);
        showWordToast(gameData.words[id]?.form || id);
      }
    });
    state.score += quiz.score || 0;
    updateScoreUI();
    updateInventoryCount();
    saveProgress();
    checkAchievements();
  }
  setTimeout(() => {
    const dlg = gameData.post_quiz_dialogues[quiz.next_dialogue];
    if (dlg) {
      state.currentDialogue = dlg;
      state.currentDialogueId = dlg[0].id;
      showScreen('game');
      showDialogue(dlg[0].id);
    } else {
      showScreen('map');
    }
  }, correct ? 1200 : 0);
}

function renderChoiceQuiz(quiz, c) {
  c.innerHTML = `
    <div class="quiz-eyebrow">${quiz.title}</div>
    ${quiz.word_highlight ? `<div class="quiz-word-highlight">${quiz.word_highlight}</div>` : ''}
    <div class="quiz-question">${quiz.question}</div>
    <div class="quiz-options" id="quiz-opts"></div>
    <div class="quiz-hint" id="quiz-hint">${quiz.hint}</div>
    <div class="quiz-result" id="quiz-result">
      <div class="quiz-result-icon">✨</div>
      <div class="quiz-result-text">Правильно! +${quiz.score} очков</div>
    </div>`;
  const opts = document.getElementById('quiz-opts');
  quiz.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option';
    btn.textContent = opt.text;
    btn.onclick = () => {
      opts.querySelectorAll('.quiz-option').forEach(b => b.disabled = true);
      if (opt.correct) {
        btn.classList.add('correct');
        document.getElementById('quiz-result').classList.add('visible');
        quizDone(quiz, true);
      } else {
        btn.classList.add('wrong');
        document.getElementById('quiz-hint').classList.add('visible');
        setTimeout(() => {
          opts.querySelectorAll('.quiz-option').forEach(b => {
            b.disabled = false;
            b.classList.remove('wrong');
          });
          document.getElementById('quiz-hint').classList.remove('visible');
        }, 1800);
      }
    };
    opts.appendChild(btn);
  });
}

function renderFillQuiz(quiz, c) {
  const letters = quiz.word_template.split('');
  c.innerHTML = `
    <div class="quiz-eyebrow">${quiz.title}</div>
    <div class="quiz-question">${quiz.question}</div>
    <div class="quiz-fill-word">${
      letters.map((l, i) => i === quiz.missing_index
        ? `<span class="quiz-fill-blank" id="fill-blank">_</span>`
        : `<span class="quiz-fill-letter">${l}</span>`
      ).join('')
    }</div>
    <div class="quiz-fill-options" id="fill-opts"></div>
    <div class="quiz-hint" id="quiz-hint">${quiz.hint}</div>
    <div class="quiz-result" id="quiz-result">
      <div class="quiz-result-icon">✨</div>
      <div class="quiz-result-text">Правильно! +${quiz.score} очков</div>
    </div>`;
  const opts = document.getElementById('fill-opts');
  quiz.options.forEach(letter => {
    const btn = document.createElement('button');
    btn.className = 'quiz-fill-btn';
    btn.textContent = letter;
    btn.onclick = () => {
      const blank = document.getElementById('fill-blank');
      blank.textContent = letter;
      opts.querySelectorAll('.quiz-fill-btn').forEach(b => b.disabled = true);
      if (letter === quiz.correct_option) {
        blank.classList.add('filled-correct');
        document.getElementById('quiz-result').classList.add('visible');
        quizDone(quiz, true);
      } else {
        blank.classList.add('filled-wrong');
        document.getElementById('quiz-hint').classList.add('visible');
        setTimeout(() => {
          blank.textContent = '_';
          blank.classList.remove('filled-wrong');
          opts.querySelectorAll('.quiz-fill-btn').forEach(b => b.disabled = false);
          document.getElementById('quiz-hint').classList.remove('visible');
        }, 1800);
      }
    };
    opts.appendChild(btn);
  });
}

function renderMatchQuiz(quiz, c) {
  const pairs = quiz.pairs;
  const shuffledModern = [...pairs].sort(() => Math.random() - 0.5);
  let selectedAncient = null;
  let matchedCount = 0;
  c.innerHTML = `
    <div class="quiz-eyebrow">${quiz.title}</div>
    <div class="quiz-question">${quiz.question}</div>
    <div class="quiz-match">
      <div class="quiz-match-col" id="match-ancient"></div>
      <div class="quiz-match-col" id="match-modern"></div>
    </div>
    <div class="quiz-hint" id="quiz-hint">${quiz.hint}</div>
    <div class="quiz-result" id="quiz-result">
      <div class="quiz-result-icon">✨</div>
      <div class="quiz-result-text">Все пары совпали! +${quiz.score} очков</div>
    </div>`;
  const ancientCol = document.getElementById('match-ancient');
  const modernCol  = document.getElementById('match-modern');
  pairs.forEach(pair => {
    const btn = document.createElement('div');
    btn.className = 'quiz-match-item';
    btn.textContent = pair.ancient;
    btn.dataset.ancient = pair.ancient;
    btn.onclick = () => {
      if (btn.classList.contains('matched')) return;
      ancientCol.querySelectorAll('.quiz-match-item').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedAncient = pair.ancient;
    };
    ancientCol.appendChild(btn);
  });
  shuffledModern.forEach(pair => {
    const btn = document.createElement('div');
    btn.className = 'quiz-match-item';
    btn.textContent = pair.modern;
    btn.dataset.modern = pair.modern;
    btn.onclick = () => {
      if (!selectedAncient || btn.classList.contains('matched')) return;
      const correctPair = pairs.find(p => p.ancient === selectedAncient);
      if (correctPair && correctPair.modern === pair.modern) {
        btn.classList.add('matched');
        ancientCol.querySelector(`[data-ancient="${selectedAncient}"]`).classList.add('matched');
        selectedAncient = null;
        matchedCount++;
        if (matchedCount === pairs.length) {
          document.getElementById('quiz-result').classList.add('visible');
          quizDone(quiz, true);
        }
      } else {
        btn.classList.add('wrong-flash');
        ancientCol.querySelector(`[data-ancient="${selectedAncient}"]`)?.classList.remove('selected');
        selectedAncient = null;
        document.getElementById('quiz-hint').classList.add('visible');
        setTimeout(() => {
          btn.classList.remove('wrong-flash');
          document.getElementById('quiz-hint').classList.remove('visible');
        }, 1800);
      }
    };
    modernCol.appendChild(btn);
  });
}

// ─── Act I Finale ─────────────────────────────────────────────────────────────
function showAct1Finale() {
  const el = document.getElementById('act-finale');
  document.getElementById('finale-title').textContent = 'Акт I завершён!';
  document.getElementById('finale-sub').textContent = 'Древняя Русь открыла свои тайны';
  document.getElementById('finale-stats').innerHTML = `
    <div class="finale-stat">
      <div class="finale-stat-num">${state.foundWords.length}</div>
      <div class="finale-stat-label">слов найдено</div>
    </div>
    <div class="finale-stat">
      <div class="finale-stat-num">${state.score}</div>
      <div class="finale-stat-label">очков</div>
    </div>
    <div class="finale-stat">
      <div class="finale-stat-num">3</div>
      <div class="finale-stat-label">локации</div>
    </div>`;
  const act2 = gameData.acts.find(a => a.id === 'act2');
  if (act2) act2.unlocked = true;
  if (!state.completedLocations.includes('act1')) state.completedLocations.push('act1');
  checkAchievements();
  saveProgress();
  el.classList.add('visible');
  lucide.createIcons();
  document.getElementById('finale-btn').onclick = () => {
    el.classList.remove('visible');
    showActSplash('Акт II', 'Печатный век', 'Скоро...', () => showScreen('map'));
  };
}

// ─── Rewards & Achievements ───────────────────────────────────────────────────
function applyReward(reward) {
  if (reward.type === 'word' && !state.foundWords.includes(reward.word.id)) {
    state.foundWords.push(reward.word.id);
    saveProgress();
    showWordToast(reward.word.form);
    updateInventoryCount();
    checkAchievements();
  }
}

function completeLocation() {
  const id = state.currentLocation?.id;
  if (id && !state.completedLocations.includes(id)) {
    state.completedLocations.push(id);
    saveProgress();
    checkAchievements();
  }
}

function checkAchievements() {
  const unlock = (id) => {
    if (!state.unlockedAchievements.includes(id)) {
      state.unlockedAchievements.push(id);
      saveProgress();
      const ach = ACHIEVEMENTS.find(a => a.id === id);
      if (ach) showAchievementToast(ach.name);
    }
  };
  if (state.foundWords.length >= 1)  unlock('first_word');
  if (state.foundWords.length >= 5)  unlock('words_5');
  if (state.foundWords.length >= 15) unlock('words_15');
  if (state.score >= 50)             unlock('score_50');
  if (state.completedLocations.includes('scriptorium')) unlock('act1_done');
}

// ─── UI Updates ───────────────────────────────────────────────────────────────
function updateScoreUI() {
  document.getElementById('score-display').textContent = state.score;
}

function updateInventoryCount() {
  document.getElementById('inv-count').textContent = state.foundWords.length;
}

// ─── Toasts ───────────────────────────────────────────────────────────────────
function showWordToast(word) {
  const toast = document.getElementById('word-toast');
  document.getElementById('toast-word').textContent = word;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3200);
}

function showAchievementToast(name) {
  // Reuse word toast with different text briefly after word toast
  setTimeout(() => {
    const toast = document.getElementById('word-toast');
    document.getElementById('toast-word').textContent = '';
    toast.querySelector('span').textContent = '';
    // Create a separate small notification
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;bottom:1.5rem;right:1.5rem;z-index:300;
      background:linear-gradient(135deg,#1a2d45,#243b55);
      border:1px solid var(--gold);border-radius:8px;
      padding:0.75rem 1.1rem;color:var(--gold-light);
      font-family:'Cinzel',serif;font-size:0.82rem;
      box-shadow:0 4px 20px rgba(201,168,76,0.25);
      animation:slideDown 0.4s ease both;`;
    el.textContent = `🏆 ${name}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }, 500);
}

// ─── Map ──────────────────────────────────────────────────────────────────────
function renderMap() {
  const container = document.getElementById('map-acts');
  container.innerHTML = '';
  gameData.acts.forEach(act => {
    const div = document.createElement('div');
    div.className = `act-card ${act.unlocked ? '' : 'locked'}`;
    const locs = act.locations.map(loc => {
      const done = state.completedLocations.includes(loc.id);
      const icon = done
        ? '<i data-lucide="check-circle" style="width:13px;height:13px"></i>'
        : '<i data-lucide="map-pin" style="width:13px;height:13px"></i>';
      return `<button class="loc-btn ${done ? 'completed' : ''}"
        ${!act.unlocked ? 'disabled' : ''}
        data-act="${act.id}" data-loc="${loc.id}">
        ${icon} ${loc.title}
      </button>`;
    }).join('') || '<p class="soon">Скоро...</p>';
    div.innerHTML = `<h3>${act.title}</h3><div class="locations-list">${locs}</div>`;
    container.appendChild(div);
  });
  container.querySelectorAll('.loc-btn:not([disabled])').forEach(btn => {
    btn.onclick = () => startLocation(btn.dataset.act, btn.dataset.loc);
  });
  lucide.createIcons();
}

function startLocation(actId, locId) {
  const act = gameData.acts.find(a => a.id === actId);
  const loc = act?.locations.find(l => l.id === locId);
  if (!loc) return;
  state.currentLocation = loc;
  state.currentDialogue = loc.dialogue;
  state.currentDialogueId = loc.dialogue[0].id;
  document.getElementById('location-title').textContent = loc.title;
  setGameBg(loc.background);
  showScreen('game');
  showDialogue(state.currentDialogueId);
}

// ─── Inventory ────────────────────────────────────────────────────────────────
const WORDS_PER_PAGE = 6;
let archivePage = 0;

function renderInventory() {
  document.getElementById('archive-count').textContent = `${state.foundWords.length} слов`;
  renderArchivePage(0, 'none');
}

function renderArchivePage(page, direction) {
  const pages = document.getElementById('archive-pages');
  const dotsEl = document.getElementById('archive-dots');
  const infoEl = document.getElementById('archive-page-info');
  const words = state.foundWords;
  const totalPages = Math.max(1, Math.ceil(words.length / WORDS_PER_PAGE));
  page = Math.max(0, Math.min(page, totalPages - 1));
  archivePage = page;

  // dots
  dotsEl.innerHTML = Array.from({ length: totalPages }, (_, i) =>
    `<button class="archive-dot${i === page ? ' active' : ''}" onclick="goArchivePage(${i})"></button>`
  ).join('');

  infoEl.textContent = totalPages > 1 ? `${page + 1} / ${totalPages}` : '';
  document.getElementById('archive-prev').style.visibility = page > 0 ? 'visible' : 'hidden';
  document.getElementById('archive-next').style.visibility = page < totalPages - 1 ? 'visible' : 'hidden';

  const slice = words.slice(page * WORDS_PER_PAGE, (page + 1) * WORDS_PER_PAGE);

  // remove old page
  const old = pages.querySelector('.archive-page');
  if (old) {
    if (direction !== 'none') {
      old.classList.add(direction === 'right' ? 'page-exit-left' : 'page-exit-right');
      setTimeout(() => old.remove(), 350);
    } else {
      old.remove();
    }
  }

  const div = document.createElement('div');
  div.className = 'archive-page';

  if (!slice.length) {
    div.innerHTML = `<div class="archive-empty">
      <i data-lucide="book-open" style="width:40px;height:40px;opacity:0.3"></i>
      <p>Ты ещё не нашёл ни одного слова.<br>Исследуй локации!</p>
    </div>`;
  } else {
    div.innerHTML = slice.map((id, idx) => {
      const w = gameData.words[id];
      if (!w) return '';
      const num = String(page * WORDS_PER_PAGE + idx + 1).padStart(2, '0');
      return `<div class="word-card">
        <div class="word-card-num">#${num}</div>
        <div class="word-divider"></div>
        <div class="word-form">${w.form}</div>
        <div class="word-modern">→ ${w.modern}</div>
        <div class="word-era">${w.era}</div>
        <p class="word-desc">${w.description}</p>
      </div>`;
    }).join('');
  }

  if (direction !== 'none') {
    div.classList.add(direction === 'right' ? 'page-enter-right' : 'page-enter-left');
    setTimeout(() => div.classList.add('page-active'), 20);
  } else {
    div.classList.add('page-active');
  }

  pages.appendChild(div);
  lucide.createIcons();
}

function goArchivePage(page) {
  const direction = page > archivePage ? 'right' : 'left';
  renderArchivePage(page, direction);
}

// ─── Achievements ─────────────────────────────────────────────────────────────
function renderAchievements() {
  const grid = document.getElementById('achievements-grid');
  grid.innerHTML = ACHIEVEMENTS.map(a => {
    const unlocked = state.unlockedAchievements.includes(a.id);
    return `<div class="ach-card ${unlocked ? 'unlocked' : 'locked'}">
      <div class="ach-icon" style="background:${a.bg};border:1px solid ${a.color}40">
        <i data-lucide="${a.icon}" style="width:24px;height:24px;color:${a.color}"></i>
      </div>
      <div class="ach-name">${a.name}</div>
      <div class="ach-desc">${unlocked ? a.desc : '???'}</div>
    </div>`;
  }).join('');
  lucide.createIcons();
}

function openAchievements() {
  renderAchievements();
  document.getElementById('modal-achievements').classList.add('open');
}

function closeAchievements() {
  document.getElementById('modal-achievements').classList.remove('open');
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  const res = await fetch('data/gameData.json');
  gameData = await res.json();

  loadProgress();
  updateScoreUI();
  updateInventoryCount();
  document.getElementById('diff-badge').textContent = DIFF_LABELS[state.difficulty];

  // Sync difficulty modal cards
  _syncDiffCards('#modal-diff-grid', state.difficulty);

  // Show "Continue" button if save exists
  if (hasSave()) {
    document.getElementById('btn-continue').style.display = 'flex';
  }

  // Landing buttons → open difficulty modal first
  document.getElementById('btn-start-landing').onclick = () => openDifficultyModal();

  // Difficulty modal
  document.getElementById('btn-confirm-diff').onclick = () => {
    const video = document.getElementById('intro-video');
    if (video) video.currentTime = 0;
    const playPromise = video ? video.play() : null;
    if (playPromise) playPromise.catch(err => console.error('[VIDEO]', err.name, err.message));
    closeDifficultyModal();
    startIntro(playPromise);
  };
  document.getElementById('btn-close-diff').onclick = closeDifficultyModal;
  document.getElementById('btn-close-diff-cancel').onclick = closeDifficultyModal;
  document.getElementById('modal-difficulty').onclick = (e) => {
    if (e.target === e.currentTarget) closeDifficultyModal();
  };

  // Game topbar
  document.getElementById('btn-map').onclick = () => showScreen('map');
  document.getElementById('btn-inventory').onclick = () => showScreen('inventory');
  document.getElementById('btn-achievements').onclick = openAchievements;

  // Map / Inventory back
  document.getElementById('btn-back-map').onclick = () => showScreen('game');
  document.getElementById('btn-back-inv').onclick = () => showScreen('game');
  document.getElementById('archive-prev').onclick = () => goArchivePage(archivePage - 1);
  document.getElementById('archive-next').onclick = () => goArchivePage(archivePage + 1);

  // Achievements modal close
  document.getElementById('btn-close-achievements').onclick = closeAchievements;
  document.getElementById('modal-achievements').onclick = (e) => {
    if (e.target === e.currentTarget) closeAchievements();
  };

  showScreen('landing');
  lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', init);

// ─── 3D Coverflow Carousel ──────────────────────────────────────────
function initCarousel() {
  const slides = Array.from(document.querySelectorAll('.carousel-slide'));
  const dotsContainer = document.getElementById('carousel-dots');
  if (!slides.length || !dotsContainer) return;

  const total = slides.length;
  let current = 0;
  let autoTimer = null;
  let dragStartX = 0;

  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'carousel-dot';
    dot.setAttribute('aria-label', `Слайд ${i + 1}`);
    dot.onclick = () => goTo(i);
    dotsContainer.appendChild(dot);
  });

  function applyPositions() {
    const leftIdx  = ((current - 1) + total) % total;
    const rightIdx = (current + 1) % total;
    slides.forEach((slide, i) => {
      slide.classList.remove('pos-center', 'pos-left', 'pos-right');
      if (i === current)        slide.classList.add('pos-center');
      else if (i === leftIdx)   slide.classList.add('pos-left');
      else if (i === rightIdx)  slide.classList.add('pos-right');
    });
    Array.from(dotsContainer.children).forEach((d, i) => {
      d.classList.toggle('active', i === current);
    });
    lucide.createIcons();
  }

  function goTo(idx) {
    current = ((idx % total) + total) % total;
    applyPositions();
    resetAuto();
  }

  function resetAuto() {
    clearInterval(autoTimer);
    autoTimer = setInterval(() => goTo(current + 1), 3800);
  }

  document.getElementById('carousel-prev').onclick = () => goTo(current - 1);
  document.getElementById('carousel-next').onclick = () => goTo(current + 1);

  slides.forEach((slide, i) => {
    slide.addEventListener('click', () => { if (i !== current) goTo(i); });
  });

  const track = document.getElementById('carousel-track');
  track.addEventListener('mousedown',  e => { dragStartX = e.clientX; });
  track.addEventListener('mouseup',    e => {
    const dx = e.clientX - dragStartX;
    if (Math.abs(dx) > 50) goTo(dx < 0 ? current + 1 : current - 1);
  });
  track.addEventListener('touchstart', e => { dragStartX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend',   e => {
    const dx = e.changedTouches[0].clientX - dragStartX;
    if (Math.abs(dx) > 40) goTo(dx < 0 ? current + 1 : current - 1);
  });

  applyPositions();
  resetAuto();
}

document.addEventListener('DOMContentLoaded', initCarousel);
