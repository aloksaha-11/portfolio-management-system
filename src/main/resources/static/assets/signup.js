(() => {
  const form = document.querySelector('#signup-form');
  const email = document.querySelector('#signup-email');
  const password = document.querySelector('#signup-password');
  const confirmPassword = document.querySelector('#confirm-password');
  const message = document.querySelector('#signup-message');
  const button = document.querySelector('#signup-button');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage('');
    confirmPassword.setCustomValidity(
      password.value === confirmPassword.value ? '' : 'Passwords do not match.'
    );
    if (!form.reportValidity()) return;
    if ([...password.value].length < 8) {
      setMessage('Password must contain at least 8 characters.');
      password.focus();
      return;
    }

    button.disabled = true;
    button.classList.add('loading');
    button.querySelector('span').textContent = 'Creating account…';
    try {
      const csrfResponse = await fetch('api/auth/csrf', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      });
      if (!csrfResponse.ok) throw new Error('We could not start a secure sign-up. Please try again.');
      const csrf = await csrfResponse.json();
      const response = await fetch('api/auth/register', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
        body: JSON.stringify({ email: email.value.trim(), password: password.value })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409) throw new Error('An account with this email already exists. Try signing in instead.');
        throw new Error(result.message || 'Account creation failed. Please try again.');
      }

      setMessage('Your account is ready. Sign in to get started.', 'success');
      button.querySelector('span').textContent = 'Account created';
      button.disabled = true;
      form.querySelectorAll('input').forEach((input) => { input.disabled = true; });
    } catch (error) {
      setMessage(error.message || 'Something went wrong. Please try again.');
      button.disabled = false;
      button.querySelector('span').textContent = 'Create account';
    } finally {
      button.classList.remove('loading');
    }
  });

  function setMessage(text, kind = 'error') {
    message.textContent = text;
    message.className = `form-message${text ? ` ${kind}` : ''}`;
  }
})();
