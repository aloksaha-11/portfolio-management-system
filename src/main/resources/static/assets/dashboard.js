(() => {
  const accountEmail = document.querySelector('#account-email');
  const portfolioList = document.querySelector('#portfolio-list');
  const emptyState = document.querySelector('#empty-state');
  const message = document.querySelector('#dashboard-message');
  const createForm = document.querySelector('#create-form');
  const createName = document.querySelector('#portfolio-name');
  const holdingForm = document.querySelector('#holding-form');
  const investmentTypeSelect = document.querySelector('#investment-type');
  const companyName = document.querySelector('#company-name');
  const companyNameLabel = document.querySelector('label[for="company-name"]');
  const companyNameOptions = document.querySelector('#company-name-options');
  const tickerSelect = document.querySelector('#ticker');
  const tickerField = tickerSelect.closest('.field');
  const tickerHelp = document.querySelector('#ticker-help');
  const holdingMessage = document.querySelector('#holding-message');
  const holdingList = document.querySelector('#holding-list');
  const soldHoldingList = document.querySelector('#sold-holding-list');
  const soldHoldingsEmpty = document.querySelector('#sold-holdings-empty');
  const holdingsEmpty = document.querySelector('#holdings-empty');
  const holdingsSection = document.querySelector('#holdings-section');
  const portfolioSelectWrap = document.querySelector('#portfolio-select-wrap');
  const existingPortfolioSelect = document.querySelector('#existing-portfolio');
  const bseDataBody = document.querySelector('#bse-data-body');
  const bseDataMessage = document.querySelector('#bse-data-message');
  const bseDataCount = document.querySelector('#bse-data-count');
  const bseDataSearch = document.querySelector('#bse-data-search');
  const bseDateSelect = document.querySelector('#bse-date-select');
  let selectedTradeDate = null;
  let portfolios = [];
  let details = new Map();
  let soldHoldings = new Map();
  let quotesByKey = new Map();
  let selectedPortfolioId = null;
  let allBsePrices = [];
  const symbolToCompany = new Map();
  const companyToSymbol = new Map();
  const companyCodes = new Map([
    ['Reliance Industries Limited', '500325'],
    ['Tata Consultancy Services Limited', '532540'],
    ['Infosys Limited', '500209'],
    ['ITC', '500875'],
    ['State Bank of India', '500112']
  ]);
  const codeCompanies = new Map([...companyCodes].map(([company, code]) => [code, company]));
  let allCompanyNames = [...companyCodes.keys()];

  document.querySelector('#show-create').addEventListener('click', showCreateForm);
  document.querySelector('#empty-create').addEventListener('click', showCreateForm);
  document.querySelector('#cancel-create').addEventListener('click', () => { createForm.hidden = true; });
  document.querySelector('#add-holding-toggle').addEventListener('click', () => { holdingForm.hidden = !holdingForm.hidden; });
  document.querySelector('#cancel-holding').addEventListener('click', () => { holdingForm.hidden = true; });
  investmentTypeSelect.addEventListener('change', configureInvestmentNameFields);
  companyName.addEventListener('input', () => {
    syncTickerFromCompanyName();
    filterCompanySuggestions();
  });
  companyName.addEventListener('change', syncTickerFromCompanyName);
  tickerSelect.addEventListener('change', () => {
    companyName.value = symbolToCompany.get(tickerSelect.value) || codeCompanies.get(tickerSelect.value) || '';
  });
  document.querySelector('#logout-button').addEventListener('click', logout);
  bseDataSearch.addEventListener('input', renderBsePrices);
  bseDateSelect?.addEventListener('change', async () => {
    const chosen = bseDateSelect.value;
    if (chosen && chosen !== selectedTradeDate) {
      selectedTradeDate = chosen;
      await loadBseDateData(selectedTradeDate);
    }
  });
  existingPortfolioSelect.addEventListener('change', () => {
    const portfolioId = Number(existingPortfolioSelect.value);
    if (Number.isSafeInteger(portfolioId) && portfolioId > 0) selectPortfolio(portfolioId);
  });
  createForm.addEventListener('submit', createPortfolio);
  holdingForm.addEventListener('submit', addHolding);
  document.querySelectorAll('.bse-tag-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const type = e.currentTarget.getAttribute('data-type');
      if (type) openHoldingFormWithType(type);
    });
  });

  function openHoldingFormWithType(type) {
    if (!selectedPortfolioId && portfolios.length > 0) {
      selectPortfolio(portfolios[0].id);
    }
    if (holdingsSection) holdingsSection.hidden = false;
    if (holdingForm) {
      holdingForm.hidden = false;
      investmentTypeSelect.value = type;
      configureInvestmentNameFields();
      holdingForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
      companyName.focus();
    }
  }

  initialize();

  async function initialize() {
    try {
      const portfoliosSection = document.querySelector('[aria-labelledby="portfolio-heading"]');
      portfoliosSection.before(holdingsSection);
      const account = await api('api/auth/me');
      accountEmail.textContent = account.email;
      portfolios = await api('api/portfolios');
      const loadedPortfolios = await Promise.all(portfolios.map(async (portfolio) => {
        const detail = await api(`api/portfolios/${portfolio.portfolioId}`);
        const sold = await api(`api/portfolios/${portfolio.portfolioId}/sold-holdings`).catch(() => []);
        return { portfolioId: portfolio.portfolioId, detail, sold };
      }));
      details = new Map(loadedPortfolios.map(({ portfolioId, detail }) => [portfolioId, detail]));
      soldHoldings = new Map(loadedPortfolios.map(({ portfolioId, sold }) => [portfolioId, sold]));
      await Promise.allSettled([loadMarketPrices(), loadBseDateData()]);
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
        soldHoldings.set(created.portfolioId, []);
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
        const investmentType = data.get('investmentType');
        const companyOrInvestmentName = data.get('companyName').trim()
          || (investmentType === 'Commodities-Gold' ? 'Gold'
            : investmentType === 'Commodities-Silver' ? 'Silver' : '');
        await api(`api/portfolios/${selectedPortfolioId}/holdings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
          body: JSON.stringify({
            investmentType,
            companyName: companyOrInvestmentName,
            ticker: tickerField.hidden ? null : data.get('ticker').trim() || null,
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
    renderSoldHoldings();
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
      ['DATE', 'column-date'],
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
      const actions = document.createElement('span');
      actions.className = 'holding-action-buttons column-actions';
      const sellButton = document.createElement('button');
      sellButton.type = 'button';
      sellButton.className = 'holding-sell';
      sellButton.textContent = 'Sell';
      sellButton.setAttribute('aria-label', `Sell all ${formatNumber(holding.unitsOwned)} units of ${holding.investmentName}`);
      sellButton.addEventListener('click', () => sellHolding(holding, sellButton));
      actions.append(sellButton);
      row.append(
        name,
        cell(formatNumber(holding.unitsOwned), 'column-units'),
        cell(formatCurrency(holding.averagePurchasePrice), 'column-average'),
        cell(quote ? formatCurrency(quote.closePrice) : '—', 'column-close'),
        cell(marketValue === null ? '—' : formatCurrency(marketValue), 'column-market'),
        cell(formatCurrency(holding.costBasis), 'column-cost'),
        cell(formatDate(holding.createdAt), 'column-date'),
        actions
      );
      holdingList.append(row);
    });
  }

  function renderSoldHoldings() {
    const rows = soldHoldings.get(selectedPortfolioId) || [];
    soldHoldingList.replaceChildren();
    soldHoldingsEmpty.hidden = rows.length !== 0;
    if (!rows.length) return;
    const header = document.createElement('div');
    header.className = 'sold-holding-row header';
    ['TYPE / COMPANY', 'UNITS', 'AVG. PRICE', 'COST BASIS', 'DATE ADDED', 'DATE SOLD']
      .forEach((label) => {
        const cellElement = document.createElement('span');
        cellElement.textContent = label;
        header.append(cellElement);
      });
    soldHoldingList.append(header);
    rows.forEach((holding) => {
      const row = document.createElement('div');
      row.className = 'sold-holding-row';
      const name = document.createElement('span');
      name.className = 'holding-name';
      const type = document.createElement('span');
      type.className = 'holding-type';
      type.textContent = holding.investmentType;
      name.append(type, document.createTextNode(holding.investmentName));
      row.append(
        name,
        cell(formatNumber(holding.unitsOwned)),
        cell(formatCurrency(holding.averagePurchasePrice)),
        cell(formatCurrency(holding.costBasis)),
        cell(formatDate(holding.addedAt)),
        cell(formatDate(holding.soldAt))
      );
      soldHoldingList.append(row);
    });
  }

  async function sellHolding(holding, button) {
    if (!window.confirm(`Sell all ${formatNumber(holding.unitsOwned)} units of ${holding.investmentName}? This will move the holding to SOLD.`)) return;
    clearHoldingMessage();
    await withBusy(button, 'Selling…', async () => {
      try {
        const csrf = await getCsrf();
        await api(`api/holdings/${holding.holdingId}/sell`, {
          method: 'POST',
          headers: { [csrf.headerName]: csrf.token }
        });
        details.set(selectedPortfolioId, await api(`api/portfolios/${selectedPortfolioId}`));
        soldHoldings.set(selectedPortfolioId,
          await api(`api/portfolios/${selectedPortfolioId}/sold-holdings`));
        await loadMarketPrices();
        renderHoldings();
        renderSoldHoldings();
        updateSummary();
        holdingMessage.textContent = 'Holding moved to SOLD.';
        holdingMessage.className = 'dashboard-message success';
      } catch (error) {
        holdingMessage.textContent = error.message || 'We could not sell this holding. Please try again.';
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
        ? `PREVIOUS DAY CLOSE · ${formatTradeDate(status.latestTradeDate)}`
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

  async function loadBseDateData(preferredDate) {
    try {
      if (!preferredDate) {
        const dates = await api('api/market-data/bse/dates');
        if (Array.isArray(dates) && dates.length > 0) {
          if (bseDateSelect) {
            bseDateSelect.replaceChildren();
            dates.forEach((date) => {
              const iso = toIsoDateString(date);
              const opt = document.createElement('option');
              opt.value = iso;
              opt.textContent = formatTradeDate(date);
              bseDateSelect.append(opt);
            });
          }
          selectedTradeDate = toIsoDateString(dates[0]);
          if (bseDateSelect) bseDateSelect.value = selectedTradeDate;
        } else {
          if (bseDateSelect) {
            bseDateSelect.replaceChildren();
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'No dates available';
            bseDateSelect.append(opt);
          }
          bseDataCount.textContent = 'Prices unavailable';
          bseDataMessage.textContent = 'No trade dates available in BSE daily prices.';
          return;
        }
      } else {
        selectedTradeDate = toIsoDateString(preferredDate);
        if (bseDateSelect) bseDateSelect.value = selectedTradeDate;
      }

      bseDataCount.textContent = 'Loading prices…';
      bseDataMessage.textContent = `Loading BSE data for ${formatTradeDate(selectedTradeDate)}…`;

      const result = await api(`api/market-data/bse/by-date?tradeDate=${encodeURIComponent(selectedTradeDate)}`);
      if (!Array.isArray(result)) throw new Error('The BSE prices response was not a list.');
      allBsePrices = result;
      populateBseListings(allBsePrices);
      renderBseTrendAnalysis(allBsePrices);
      renderBsePrices();
    } catch (error) {
      bseDataCount.textContent = 'Prices unavailable';
      const panel = document.querySelector('#bse-trend-panel');
      if (panel) panel.hidden = true;
      const label = selectedTradeDate ? formatTradeDate(selectedTradeDate) : 'selected date';
      bseDataMessage.textContent = error.message || `Could not load BSE prices for ${label}.`;
    }
  }

  function renderBseTrendAnalysis(prices) {
    const panel = document.querySelector('#bse-trend-panel');
    if (!panel) return;
    if (!Array.isArray(prices) || prices.length === 0) {
      panel.hidden = true;
      return;
    }

    let advances = 0;
    let declines = 0;
    let unchanged = 0;
    let sumPct = 0;
    let countedForPct = 0;
    let totalVolume = 0;

    prices.forEach((price) => {
      const close = Number(price.closePrice);
      const prev = Number(price.previousClose);
      if (Number.isFinite(close) && Number.isFinite(prev) && prev > 0 && close > 0) {
        if (close > prev) advances++;
        else if (close < prev) declines++;
        else unchanged++;

        const pct = ((close - prev) / prev) * 100;
        sumPct += pct;
        countedForPct++;
      }
      if (price.volume != null) {
        totalVolume += Number(price.volume) || 0;
      }
    });

    const totalValid = advances + declines + unchanged;
    if (totalValid === 0) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;

    const advancesPct = ((advances / totalValid) * 100).toFixed(1);
    const declinesPct = ((declines / totalValid) * 100).toFixed(1);
    const unchangedPct = ((unchanged / totalValid) * 100).toFixed(1);
    const avgChange = countedForPct > 0 ? (sumPct / countedForPct).toFixed(2) : '0.00';
    const isUp = advances >= declines;

    // Badge
    const badge = document.querySelector('#bse-trend-badge');
    const badgeText = document.querySelector('#bse-trend-text');
    const badgeIcon = document.querySelector('#bse-trend-icon');
    if (badge && badgeText && badgeIcon) {
      badge.className = isUp ? 'bse-trend-badge up' : 'bse-trend-badge down';
      badgeIcon.textContent = isUp ? '▲' : '▼';
      const sign = Number(avgChange) > 0 ? '+' : '';
      badgeText.textContent = `Market is ${isUp ? 'UP' : 'DOWN'} (${sign}${avgChange}% Avg)`;
    }

    // Stats
    const statAdv = document.querySelector('#bse-stat-advances');
    const statDec = document.querySelector('#bse-stat-declines');
    const statVol = document.querySelector('#bse-stat-volume');
    if (statAdv) statAdv.textContent = advances.toLocaleString('en-IN');
    if (statDec) statDec.textContent = declines.toLocaleString('en-IN');
    if (statVol) {
      const volM = (totalVolume / 1e6).toFixed(1);
      statVol.textContent = `${volM}M shares`;
    }

    // Breadth Bar
    const upLabel = document.querySelector('#bse-breadth-up-label');
    const downLabel = document.querySelector('#bse-breadth-down-label');
    const segUp = document.querySelector('#bse-seg-up');
    const segSame = document.querySelector('#bse-seg-same');
    const segDown = document.querySelector('#bse-seg-down');

    if (upLabel) upLabel.textContent = `▲ Advances: ${advances.toLocaleString('en-IN')} (${advancesPct}%)`;
    if (downLabel) downLabel.textContent = `▼ Declines: ${declines.toLocaleString('en-IN')} (${declinesPct}%)`;
    if (segUp) segUp.style.width = `${advancesPct}%`;
    if (segSame) segSame.style.width = `${unchangedPct}%`;
    if (segDown) segDown.style.width = `${declinesPct}%`;

    // Key Movers
    const moversContainer = document.querySelector('#bse-trend-movers-list');
    if (moversContainer) {
      moversContainer.replaceChildren();
      const targetSymbols = ['RELIANCE', 'TCS', 'INFY', 'ICICIBANK', 'SBIN', 'ITC'];
      const found = new Map();
      prices.forEach((p) => {
        const sym = p.symbol?.trim().toUpperCase();
        if (targetSymbols.includes(sym) && !found.has(sym)) {
          found.set(sym, p);
        }
      });

      targetSymbols.forEach((sym) => {
        const item = found.get(sym);
        if (item && item.previousClose && item.closePrice) {
          const close = Number(item.closePrice);
          const prev = Number(item.previousClose);
          const diff = close - prev;
          const pct = ((diff / prev) * 100).toFixed(2);
          const moverUp = diff >= 0;

          const chip = document.createElement('span');
          chip.className = `bse-mover-chip ${moverUp ? 'up' : 'down'}`;
          chip.title = `${item.companyName || sym}: ₹${formatNumber(prev)} → ₹${formatNumber(close)}`;
          chip.innerHTML = `<span class="mover-symbol">${sym}</span> <span class="mover-change">${moverUp ? '+' : ''}${pct}% ${moverUp ? '▲' : '▼'}</span>`;
          moversContainer.append(chip);
        }
      });
    }

    // Downturn suggestion advisory: Show when market is going down, hide when market is going up
    const suggestionBox = document.querySelector('#bse-trend-suggestion');
    if (suggestionBox) {
      suggestionBox.hidden = isUp;
    }
  }

  function renderBsePrices() {
    const query = bseDataSearch.value.trim().toLocaleLowerCase();
    const prices = query
      ? allBsePrices.filter((price) => [price.companyName, price.symbol]
        .some((value) => value?.toLocaleLowerCase().includes(query)))
      : allBsePrices;
    const rows = document.createDocumentFragment();
    prices.forEach((price) => {
      const row = document.createElement('tr');
      const displayName = price.symbol || price.isin || price.securityCode;
      [displayName, price.securityCode, price.series, price.openPrice, price.highPrice,
        price.lowPrice, price.closePrice, price.previousClose, price.volume]
        .forEach((value, index) => {
          const cell = document.createElement('td');
          cell.textContent = value == null ? '—'
            : index >= 3 && index <= 7 ? formatNumber(value)
              : String(value);
          row.append(cell);
        });
      rows.append(row);
    });
    bseDataBody.replaceChildren(rows);
    bseDataCount.textContent = query
      ? `${prices.length.toLocaleString('en-IN')} of ${allBsePrices.length.toLocaleString('en-IN')} securities`
      : `${allBsePrices.length.toLocaleString('en-IN')} securities`;
    const displayDate = selectedTradeDate ? formatTradeDate(selectedTradeDate) : 'selected date';
    bseDataMessage.textContent = query
      ? prices.length ? `Matching BSE rows for “${bseDataSearch.value.trim()}”.` : 'No matching company or symbol found.'
      : allBsePrices.length ? `Showing BSE rows imported for ${displayDate}.` : `No BSE prices were found for ${displayDate}.`;
  }

  function populateBseListings(prices) {
    const symbols = [...new Set(prices.map((price) => price.symbol?.trim()).filter(Boolean))].sort();
    const listings = new Map();
    prices.forEach((price) => {
      const symbol = price.symbol?.trim();
      const name = price.companyName?.trim();
      if (symbol && name && !listings.has(symbol)) listings.set(symbol, name);
    });
    symbolToCompany.clear();
    companyToSymbol.clear();
    listings.forEach((name, symbol) => {
      symbolToCompany.set(symbol, name);
      if (!companyToSymbol.has(name)) companyToSymbol.set(name, symbol);
    });

    const symbolGroup = makeOptionGroup(tickerSelect, 'BSE symbols', symbols);
    const companyNames = [...new Set(listings.values())].sort((a, b) => a.localeCompare(b));
    populateCompanySuggestions(companyNames);
    tickerHelp.textContent = listings.size
      ? `${symbols.length.toLocaleString('en-IN')} BSE symbols and ${companyNames.length.toLocaleString('en-IN')} company names loaded.`
      : 'BSE symbols loaded; company names were not present in the imported data.';
  }

  function makeOptionGroup(select, label, values) {
    select.querySelector(`optgroup[label="${label}"]`)?.remove();
    const group = document.createElement('optgroup');
    group.label = label;
    const existing = new Set([...select.options].map((option) => option.value));
    values.forEach((value) => {
      if (!existing.has(value)) group.append(new Option(value, value));
    });
    if (group.children.length) select.append(group);
    return group;
  }

  function populateCompanySuggestions(names) {
    allCompanyNames = [...new Set([...companyCodes.keys(), ...names])].sort((a, b) => a.localeCompare(b));
    filterCompanySuggestions();
  }

  function filterCompanySuggestions() {
    const prefix = companyName.value.trim().toLocaleLowerCase();
    const matches = allCompanyNames.filter((name) => name.toLocaleLowerCase().startsWith(prefix));
    companyNameOptions.replaceChildren(...matches.map((name) => new Option(name, name)));
  }

  function syncTickerFromCompanyName() {
    const name = companyName.value.trim();
    tickerSelect.value = companyToSymbol.get(name) || companyCodes.get(name) || '';
  }

  function configureInvestmentNameFields() {
    const investmentType = investmentTypeSelect.value;
    const isCommodity = investmentType === 'Commodities-Gold' || investmentType === 'Commodities-Silver';
    companyName.required = !isCommodity;
    companyNameLabel.textContent = isCommodity ? 'Commodity name (optional)' : 'Company name';
    companyName.placeholder = isCommodity ? 'Optional; defaults to Gold or Silver' : 'Type to search companies';
    tickerField.hidden = isCommodity;
    if (isCommodity) {
      companyName.value = '';
      tickerSelect.value = '';
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

  function formatDate(value) {
    const numericValue = typeof value === 'number' || (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value))
      ? Number(value)
      : null;
    const date = new Date(numericValue === null
      ? value
      : Math.abs(numericValue) < 1e12 ? numericValue * 1000 : numericValue);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata'
    }).format(date);
  }
})();
