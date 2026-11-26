(() => {
  const {
    api, getCsrf, withBusy, setupAccountBar, cell, formatCurrency, formatNumber, formatDate,
    toIndiaDateKey, toIsoDateString, formatTradeDate, loadQuotes, quoteFor, portfolioDetailsUrl
  } = window.Folio;

  const pageMessage = document.querySelector('#page-message');
  const portfolioSelect = document.querySelector('#details-portfolio');
  const noPortfolios = document.querySelector('#no-portfolios');
  const holdingsSection = document.querySelector('#holdings-section');
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
  const holdingsEmpty = document.querySelector('#holdings-empty');
  const soldHoldingList = document.querySelector('#sold-holding-list');
  const soldHoldingsEmpty = document.querySelector('#sold-holdings-empty');
  const priceAsOf = document.querySelector('#price-as-of');

  let portfolios = [];
  let selectedPortfolioId = null;
  let detail = null;
  let soldRows = [];
  let quotesByKey = new Map();
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
  holdingForm.addEventListener('submit', addHolding);
  portfolioSelect.addEventListener('change', () => {
    const portfolioId = Number(portfolioSelect.value);
    if (Number.isSafeInteger(portfolioId) && portfolioId > 0) selectPortfolio(portfolioId);
  });

  initialize();

  async function initialize() {
    try {
      await setupAccountBar(showPageMessage);
      portfolios = await api('api/portfolios');
      if (!portfolios.length) {
        updateSummary();
        noPortfolios.hidden = false;
        portfolioSelect.closest('.portfolio-select-wrap').hidden = true;
        return;
      }
      portfolioSelect.replaceChildren(...portfolios.map((p) => new Option(p.name, String(p.portfolioId))));

      const params = new URLSearchParams(window.location.search);
      const requestedId = Number(params.get('portfolioId'));
      const initialId = portfolios.some((p) => p.portfolioId === requestedId)
        ? requestedId
        : portfolios[0].portfolioId;
      await selectPortfolio(initialId);

      // Opened from a Market Downturn Advisory button: open the form with that type selected
      const requestedType = params.get('type');
      if (requestedType && [...investmentTypeSelect.options].some((o) => o.value === requestedType)) {
        holdingForm.hidden = false;
        investmentTypeSelect.value = requestedType;
        configureInvestmentNameFields();
        holdingForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        companyName.focus();
      }

      // Company names and symbols for the Add investment form (large download; not awaited)
      loadBseListings();
    } catch (error) {
      showPageMessage(error.message || 'We could not load your portfolio. Refresh the page to try again.');
    }
  }

  async function selectPortfolio(portfolioId) {
    selectedPortfolioId = portfolioId;
    portfolioSelect.value = String(portfolioId);
    // Keep the address bar in sync so refresh/bookmark returns to the same portfolio
    window.history.replaceState(null, '', portfolioDetailsUrl(portfolioId));
    const selected = portfolios.find((p) => p.portfolioId === portfolioId);
    document.querySelector('#holdings-heading').textContent = selected ? `${selected.name} holdings` : 'Holdings';
    document.title = selected ? `${selected.name} · Portfolio details · Portfolio Rebalancing System` : 'Portfolio details · Portfolio Rebalancing System';
    clearHoldingMessage();
    holdingsSection.hidden = false;
    await reloadPortfolio();
    if (portfolioId !== selectedPortfolioId) return; // user switched again meanwhile
    renderHoldings();
    resetSoldFilter();
    updateSummary();
  }

  // Totals across all of the user's portfolios, shown in the summary boxes
  async function updateSummary() {
    try {
      const allDetails = await Promise.all(portfolios.map((p) => api(`api/portfolios/${p.portfolioId}`)));
      const holdings = allDetails.flatMap((d) => d.holdings);
      const quotes = await loadQuotes(holdings).catch(() => new Map());
      let costBasis = 0;
      let marketValue = 0;
      let pricedCount = 0;
      holdings.forEach((holding) => {
        costBasis += Number(holding.costBasis) || 0;
        const quote = quoteFor(quotes, holding);
        if (quote) {
          marketValue += Number(quote.closePrice) * Number(holding.unitsOwned);
          pricedCount += 1;
        }
      });
      const holdingCount = holdings.length;
      const allPriced = holdingCount > 0 && pricedCount === holdingCount;
      document.querySelector('#portfolio-count').textContent = String(portfolios.length);
      document.querySelector('#holding-count').textContent = String(holdingCount);
      document.querySelector('#cost-basis').textContent = formatCurrency(costBasis);
      document.querySelector('#market-value').textContent = allPriced ? formatCurrency(marketValue) : '—';
      document.querySelector('#market-value-caption').textContent = holdingCount === 0
        ? 'Add holdings with BSE symbols to get started'
        : allPriced ? 'Latest BSE closing price × units owned' : `${pricedCount} of ${holdingCount} holdings matched to BSE prices`;
    } catch (error) {
      document.querySelector('#market-value-caption').textContent = 'Summary unavailable; refresh to try again.';
    }
  }

  async function reloadPortfolio() {
    const portfolioId = selectedPortfolioId;
    const [loadedDetail, loadedSold] = await Promise.all([
      api(`api/portfolios/${portfolioId}`),
      api(`api/portfolios/${portfolioId}/sold-holdings`).catch(() => [])
    ]);
    if (portfolioId !== selectedPortfolioId) return;
    detail = loadedDetail;
    soldRows = loadedSold;
    await loadMarketPrices();
  }

  async function loadMarketPrices() {
    try {
      const status = await api('api/market-data/bse/status');
      priceAsOf.textContent = status.latestTradeDate
        ? `PREVIOUS DAY CLOSE · ${formatTradeDate(status.latestTradeDate)}`
        : 'NO CLOSE IMPORTED YET';
      quotesByKey = await loadQuotes(detail ? detail.holdings : []);
    } catch (error) {
      priceAsOf.textContent = 'BSE prices unavailable';
      quotesByKey = new Map();
    }
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
        configureInvestmentNameFields();
        await reloadPortfolio();
        renderHoldings();
        updateSummary();
        holdingMessage.textContent = 'Investment added to your portfolio.';
        holdingMessage.className = 'dashboard-message success';
      } catch (error) {
        const text = error.status === 409
          ? 'A record with the same details already exists for the same holdings. Please add different details.'
          : error.message || 'We could not save that investment. Please check the details and try again.';
        holdingMessage.textContent = text;
        holdingMessage.className = 'dashboard-message';
      }
    });
  }

  function renderHoldings() {
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
      const headerCell = document.createElement('span');
      headerCell.className = className;
      headerCell.textContent = label;
      header.append(headerCell);
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
      const quote = quoteFor(quotesByKey, holding);
      const marketValue = quote ? Number(quote.closePrice) * Number(holding.unitsOwned) : null;
      const actions = document.createElement('span');
      actions.className = 'holding-action-buttons column-actions';
      const sellButton = document.createElement('button');
      sellButton.type = 'button';
      sellButton.className = 'holding-sell';
      sellButton.textContent = 'Sell';
      sellButton.setAttribute('aria-label', `Sell ${formatNumber(holding.unitsOwned)} units of ${holding.investmentName}`);
      sellButton.addEventListener('click', () => openSellDialog(holding));
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

  // SOLD table view: null = last RECENT_SOLD_COUNT sales, otherwise { from, to } as 'YYYY-MM-DD' (inclusive)
  const RECENT_SOLD_COUNT = 5;
  const soldFilterForm = document.querySelector('#sold-filter-form');
  const soldFromDate = document.querySelector('#sold-from-date');
  const soldToDate = document.querySelector('#sold-to-date');
  const soldFilterCaption = document.querySelector('#sold-filter-caption');
  let soldDateRange = null;

  soldFilterForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const from = soldFromDate.value;
    const to = soldToDate.value;
    if (!from || !to) {
      showSoldFilterError('Select both a From date and a To date, then click Show.');
      return;
    }
    if (from > to) {
      showSoldFilterError('The From date must be on or before the To date.');
      return;
    }
    soldDateRange = { from, to };
    renderSoldHoldings();
  });

  document.querySelector('#sold-show-recent').addEventListener('click', resetSoldFilter);

  function resetSoldFilter() {
    soldDateRange = null;
    soldFromDate.value = '';
    soldToDate.value = '';
    renderSoldHoldings();
  }

  function showSoldFilterError(text) {
    soldFilterCaption.textContent = text;
    soldFilterCaption.className = 'sold-filter-caption error';
  }

  function renderSoldHoldings() {
    const allRows = soldRows;
    // Rows arrive newest first from the API
    const rows = soldDateRange
      ? allRows.filter((holding) => {
        const soldDay = toIndiaDateKey(holding.soldAt);
        return soldDay && soldDay >= soldDateRange.from && soldDay <= soldDateRange.to;
      })
      : allRows.slice(0, RECENT_SOLD_COUNT);
    soldHoldingList.replaceChildren();
    soldFilterCaption.className = 'sold-filter-caption';
    if (soldDateRange) {
      const range = `${formatDate(`${soldDateRange.from}T00:00:00+05:30`)} and ${formatDate(`${soldDateRange.to}T00:00:00+05:30`)}`;
      soldFilterCaption.textContent = rows.length
        ? `Showing ${rows.length} sale${rows.length === 1 ? '' : 's'} between ${range}.`
        : `No sales between ${range}.`;
    } else {
      soldFilterCaption.textContent = allRows.length
        ? `Showing the last ${rows.length} sale${rows.length === 1 ? '' : 's'}${allRows.length > rows.length ? ` of ${allRows.length}` : ''}.`
        : '';
    }
    soldHoldingsEmpty.hidden = allRows.length !== 0;
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

  let activeSellHolding = null;
  const sellModal = document.querySelector('#sell-modal');
  const sellForm = document.querySelector('#sell-form');
  const sellInvestmentName = document.querySelector('#sell-investment-name');
  const sellAvailableUnits = document.querySelector('#sell-available-units');
  const sellAllDesc = document.querySelector('#sell-all-desc');
  const sellOptAll = document.querySelector('#sell-opt-all');
  const sellOptPartial = document.querySelector('#sell-opt-partial');
  const sellPartialSection = document.querySelector('#sell-partial-section');
  const sellUnitsInput = document.querySelector('#sell-units-input');
  const sellMaxBtn = document.querySelector('#sell-max-btn');
  const sellCalcSold = document.querySelector('#sell-calc-sold');
  const sellCalcRemaining = document.querySelector('#sell-calc-remaining');
  const sellDialogError = document.querySelector('#sell-dialog-error');
  const sellSubmitBtn = document.querySelector('#sell-submit-btn');
  const sellCancelBtn = document.querySelector('#sell-cancel-btn');
  const sellModalClose = document.querySelector('#sell-modal-close');

  function openSellDialog(holding) {
    activeSellHolding = holding;
    if (sellDialogError) {
      sellDialogError.textContent = '';
      sellDialogError.className = 'dashboard-message';
    }
    if (sellInvestmentName) sellInvestmentName.textContent = holding.investmentName;
    if (sellAvailableUnits) sellAvailableUnits.textContent = `${formatNumber(holding.unitsOwned)} units`;
    if (sellAllDesc) sellAllDesc.textContent = `Sell all ${formatNumber(holding.unitsOwned)} units and move to SOLD`;

    if (sellOptAll) sellOptAll.checked = true;
    if (sellPartialSection) sellPartialSection.hidden = true;
    if (sellUnitsInput) {
      sellUnitsInput.value = '';
      sellUnitsInput.max = holding.unitsOwned;
    }
    if (sellCalcSold) sellCalcSold.textContent = '0 units';
    if (sellCalcRemaining) sellCalcRemaining.textContent = `${formatNumber(holding.unitsOwned)} units`;

    if (sellModal && typeof sellModal.showModal === 'function') {
      sellModal.showModal();
    }
  }

  sellOptAll?.addEventListener('change', () => {
    if (sellPartialSection) sellPartialSection.hidden = true;
    if (sellDialogError) sellDialogError.textContent = '';
  });

  sellOptPartial?.addEventListener('change', () => {
    if (sellPartialSection) sellPartialSection.hidden = false;
    if (sellUnitsInput) {
      sellUnitsInput.focus();
      updateSellPreview();
    }
  });

  sellUnitsInput?.addEventListener('input', updateSellPreview);

  sellMaxBtn?.addEventListener('click', () => {
    if (activeSellHolding && sellUnitsInput) {
      sellUnitsInput.value = activeSellHolding.unitsOwned;
      updateSellPreview();
    }
  });

  function updateSellPreview() {
    if (!activeSellHolding) return;
    const max = Number(activeSellHolding.unitsOwned);
    const entered = Number(sellUnitsInput.value);
    if (!sellUnitsInput.value || Number.isNaN(entered) || entered <= 0) {
      sellCalcSold.textContent = '0 units';
      sellCalcRemaining.textContent = `${formatNumber(max)} units`;
      if (sellDialogError) sellDialogError.textContent = '';
      return;
    }
    if (entered > max) {
      if (sellDialogError) sellDialogError.textContent = `Cannot sell more than ${formatNumber(max)} units.`;
      sellCalcSold.textContent = `${formatNumber(entered)} units`;
      sellCalcRemaining.textContent = '0 units';
      return;
    }
    if (sellDialogError) sellDialogError.textContent = '';
    const remaining = max - entered;
    sellCalcSold.textContent = `${formatNumber(entered)} units`;
    sellCalcRemaining.textContent = `${formatNumber(remaining)} units`;
  }

  sellCancelBtn?.addEventListener('click', () => sellModal?.close());
  sellModalClose?.addEventListener('click', () => sellModal?.close());

  sellForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeSellHolding) return;

    let unitsToSell = null;
    const isPartial = sellOptPartial?.checked;
    const max = Number(activeSellHolding.unitsOwned);

    if (isPartial) {
      const entered = Number(sellUnitsInput.value);
      if (!sellUnitsInput.value || Number.isNaN(entered) || entered <= 0) {
        if (sellDialogError) sellDialogError.textContent = 'Please enter a valid number of units to sell (greater than 0).';
        sellUnitsInput.focus();
        return;
      }
      if (entered > max) {
        if (sellDialogError) sellDialogError.textContent = `Cannot sell more than ${formatNumber(max)} units.`;
        sellUnitsInput.focus();
        return;
      }
      unitsToSell = entered;
    }

    clearHoldingMessage();
    if (sellSubmitBtn) {
      sellSubmitBtn.disabled = true;
      sellSubmitBtn.textContent = 'Selling…';
    }

    try {
      const csrf = await getCsrf();
      const body = unitsToSell != null ? JSON.stringify({ units: unitsToSell }) : null;
      await api(`api/holdings/${activeSellHolding.holdingId}/sell`, {
        method: 'POST',
        headers: {
          [csrf.headerName]: csrf.token,
          ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        body: body
      });

      sellModal?.close();
      await reloadPortfolio();
      renderHoldings();
      resetSoldFilter();
      updateSummary();

      if (isPartial && unitsToSell < max) {
        const remaining = max - unitsToSell;
        holdingMessage.textContent = `Sold ${formatNumber(unitsToSell)} units of “${activeSellHolding.investmentName}”. Remaining balance: ${formatNumber(remaining)} units.`;
      } else {
        holdingMessage.textContent = `Moved all ${formatNumber(max)} units of “${activeSellHolding.investmentName}” to SOLD.`;
      }
      holdingMessage.className = 'dashboard-message success';
    } catch (error) {
      if (sellDialogError) sellDialogError.textContent = error.message || 'Could not sell holding. Please try again.';
    } finally {
      if (sellSubmitBtn) {
        sellSubmitBtn.disabled = false;
        sellSubmitBtn.textContent = 'Confirm sale';
      }
    }
  });

  // Company names and BSE symbols for the Add investment form, from the latest imported trade date
  async function loadBseListings() {
    try {
      const dates = await api('api/market-data/bse/dates');
      if (!Array.isArray(dates) || !dates.length) return;
      const latest = toIsoDateString(dates[0]);
      const prices = await api(`api/market-data/bse/by-date?tradeDate=${encodeURIComponent(latest)}`);
      if (Array.isArray(prices)) populateBseListings(prices);
    } catch (error) {
      tickerHelp.textContent = 'Could not load BSE company names; the listed companies are still available.';
    }
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

    makeOptionGroup(tickerSelect, 'BSE symbols', symbols);
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

  function clearHoldingMessage() {
    holdingMessage.textContent = '';
    holdingMessage.className = 'dashboard-message';
  }

  function showPageMessage(text, kind = 'error') {
    pageMessage.textContent = text;
    pageMessage.className = `dashboard-message${text ? ` ${kind}` : ''}`;
  }
})();
