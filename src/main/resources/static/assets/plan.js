(() => {
  const { api, getCsrf, withBusy, setupAccountBar, formatCurrency, formatDate } = window.Folio;

  const ASSETS = [
    { key: 'shares', label: 'Shares', holdingType: 'Stocks/Shares' },
    { key: 'bonds', label: 'Bonds', holdingType: 'Bonds' },
    { key: 'gold', label: 'Commodities-Gold', holdingType: 'Commodities-Gold' },
    { key: 'silver', label: 'Commodities-Silver', holdingType: 'Commodities-Silver' },
    { key: 'mutualFunds', label: 'Mutual Funds', holdingType: 'Mutual Funds' }
  ];
  const RISK_LABELS = { CONSERVATIVE: 'Conservative', MODERATE: 'Moderate', AGGRESSIVE: 'Aggressive' };

  const pageMessage = document.querySelector('#page-message');
  const form = document.querySelector('#plan-form');
  const budgetInput = document.querySelector('#plan-budget');
  const riskSelect = document.querySelector('#plan-risk');
  const planError = document.querySelector('#plan-error');
  const fillMessage = document.querySelector('#fill-message');
  const resultSection = document.querySelector('#plan-result');
  const historyList = document.querySelector('#history-list');
  const historyEmpty = document.querySelector('#history-empty');
  const yearsSelect = document.querySelector('#projection-years');
  const amountInputs = new Map(ASSETS.map((a) => [a.key, document.querySelector(`#current-${a.key}`)]));
  let recentPlans = [];
  let shownPlan = null;

  amountInputs.forEach((input) => input.addEventListener('input', updateCurrentShares));
  yearsSelect.addEventListener('change', () => shownPlan && renderProjection(shownPlan));
  document.querySelector('#fill-from-holdings').addEventListener('click', fillFromHoldings);
  form.addEventListener('submit', createPlan);

  initialize();

  async function initialize() {
    try {
      await setupAccountBar(showPageMessage);
      await loadHistory();
    } catch (error) {
      showPageMessage(error.message || 'We could not load your plans. Refresh the page to try again.');
    }
  }

  function readAmount(input) {
    const value = Number(input.value);
    return input.value.trim() === '' || !Number.isFinite(value) ? 0 : value;
  }

  // Live "share of total" column as the user types
  function updateCurrentShares() {
    const values = ASSETS.map((a) => readAmount(amountInputs.get(a.key)));
    const total = values.reduce((sum, v) => sum + Math.max(v, 0), 0);
    ASSETS.forEach((asset, i) => {
      document.querySelector(`[data-pct="${asset.key}"]`).textContent =
        total > 0 ? `${((Math.max(values[i], 0) / total) * 100).toFixed(1)}%` : '0%';
    });
    document.querySelector('#current-total').textContent = formatCurrency(total);
  }

  // Pre-fills the amounts with the cost basis of the user's holdings, per investment type
  async function fillFromHoldings(event) {
    const button = event.currentTarget;
    await withBusy(button, 'Loading…', async () => {
      try {
        const portfolios = await api('api/portfolios');
        const details = await Promise.all(portfolios.map((p) => api(`api/portfolios/${p.portfolioId}`)));
        const totals = new Map(ASSETS.map((a) => [a.key, 0]));
        let count = 0;
        details.forEach((detail) => detail.holdings.forEach((holding) => {
          const asset = ASSETS.find((a) => a.holdingType === holding.investmentType);
          if (!asset) return;
          totals.set(asset.key, totals.get(asset.key) + (Number(holding.costBasis) || 0));
          count += 1;
        }));
        ASSETS.forEach((asset) => {
          const value = totals.get(asset.key);
          amountInputs.get(asset.key).value = value ? value.toFixed(2) : '';
        });
        updateCurrentShares();
        fillMessage.textContent = count
          ? `Filled from ${count} holding${count === 1 ? '' : 's'} across ${portfolios.length} portfolio${portfolios.length === 1 ? '' : 's'}, using what you paid (cost basis). You can edit the amounts.`
          : 'You have no holdings recorded yet. Enter your amounts manually.';
      } catch (error) {
        fillMessage.textContent = error.message || 'Could not load your holdings.';
      }
    });
  }

  async function createPlan(event) {
    event.preventDefault();
    planError.textContent = '';
    planError.className = 'dashboard-message';
    for (const asset of ASSETS) {
      const input = amountInputs.get(asset.key);
      if (input.value.trim() !== '' && (!Number.isFinite(Number(input.value)) || Number(input.value) < 0)) {
        showPlanError(`${asset.label}: enter an amount of ₹0 or more.`, input);
        return;
      }
    }
    const budget = Number(budgetInput.value);
    if (!budgetInput.value.trim() || !Number.isFinite(budget) || budget <= 0) {
      showPlanError('Enter the total budget you can invest now (more than ₹0).', budgetInput);
      return;
    }
    const current = Object.fromEntries(ASSETS.map((a) => [a.key, readAmount(amountInputs.get(a.key))]));
    const submit = form.querySelector('[type="submit"]');
    await withBusy(submit, 'Working out your plan…', async () => {
      try {
        const csrf = await getCsrf();
        const plan = await api('api/plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
          body: JSON.stringify({ riskProfile: riskSelect.value, current, budget })
        });
        renderResult(plan);
        await loadHistory();
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (error) {
        showPlanError(error.message || 'We could not create your plan. Please try again.');
      }
    });
  }

  function renderResult(plan) {
    resultSection.hidden = false;
    document.querySelector('#result-budget').textContent =
      `Budget ${formatCurrency(plan.budget)} · ${RISK_LABELS[plan.riskProfile] || plan.riskProfile}`;
    const rows = document.querySelector('#result-rows');
    rows.replaceChildren();
    ASSETS.forEach((asset) => {
      const amount = Number(plan.suggested[asset.key]) || 0;
      const row = document.createElement('div');
      row.className = 'plan-result-row';
      row.append(
        span(asset.label),
        span(formatCurrency(amount), `plan-invest${amount === 0 ? ' zero' : ''}`),
        span(pct(plan.currentPercent[asset.key])),
        span(pct(plan.targetPercent[asset.key])),
        span(pct(plan.resultingPercent[asset.key]))
      );
      rows.append(row);
    });
    const total = document.createElement('div');
    total.className = 'plan-result-row plan-result-total';
    total.append(span('Total'), span(formatCurrency(plan.budget), 'plan-invest'), span(''), span('100%'), span(''));
    rows.append(total);
    shownPlan = plan;
    renderProjection(plan);
    document.querySelector('#result-reasons').replaceChildren(...plan.reasons.map((reason) => {
      const li = document.createElement('li');
      li.textContent = reason;
      return li;
    }));
  }

  // Illustrative estimate only: compounds each class yearly at the server's assumed return
  function renderProjection(plan) {
    const years = Number(yearsSelect.value);
    const yearsText = `${years} year${years === 1 ? '' : 's'}`;
    document.querySelector('#projection-value-header').textContent = `ESTIMATED VALUE AFTER ${yearsText.toUpperCase()}`;
    const rows = document.querySelector('#projection-rows');
    rows.replaceChildren();
    let totalNow = 0;
    let totalLater = 0;
    let budgetLater = 0;
    ASSETS.forEach((asset) => {
      const rate = Number(plan.assumedReturnPercent?.[asset.key]) || 0;
      const growth = (1 + rate / 100) ** years;
      const suggested = Number(plan.suggested[asset.key]) || 0;
      const now = (Number(plan.current[asset.key]) || 0) + suggested;
      const later = now * growth;
      totalNow += now;
      totalLater += later;
      budgetLater += suggested * growth;
      const row = document.createElement('div');
      row.className = 'plan-result-row';
      row.append(
        span(asset.label),
        span(formatCurrency(now)),
        span(`${pct(rate)} (assumed)`),
        span(formatCurrency(later)),
        span(formatCurrency(later - now), 'plan-gain')
      );
      rows.append(row);
    });
    const total = document.createElement('div');
    total.className = 'plan-result-row plan-result-total';
    total.append(span('Total'), span(formatCurrency(totalNow)), span(''),
      span(formatCurrency(totalLater)), span(formatCurrency(totalLater - totalNow), 'plan-gain'));
    rows.append(total);
    const budget = Number(plan.budget) || 0;
    document.querySelector('#projection-budget-note').textContent =
      `If these assumed returns hold, the new budget of ${formatCurrency(budget)} alone could grow to about `
      + `${formatCurrency(budgetLater)} in ${yearsText}, an estimated gain of ${formatCurrency(budgetLater - budget)}. `
      + 'This is an estimate based on assumptions, not a promise of profit.';
  }

  async function loadHistory() {
    recentPlans = await api('api/plans');
    historyList.replaceChildren();
    historyEmpty.hidden = recentPlans.length !== 0;
    recentPlans.forEach((plan) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'plan-history-item';
      item.title = 'Show this plan';
      const heading = document.createElement('span');
      const amount = document.createElement('strong');
      amount.textContent = formatCurrency(plan.budget);
      const meta = document.createElement('span');
      meta.className = 'plan-history-meta';
      meta.textContent = ` · ${RISK_LABELS[plan.riskProfile] || plan.riskProfile}`;
      heading.append(amount, meta);
      const split = document.createElement('span');
      split.className = 'plan-history-split';
      split.textContent = ASSETS
        .filter((a) => Number(plan.suggested[a.key]) > 0)
        .map((a) => `${a.label} ${formatCurrency(plan.suggested[a.key])}`)
        .join(' · ');
      const date = document.createElement('span');
      date.className = 'plan-history-meta';
      date.textContent = formatDate(plan.createdAt);
      item.append(heading, split, date);
      item.addEventListener('click', () => {
        renderResult(plan);
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      historyList.append(item);
    });
  }

  function span(text, className = '') {
    const element = document.createElement('span');
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }

  function pct(value) {
    const number = Number(value);
    return Number.isFinite(number) ? `${Number(number.toFixed(1))}%` : '—';
  }

  function showPlanError(text, focusTarget) {
    planError.textContent = text;
    planError.className = 'dashboard-message';
    focusTarget?.focus();
  }

  function showPageMessage(text, kind = 'error') {
    pageMessage.textContent = text;
    pageMessage.className = `dashboard-message${text ? ` ${kind}` : ''}`;
  }
})();
