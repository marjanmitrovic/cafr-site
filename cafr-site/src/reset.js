import './style.css';

const API_BASE = localStorage.getItem('cafr-api-base') || 'http://localhost:3001';
const app = document.querySelector('#app');
const token = new URLSearchParams(window.location.search).get('token') || '';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

app.innerHTML = `
  <main class="standalone-page">
    <section class="dashboard-panel standalone-card">
      <a class="dashboard-brand" href="/"><img src="/assets/ucfr-logo.svg" alt="UČFR"><span>UČFR</span></a>
      <h1>Obnovení hesla</h1>
      ${token ? `
        <form id="resetForm" class="form">
          <label>Nové heslo<input name="password" type="password" minlength="8" required></label>
          <label>Nové heslo znovu<input name="confirmPassword" type="password" minlength="8" required></label>
          <button class="primary" type="submit">Nastavit nové heslo</button>
          <p id="resetMessage"></p>
        </form>
      ` : '<p>Odkaz neobsahuje platný token.</p>'}
    </section>
  </main>
`;

const form = document.querySelector('#resetForm');
if (form) {
  form.onsubmit = async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const password = String(data.get('password') || '');
    const confirmPassword = String(data.get('confirmPassword') || '');
    const message = document.querySelector('#resetMessage');

    if (password !== confirmPassword) {
      message.textContent = 'Hesla se neshodují.';
      return;
    }

    message.textContent = 'Ukládám…';
    try {
      const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Reset failed');
      message.innerHTML = `${escapeHtml(result.message)} <a href="/">Přihlásit se</a>`;
      form.querySelectorAll('input, button').forEach((element) => { element.disabled = true; });
    } catch (error) {
      message.textContent = error.message;
    }
  };
}
