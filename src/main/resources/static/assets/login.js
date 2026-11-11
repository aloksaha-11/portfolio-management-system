(() => {
  const form = document.querySelector('#login-form');
  const message = document.querySelector('#form-message');
  const button = document.querySelector('#submit-button');
  const password = document.querySelector('#password');

  document.querySelector('.show-password').addEventListener('click', (event) => {
    const showing = password.type === 'text';
    password.type = showing ? 'password' : 'text';
    event.currentTarget.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  });

  document.querySelector('#forgot-link').addEventListener('click', (event) => {
    event.preventDefault();
    setMessage('Password recovery is not available yet. Please contact support for help.', 'error');
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage('');
    if (!form.reportValidity()) return;

    button.disabled = true;
    button.classList.add('loading');
    button.querySelector('span').textContent = 'Logging in…';
    try {
      const csrfResponse = await fetch('api/auth/csrf', { headers: { Accept: 'application/json' } });
      if (!csrfResponse.ok) throw new Error('We could not start a secure login. Please try again.');
      const csrf = await csrfResponse.json();
      const response = await fetch('api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
        body: JSON.stringify({ email: form.email.value.trim(), password: password.value })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 429) throw new Error('Too many attempts. Please wait a little and try again.');
        if (response.status === 401) throw new Error('That email and password combination doesn’t match.');
        throw new Error(result.message || 'Login failed. Please try again.');
      }
      window.location.assign('dashboard.html');
    } catch (error) {
      setMessage(error.message || 'Something went wrong. Please try again.');
    } finally {
      button.disabled = false;
      button.classList.remove('loading');
      button.querySelector('span').textContent = 'Login';
    }
  });

  function setMessage(text, kind = 'error') {
    message.textContent = text;
    message.className = `form-message${text ? ` ${kind}` : ''}`;
  }
})();
