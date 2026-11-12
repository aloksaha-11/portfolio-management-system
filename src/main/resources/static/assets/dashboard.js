(() => {
  const accountEmail = document.querySelector('#account-email');
  const portfolioList = document.querySelector('#portfolio-list');
  const emptyState = document.querySelector('#empty-state');
  const message = document.querySelector('#dashboard-message');
  const createForm = document.querySelector('#create-form');
  const createName = document.querySelector('#portfolio-name');
  const holdingForm = document.querySelector('#holding-form');
  const companyName = document.querySelector('#company-name');
  const tickerSelect = document.querySelector('#ticker');
  const holdingMessage = document.querySelector('#holding-message');
  const holdingList = document.querySelector('#holding-list');
  const holdingsEmpty = document.querySelector('#holdings-empty');
  const holdingsSection = document.querySelector('#holdings-section');
  const portfolioSelectWrap = document.querySelector('#portfolio-select-wrap');
  const existingPortfolioSelect = document.querySelector('#existing-portfolio');
  let portfolios = [];
  let details = new Map();
  let quotesByKey = new Map();
  let selectedPortfolioId = null;
  const companyCodes = new Map([
    ['Reliance Industries Limited', '500325'],
    ['Tata Consultancy Services Limited', '532540'],
    ['Infosys Limited', '500209'],
    ['ITC', '500875'],
    ['State Bank of India', '500112']
  ]);
  const codeCompanies = new Map([...companyCodes].map(([company, code]) => [code, company]));

  document.querySelector('#show-create').addEventListener('click', showCreateForm);
  document.querySelector('#empty-create').addEventListener('click', showCreateForm);
  document.querySelector('#cancel-create').addEventListener('click', () => { createForm.hidden = true; });
  document.querySelector('#add-holding-toggle').addEventListener('click', () => { holdingForm.hidden = !holdingForm.hidden; });
  document.querySelector('#cancel-holding').addEventListener('click', () => { holdingForm.hidden = true; });
  companyName.addEventListener('change', () => { tickerSelect.value = companyCodes.get(companyName.value) || ''; });
  tickerSelect.addEventListener('change', () => { companyName.value = codeCompanies.get(tickerSelect.value) || ''; });
  document.querySelector('#logout-button').addEventListener('click', logout);
  existingPortfolioSelect.addEventListener('change', () => {
    const portfolioId = Number(existingPortfolioSelect.value);
    if (Number.isSafeInteger(portfolioId) && portfolioId > 0) selectPortfolio(portfolioId);
  });
  createForm.addEventListener('submit', createPortfolio);
  holdingForm.addEventListener('submit', addHolding);

  initialize();

  async function initialize() {
    try {
      const account = await api('api/auth/me');
      accountEmail.textContent = account.email;
      portfolios = await api('api/portfolios');
      details = new Map(await Promise.all(portfolios.map(async (portfolio) => {
        const detail = await api(`api/portfolios/${portfolio.portfolioId}`);
        return [portfolio.portfolioId, detail];
      })));
      await loadMarketPrices();
      renderPortfolios();
      updateSummary();
      if (portfolios.length) selectPortfolio(portfolios[0].portfolioId);
    } catch (error) {
      showMessage(error.message || 'We could not load your portfolio. Refresh the page to try again.');
    }
  }

  async function createPortfolio(event) {
    event.preventDefault();
    clearMessage();
    if (!createForm.reportValidity()) return;
    const submit = createForm.querySelector('[type="submit"]');
    await withBusy(submit, 'Creating…', async () => {
      try {
        const csrf = await getCsrf();
        const created = await api('api/portfolios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
          body: JSON.stringify({ name: createName.value.trim() })
        });
        portfolios.push(created);
        details.set(created.portfolioId, await api(`api/portfolios/${created.portfolioId}`));
        createName.value = '';
        createForm.hidden = true;
        renderPortfolios();
        updateSummary();
        selectPortfolio(created.portfolioId);
        showMessage('Your portfolio is ready. Add an investment whenever you like.', 'success');
      } catch (error) {
        showMessage(error.message || 'We could not create that portfolio. Please try again.');
      }
    });
  }

  async function addHolding(event) {
    event.preventDefault();
    clearHoldingMessage();
    if (!holdingForm.reportValidity() || selectedPortfolioId === null) return;
    const submit = holdingForm.querySelector('[type="submit"]');
    await withBusy(submit, 'Saving…', async () => {
      try {
        const csrf = await getCsrf();
        const data = new FormData(holdingForm);
        await api(`api/portfolios/${selectedPortfolioId}/holdings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
          body: JSON.stringify({
            investmentType: data.get('investmentType'),
            companyName: data.get('companyName').trim(),
            ticker: data.get('ticker').trim() || null,
            unitsOwned: data.get('unitsOwned'),
            averagePurchasePrice: data.get('averagePurchasePrice')
          })
        });
        holdingForm.reset();
        holdingForm.hidden = true;
        details.set(selectedPortfolioId, await api(`api/portfolios/${selectedPortfolioId}`));
        await loadMarketPrices();
        renderHoldings();
        updateSummary();
        clearMessage();
        showMessage('Investment added to your portfolio.', 'success');
      } catch (error) {
        const text = error.status === 409
          ? 'A record with the same details already exists for the same holdings. Please add different details.'
          : error.message || 'We could not save that investment. Please check the details and try again.';
        holdingMessage.textContent = text;
        holdingMessage.className = 'dashboard-message';
      }
    });
  }

  async function logout() {
    const button = document.querySelector('#logout-button');
    await withBusy(button, 'Logging out…', async () => {
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
        showMessage(error.message || 'Logout failed. Please try again.');
      }
    });
  }

  function renderPortfolios() {
    portfolioList.replaceChildren();
    emptyState.hidden = portfolios.length !== 0;
    portfolioSelectWrap.hidden = portfolios.length === 0;
    existingPortfolioSelect.replaceChildren(new Option('Choose a portfolio', ''));
    portfolios.forEach((portfolio) => {
      existingPortfolioSelect.add(new Option(portfolio.name, String(portfolio.portfolioId)));
    });
    existingPortfolioSelect.value = selectedPortfolioId === null ? '' : String(selectedPortfolioId);
    portfolios.forEach((portfolio) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `portfolio-card${portfolio.portfolioId === selectedPortfolioId ? ' selected' : ''}`;
      card.setAttribute('aria-pressed', String(portfolio.portfolioId === selectedPortfolioId));
      const top = document.createElement('span');
      top.className = 'portfolio-card-top';
      const icon = document.createElement('span');
      icon.className = 'portfolio-card-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '↗';
      const currency = document.createElement('span');
      currency.className = 'portfolio-card-currency';
      currency.textContent = portfolio.currency || 'INR';
      top.append(icon, currency);
      const name = document.createElement('strong');
      name.textContent = portfolio.name;
      card.append(top, name);
      card.addEventListener('click', () => selectPortfolio(portfolio.portfolioId));
      portfolioList.append(card);
    });
  }

  function selectPortfolio(portfolioId) {
    selectedPortfolioId = portfolioId;
    holdingsSection.hidden = false;
    const selected = portfolios.find((portfolio) => portfolio.portfolioId === portfolioId);
    document.querySelector('#holdings-heading').textContent = selected ? `${selected.name} holdings` : 'Holdings';
    renderPortfolios();
    renderHoldings();
  }

  function renderHoldings() {
    const detail = details.get(selectedPortfolioId);
    const holdings = detail ? detail.holdings : [];
    holdingList.replaceChildren();
    holdingsEmpty.hidden = holdings.length !== 0;
    if (!holdings.length) return;
    const header = document.createElement('div');
    header.className = 'holding-row header';
    [
      ['TYPE / COMPANY', 'column-name'],
      ['UNITS', 'column-units'],
      ['AVG. PRICE', 'column-average'],
      ['BSE CLOSE', 'column-close'],
      ['MARKET VALUE', 'column-market'],
      ['COST BASIS', 'column-cost'],
      ['ACTIONS', 'column-actions']
    ].forEach(([label, className]) => {
      const cell = document.createElement('span');
      cell.className = className;
      cell.textContent = label;
      header.append(cell);
    });
    holdingList.append(header);
    holdings.forEach((holding) => {
      const row = document.createElement('div');
      row.className = 'holding-row';
      const name = document.createElement('span');
      name.className = 'holding-name';
      const type = document.createElement('span');
      type.className = 'holding-type';
      type.textContent = holding.investmentType;
      name.append(type);
      name.append(document.createTextNode(holding.investmentName));
      if (holding.ticker) {
        const ticker = document.createElement('span');
        ticker.className = 'holding-ticker';
        ticker.textContent = holding.ticker;
        name.append(ticker);
      }
      const quote = quoteFor(holding);
      const marketValue = quote ? Number(quote.closePrice) * Number(holding.unitsOwned) : null;
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'holding-delete';
      deleteButton.textContent = 'Delete';
      deleteButton.setAttribute('aria-label', `Delete ${holding.investmentName}`);
      deleteButton.addEventListener('click', () => deleteHolding(holding, deleteButton));
      row.append(
        name,
        cell(formatNumber(holding.unitsOwned), 'column-units'),
        cell(formatCurrency(holding.averagePurchasePrice), 'column-average'),
        cell(quote ? formatCurrency(quote.closePrice) : '—', 'column-close'),
        cell(marketValue === null ? '—' : formatCurrency(marketValue), 'column-market'),
        cell(formatCurrency(holding.costBasis), 'column-cost'),
        deleteButton
      );
      holdingList.append(row);
    });
  }

  async function deleteHolding(holding, button) {
    if (!window.confirm(`Delete ${holding.investmentName} from this portfolio? This cannot be undone.`)) return;
    clearHoldingMessage();
    await withBusy(button, 'Deleting…', async () => {
      try {
        const csrf = await getCsrf();
        await api(`api/holdings/${holding.holdingId}`, {
          method: 'DELETE',
          headers: { [csrf.headerName]: csrf.token }
        });
        details.set(selectedPortfolioId, await api(`api/portfolios/${selectedPortfolioId}`));
        await loadMarketPrices();
        renderHoldings();
        updateSummary();
        holdingMessage.textContent = 'Holding deleted.';
        holdingMessage.className = 'dashboard-message success';
      } catch (error) {
        holdingMessage.textContent = error.message || 'We could not delete this holding. Please try again.';
        holdingMessage.className = 'dashboard-message';
      }
    });
  }

  function updateSummary() {
    let holdingCount = 0;
    let costBasis = 0;
    let marketValue = 0;
    let pricedCount = 0;
    details.forEach((detail) => detail.holdings.forEach((holding) => {
      holdingCount += 1;
      costBasis += Number(holding.costBasis) || 0;
      const quote = quoteFor(holding);
      if (quote) {
        marketValue += Number(quote.closePrice) * Number(holding.unitsOwned);
        pricedCount += 1;
      }
    }));
    document.querySelector('#portfolio-count').textContent = String(portfolios.length);
    document.querySelector('#holding-count').textContent = String(holdingCount);
    document.querySelector('#cost-basis').textContent = formatCurrency(costBasis);
    document.querySelector('#market-value').textContent = holdingCount === 0
      ? '—'
      : pricedCount === holdingCount ? formatCurrency(marketValue) : '—';
    document.querySelector('#market-value-caption').textContent = holdingCount === 0
      ? 'Add holdings with BSE symbols to get started'
      : pricedCount === holdingCount ? 'Latest BSE closing price × units owned' : `${pricedCount} of ${holdingCount} holdings matched to BSE prices`;
  }

  async function loadMarketPrices() {
    try {
      const status = await api('api/market-data/bse/status');
      document.querySelector('#price-as-of').textContent = status.latestTradeDate
        ? `LATEST CLOSE · ${status.latestTradeDate}`
        : 'NO CLOSE IMPORTED YET';
      const keys = [...new Set([...details.values()].flatMap((detail) => detail.holdings
        .map((holding) => holding.ticker?.trim().toUpperCase())
        .filter(Boolean)))];
      quotesByKey = new Map();
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
    } catch (error) {
      document.querySelector('#price-as-of').textContent = 'BSE prices unavailable';
      quotesByKey = new Map();
    }
  }

  function quoteFor(holding) {
    const key = holding.ticker?.trim().toUpperCase();
    return key ? quotesByKey.get(key) || null : null;
  }

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

  function showCreateForm() {
    createForm.hidden = false;
    createName.focus();
  }

  function showMessage(text, kind = 'error') {
    message.textContent = text;
    message.className = `dashboard-message${text ? ` ${kind}` : ''}`;
  }

  function clearMessage() {
    showMessage('');
  }

  function clearHoldingMessage() {
    holdingMessage.textContent = '';
    holdingMessage.className = 'dashboard-message';
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
})();
