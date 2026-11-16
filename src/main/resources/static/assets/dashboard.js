(() => {
  const {
    api, getCsrf, withBusy, setupAccountBar, formatCurrency, formatNumber,
    toIsoDateString, formatTradeDate, loadQuotes, quoteFor, portfolioDetailsUrl
  } = window.Folio;

  const portfolioList = document.querySelector('#portfolio-list');
  const emptyState = document.querySelector('#empty-state');
  const message = document.querySelector('#dashboard-message');
  const createForm = document.querySelector('#create-form');
  const createName = document.querySelector('#portfolio-name');
  const portfolioSelectWrap = document.querySelector('#portfolio-select-wrap');
  const existingPortfolioSelect = document.querySelector('#existing-portfolio');
  const portfolioDetailsLink = document.querySelector('#portfolio-details-link');
  const bseDataBody = document.querySelector('#bse-data-body');
  const bseDataMessage = document.querySelector('#bse-data-message');
  const bseDataCount = document.querySelector('#bse-data-count');
  const bseDataSearch = document.querySelector('#bse-data-search');
  const bseDateSelect = document.querySelector('#bse-date-select');
  let selectedTradeDate = null;
  let portfolios = [];
  let details = new Map();
  let quotesByKey = new Map();
  let selectedPortfolioId = null;
  let allBsePrices = [];

  document.querySelector('#show-create').addEventListener('click', showCreateForm);
  document.querySelector('#empty-create').addEventListener('click', showCreateForm);
  document.querySelector('#cancel-create').addEventListener('click', () => { createForm.hidden = true; });
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
  // Market Downturn Advisory buttons open Portfolio Details with the Add investment form pre-set to that type
  document.querySelectorAll('.bse-tag-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const type = e.currentTarget.getAttribute('data-type');
      if (!type) return;
      if (!portfolios.length) {
        showMessage('Create a portfolio first, then you can add investments to it.');
        showCreateForm();
        createForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      window.location.href = portfolioDetailsUrl(selectedPortfolioId ?? portfolios[0].portfolioId, type);
    });
  });

  initialize();

  async function initialize() {
    try {
      await setupAccountBar(showMessage);
      portfolios = await api('api/portfolios');
      const loadedDetails = await Promise.all(portfolios.map((portfolio) => api(`api/portfolios/${portfolio.portfolioId}`)));
      details = new Map(portfolios.map((portfolio, index) => [portfolio.portfolioId, loadedDetails[index]]));
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
        createName.value = '';
        createForm.hidden = true;
        selectPortfolio(created.portfolioId);
        updateSummary();
        showMessage('Your portfolio is ready. Click Portfolio Details to add investments.', 'success');
      } catch (error) {
        showMessage(error.message || 'We could not create that portfolio. Please try again.');
      }
    });
  }

  function renderPortfolios() {
    portfolioList.replaceChildren();
    emptyState.hidden = portfolios.length !== 0;
    portfolioSelectWrap.hidden = portfolios.length === 0;
    portfolioDetailsLink.hidden = portfolios.length === 0;
    portfolioDetailsLink.href = portfolioDetailsUrl(selectedPortfolioId);
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

  // Selecting a portfolio highlights it; the Portfolio Details button then opens that portfolio
  function selectPortfolio(portfolioId) {
    selectedPortfolioId = portfolioId;
    renderPortfolios();
  }

  function updateSummary() {
    let holdingCount = 0;
    let costBasis = 0;
    let marketValue = 0;
    let pricedCount = 0;
    details.forEach((detail) => detail.holdings.forEach((holding) => {
      holdingCount += 1;
      costBasis += Number(holding.costBasis) || 0;
      const quote = quoteFor(quotesByKey, holding);
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
      quotesByKey = await loadQuotes([...details.values()].flatMap((detail) => detail.holdings));
    } catch (error) {
      quotesByKey = new Map();
    }
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

    if (upLabel) upLabel.textContent = `▲ Profit: ${advances.toLocaleString('en-IN')} (${advancesPct}%)`;
    if (downLabel) downLabel.textContent = `▼ Loss: ${declines.toLocaleString('en-IN')} (${declinesPct}%)`;
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
})();
