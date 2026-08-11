const form = document.getElementById('login-form');
const errorEl = document.getElementById('login-error');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.classList.add('hidden');

  const password = document.getElementById('password').value;

  try {
    const res = await fetch('login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (data.ok) {
      window.location.href = './';
    } else {
      errorEl.textContent = data.error || 'Mot de passe incorrect.';
      errorEl.classList.remove('hidden');
    }
  } catch (err) {
    errorEl.textContent = 'Erreur de connexion au serveur.';
    errorEl.classList.remove('hidden');
  }
});
