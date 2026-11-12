(() => {
  const form = document.querySelector('#reset-request-form');
  const email = document.querySelector('#email');
  const message = document.querySelector('#form-message');
  const button = document.querySelector('#submit-button');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage('');
    if (!form.reportValidity()) return;

    button.disabled = true;
    button.classList.add('loading');
    button.querySelector('span').textContent = 'Sending…';
    try {
      const csrf = await getCsrf();
      const response = await fetch('api/auth/password-reset/request', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
        body: JSON.stringify({ email: email.value.trim() })
      });
      if (!response.ok) throw new Error('We could not process the request. Please try again shortly.');
      email.value = '';
      setMessage('If an account exists for that email, password reset instructions will be sent shortly.', 'success');
    } catch (error) {
      setMessage(error.message || 'We could not process the request. Please try again shortly.');
    } finally {
      button.disabled = false;
      button.classList.remove('loading');
      button.querySelector('span').textContent = 'Send reset link';
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
