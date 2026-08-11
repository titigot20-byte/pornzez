const AGE_GATE_KEY = 'age_verified_v1';

const ageGate = document.getElementById('age-gate');
const site = document.getElementById('site');
const ageYesBtn = document.getElementById('age-yes');
const ageNoBtn = document.getElementById('age-no');

function showSite() {
  ageGate.classList.add('hidden');
  site.classList.remove('hidden');
  loadVideos();
  initAds();
}

function initAds() {
  try {
    document.querySelectorAll('ins.adsbygoogle').forEach(() => {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    });
  } catch (e) {
    console.error('Erreur AdSense', e);
  }
}

function initAgeGate() {
  const verified = sessionStorage.getItem(AGE_GATE_KEY);
  if (verified === 'yes') {
    showSite();
  }
}

ageYesBtn.addEventListener('click', () => {
  sessionStorage.setItem(AGE_GATE_KEY, 'yes');
  showSite();
});

ageNoBtn.addEventListener('click', () => {
  window.location.href = 'https://www.google.com';
});

// --- Galerie de vidéos ---
const videoGrid = document.getElementById('video-grid');
const emptyState = document.getElementById('empty-state');

const playerOverlay = document.getElementById('player-overlay');
const playerVideo = document.getElementById('player-video');
const playerTitle = document.getElementById('player-title');
const playerDescription = document.getElementById('player-description');
const playerClose = document.getElementById('player-close');

async function loadVideos() {
  try {
    const res = await fetch('/api/videos');
    const videos = await res.json();
    renderVideos(videos);
  } catch (e) {
    console.error('Erreur de chargement des vidéos', e);
  }
}

function renderVideos(videos) {
  videoGrid.innerHTML = '';
  if (!videos.length) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  videos.forEach((video) => {
    const card = document.createElement('button');
    card.className = 'video-card';
    card.innerHTML = `
      <video class="video-card__thumb" src="/media/${video.fileId}" preload="metadata" muted></video>
      <div class="video-card__body">
        <p class="video-card__title">${escapeHtml(video.title)}</p>
        <p class="video-card__date">${formatDate(video.createdAt)}</p>
      </div>
    `;
    card.addEventListener('click', () => openPlayer(video));
    videoGrid.appendChild(card);
  });
}

function openPlayer(video) {
  playerVideo.src = `/media/${video.fileId}`;
  playerTitle.textContent = video.title;
  playerDescription.textContent = video.description || '';
  playerOverlay.classList.remove('hidden');
  playerVideo.play().catch(() => {});
}

function closePlayer() {
  playerVideo.pause();
  playerVideo.src = '';
  playerOverlay.classList.add('hidden');
}

playerClose.addEventListener('click', closePlayer);
playerOverlay.addEventListener('click', (e) => {
  if (e.target === playerOverlay) closePlayer();
});

function formatDate(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

initAgeGate();
