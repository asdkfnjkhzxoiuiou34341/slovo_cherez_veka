const SAVE_KEY = 'scv_save';

const BASE = (() => {
  const p = location.pathname;
  if (p.includes('/slovo_cherez_veka')) return '/slovo_cherez_veka';
  return p.replace(/\/[^/]*$/, '');
})();

const DIFF_LABELS = {
  novice:   'Первопроходец',
  explorer: 'Исследователь',
  keeper:   'Хранитель',
};

let selectedDiff = 'explorer';

function hasSave() {
  return !!localStorage.getItem(SAVE_KEY);
}

function getSavedDiff() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    return d?.difficulty || 'explorer';
  } catch { return 'explorer'; }
}

function syncDiffCards(diff) {
  document.querySelectorAll('#modal-diff-grid .diff-card').forEach(c => {
    const sel = c.dataset.diff === diff;
    c.classList.toggle('selected', sel);
    c.querySelectorAll('[id*="mcheck-icon-"]').forEach(ic => {
      ic.style.display = sel ? 'block' : 'none';
    });
  });
}

function selectDifficultyModal(diff) {
  selectedDiff = diff;
  syncDiffCards(diff);
  lucide.createIcons();
}

function openDifficultyModal() {
  syncDiffCards(selectedDiff);
  lucide.createIcons();
  document.getElementById('modal-difficulty').classList.add('open');
}

function closeDifficultyModal() {
  document.getElementById('modal-difficulty').classList.remove('open');
}

function goToGame() {
  // сохраняем выбранную сложность
  let save = {};
  try { save = JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch {}
  save.difficulty = selectedDiff;
  save.freshStart = true; // флаг — запустить пролог заново
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  window.location.href = BASE + '/game.html';
}

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

document.addEventListener('DOMContentLoaded', () => {
  // если есть сохранение — показываем кнопку "Продолжить"
  if (hasSave()) {
    const btn = document.getElementById('btn-continue');
    if (btn) btn.style.display = 'flex';
    selectedDiff = getSavedDiff();
  }

  document.getElementById('btn-start-landing').onclick = openDifficultyModal;

  document.getElementById('btn-confirm-diff').onclick = goToGame;
  document.getElementById('btn-close-diff').onclick = closeDifficultyModal;
  document.getElementById('btn-close-diff-cancel').onclick = closeDifficultyModal;
  document.getElementById('modal-difficulty').onclick = (e) => {
    if (e.target === e.currentTarget) closeDifficultyModal();
  };

  syncDiffCards(selectedDiff);
  lucide.createIcons();
});

// Carousel
document.addEventListener('DOMContentLoaded', () => {
  const slides = Array.from(document.querySelectorAll('.carousel-slide'));
  const dotsContainer = document.getElementById('carousel-dots');
  if (!slides.length || !dotsContainer) return;

  const total = slides.length;
  let current = 0;
  let autoTimer = null;

  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'carousel-dot';
    dot.onclick = () => goTo(i);
    dotsContainer.appendChild(dot);
  });

  function applyPositions() {
    const leftIdx  = ((current - 1) + total) % total;
    const rightIdx = (current + 1) % total;
    slides.forEach((slide, i) => {
      slide.classList.remove('pos-center', 'pos-left', 'pos-right');
      if (i === current)       slide.classList.add('pos-center');
      else if (i === leftIdx)  slide.classList.add('pos-left');
      else if (i === rightIdx) slide.classList.add('pos-right');
    });
    Array.from(dotsContainer.children).forEach((d, i) => {
      d.classList.toggle('active', i === current);
    });
  }

  function goTo(idx) {
    current = ((idx % total) + total) % total;
    applyPositions();
    clearInterval(autoTimer);
    autoTimer = setInterval(() => goTo(current + 1), 3800);
  }

  document.getElementById('carousel-prev').onclick = () => goTo(current - 1);
  document.getElementById('carousel-next').onclick = () => goTo(current + 1);

  const track = document.getElementById('carousel-track');
  let dragStartX = 0;
  track.addEventListener('mousedown',  e => { dragStartX = e.clientX; });
  track.addEventListener('mouseup',    e => { if (Math.abs(e.clientX - dragStartX) > 50) goTo(e.clientX < dragStartX ? current + 1 : current - 1); });
  track.addEventListener('touchstart', e => { dragStartX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend',   e => { if (Math.abs(e.changedTouches[0].clientX - dragStartX) > 40) goTo(e.changedTouches[0].clientX < dragStartX ? current + 1 : current - 1); });

  goTo(0);
});
