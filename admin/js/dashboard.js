const uploadForm = document.getElementById('upload-form');
const uploadSubmit = document.getElementById('upload-submit');
const uploadError = document.getElementById('upload-error');
const uploadSuccess = document.getElementById('upload-success');
const progressWrap = document.getElementById('upload-progress');
const progressBar = document.getElementById('upload-progress-bar');

const videoList = document.getElementById('admin-video-list');
const emptyState = document.getElementById('admin-empty-state');

const logoutBtn = document.getElementById('logout-btn');

logoutBtn.addEventListener('click', async () => {
  await fetch('logout', { method: 'POST' });
  window.location.href = 'login.html';
});

uploadForm.addEventListener('submit', (e) => {
  e.preventDefault();
  uploadError.classList.add('hidden');
  uploadSuccess.classList.add('hidden');

  const formData = new FormData(uploadForm);
  const xhr = new XMLHttpRequest();

  uploadSubmit.disabled = true;
  progressWrap.classList.remove('hidden');
  progressBar.style.width = '0%';

  xhr.upload.addEventListener('progress', (evt) => {
    if (evt.lengthComputable) {
      const pct = Math.round((evt.loaded / evt.total) * 100);
      progressBar.style.width = pct + '%';
    }
  });

  xhr.onload = () => {
    uploadSubmit.disabled = false;
    progressWrap.classList.add('hidden');

    let data = {};
    try { data = JSON.parse(xhr.responseText); } catch (e) {}

    if (xhr.status === 201) {
      uploadSuccess.classList.remove('hidden');
      uploadForm.reset();
      loadVideos();
    } else {
      uploadError.textContent = data.error || 'Une erreur est survenue.';
      uploadError.classList.remove('hidden');
    }
  };

  xhr.onerror = () => {
    uploadSubmit.disabled = false;
    progressWrap.classList.add('hidden');
    uploadError.textContent = 'Erreur de connexion au serveur.';
    uploadError.classList.remove('hidden');
  };

  xhr.open('POST', '/api/admin/videos');
  xhr.send(formData);
});

async function loadVideos() {
  const res = await fetch('/api/admin/videos');
  if (res.status === 401) {
    window.location.href = 'login.html';
    return;
  }
  const videos = await res.json();
  renderVideos(videos);
}

function renderVideos(videos) {
  videoList.innerHTML = '';
  if (!videos.length) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  videos.forEach((video) => {
    const row = document.createElement('div');
    row.className = 'admin-video-row';
    row.innerHTML = `
      <video class="admin-video-row__thumb" src="/media/${video.fileId}" preload="metadata" muted></video>
      <div class="admin-video-row__info">
        <p class="admin-video-row__title">${escapeHtml(video.title)}</p>
        <p class="admin-video-row__date">${formatDate(video.createdAt)}</p>
      </div>
      <button class="btn btn--danger btn--small" data-id="${video.id}">Supprimer</button>
    `;
    row.querySelector('button').addEventListener('click', () => deleteVideo(video.id));
    videoList.appendChild(row);
  });
}

async function deleteVideo(id) {
  if (!confirm('Supprimer définitivement cette vidéo ?')) return;
  const res = await fetch(`/api/admin/videos/${id}`, { method: 'DELETE' });
  if (res.ok) loadVideos();
}

function formatDate(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

loadVideos();
