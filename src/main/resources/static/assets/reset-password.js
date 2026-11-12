(() => {
  const form = document.querySelector('#reset-password-form');
  const password = document.querySelector('#new-password');
  const confirmation = document.querySelector('#confirm-password');
  const message = document.querySelector('#form-message');
  const button = document.querySelector('#submit-button');
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
  window.history.replaceState(null, '', window.location.pathname + window.location.search);

  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    form.hidden = true;
    setMessage('This password reset link is invalid or has expired. Request a new link.', 'error');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage('');
    if (!token || !form.reportValidity()) return;
    if (password.value !== confirmation.value) {
      setMessage('The passwords do not match.');
      confirmation.focus();
      return;
    }

    button.disabled = true;
    button.classList.add('loading');
    button.querySelector('span').textContent = 'Updating…';
    try {
      const csrf = await getCsrf();
      const response = await fetch('api/auth/password-reset/confirm', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
        body: JSON.stringify({ token, newPassword: password.value })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'This password reset link is invalid or has expired. Request a new link.');
      form.hidden = true;
      setMessage('Your password has been reset. You can now log in.', 'success');
    } catch (error) {
      setMessage(error.message || 'We could not reset your password. Request a new link and try again.');
    } finally {
      button.disabled = false;
      button.classList.remove('loading');
      button.querySelector('span').textContent = 'Reset password';
    }
  });

  async function getCsrf() {
    const response = await fetch('api/auth/csrf', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('We could not start a secure request. Please try again.');
    return response.json();
  }

  function setMessage(text, kind = 'error') {
    message.textContent = text;
    message.className = `form-message${text ? ` ${kind}` : ''}`;
  }
})();
