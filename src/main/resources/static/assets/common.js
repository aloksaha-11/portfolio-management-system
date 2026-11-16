// Shared helpers for the signed-in pages (dashboard.html, portfolio-details.html).
window.Folio = (() => {
  async function api(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    if (response.status === 401) {
      window.location.replace('login.html');
      throw new Error('Your session has ended. Please log in again.');
    }
    if (!response.ok) throw await responseError(response, 'Something went wrong. Please try again.');
    if (response.status === 204) return null;
    return response.json();
  }

  async function getCsrf() {
    const response = await fetch('api/auth/csrf', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!response.ok) throw await responseError(response, 'We could not start a secure request. Please try again.');
    return response.json();
  }

  async function responseError(response, fallback) {
    const result = await response.json().catch(() => ({}));
    const error = new Error(result.message || fallback);
    error.status = response.status;
    return error;
  }

  async function withBusy(button, label, action) {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = label;
    try {
      await action();
    } finally {
      if (button.isConnected) {
        button.disabled = false;
        button.textContent = original;
      }
    }
  }

  // Shows the signed-in email in the top bar and wires up the Logout button.
  // onError receives a message to display if logout fails.
  async function setupAccountBar(onError) {
    const button = document.querySelector('#logout-button');
    button.addEventListener('click', () => withBusy(button, 'Logging out…', async () => {
      try {
        const csrf = await getCsrf();
        const response = await fetch('api/auth/logout', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { [csrf.headerName]: csrf.token }
        });
        if (!response.ok) throw await responseError(response, 'Logout failed. Please try again.');
        const sessionCheck = await fetch('api/auth/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
        if (sessionCheck.status !== 401) {
          throw new Error('Your session is still active. Please try signing out again.');
        }
        window.location.replace(new URL('login.html', document.baseURI));
      } catch (error) {
        onError(error.message || 'Logout failed. Please try again.');
      }
    }));
    const account = await api('api/auth/me');
    document.querySelector('#account-email').textContent = account.email;
    return account;
  }

  function cell(value, className = '') {
    const element = document.createElement('span');
    element.className = `holding-value ${className}`.trim();
    element.textContent = value;
    return element;
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value) || 0);
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 8 }).format(Number(value) || 0);
  }

  function parseInstant(value) {
    const numericValue = typeof value === 'number' || (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value))
      ? Number(value)
      : null;
    return new Date(numericValue === null
      ? value
      : Math.abs(numericValue) < 1e12 ? numericValue * 1000 : numericValue);
  }

  function formatDate(value) {
    const date = parseInstant(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata'
    }).format(date);
  }

  // Calendar day in India as 'YYYY-MM-DD', comparable with <input type="date"> values
  function toIndiaDateKey(value) {
    const date = parseInstant(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Kolkata'
    }).format(date);
  }

  function toIsoDateString(val) {
    if (!val) return '';
    if (Array.isArray(val)) {
      const y = String(val[0]).padStart(4, '0');
      const m = String(val[1]).padStart(2, '0');
      const d = String(val[2]).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const str = String(val).trim();
    if (str.includes(',')) {
      const parts = str.split(',').map((p) => p.trim());
      if (parts.length === 3) {
        return `${parts[0].padStart(4, '0')}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
    }
    return str;
  }

  function formatTradeDate(val) {
    const iso = toIsoDateString(val);
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length !== 3) return iso;
    const [year, month, day] = parts;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const idx = parseInt(month, 10) - 1;
    const mon = monthNames[idx] || month;
    const paddedDay = String(parseInt(day, 10)).padStart(2, '0');
    return `${paddedDay}-${mon}-${year}`;
  }

  // Fetches latest BSE closes for the tickers of the given holdings.
  // Returns a Map keyed by upper-cased symbol and security code.
  async function loadQuotes(holdings) {
    const keys = [...new Set(holdings
      .map((holding) => holding.ticker?.trim().toUpperCase())
      .filter(Boolean))];
    const quotesByKey = new Map();
    for (let start = 0; start < keys.length; start += 200) {
      const params = new URLSearchParams();
      keys.slice(start, start + 200).forEach((key) => params.append('keys', key));
      const quotes = await api(`api/market-data/bse/latest?${params.toString()}`);
      quotes.forEach((quote) => {
        [quote.symbol, quote.securityCode].filter(Boolean).forEach((key) => {
          const normalized = key.trim().toUpperCase();
          if (!quotesByKey.has(normalized)) quotesByKey.set(normalized, quote);
        });
      });
    }
    return quotesByKey;
  }

  function quoteFor(quotesByKey, holding) {
    const key = holding.ticker?.trim().toUpperCase();
    return key ? quotesByKey.get(key) || null : null;
  }

  function portfolioDetailsUrl(portfolioId, investmentType) {
    const params = new URLSearchParams();
    if (portfolioId != null) params.set('portfolioId', String(portfolioId));
    if (investmentType) params.set('type', investmentType);
    const query = params.toString();
    return `portfolio-details.html${query ? `?${query}` : ''}`;
  }

  return {
    api, getCsrf, responseError, withBusy, setupAccountBar, cell,
    formatCurrency, formatNumber, parseInstant, formatDate, toIndiaDateKey,
    toIsoDateString, formatTradeDate, loadQuotes, quoteFor, portfolioDetailsUrl
  };
})();
