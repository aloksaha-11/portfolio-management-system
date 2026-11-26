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
        showMessage('Your portfolio is ready. Click its box below to add investments.', 'success');
      } catch (error) {
        showMessage(error.message || 'We could not create that portfolio. Please try again.');
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
      // Each card opens that portfolio's details page
      const card = document.createElement('a');
      card.href = portfolioDetailsUrl(portfolio.portfolioId);
      card.className = `portfolio-card${portfolio.portfolioId === selectedPortfolioId ? ' selected' : ''}`;
      card.title = `Open ${portfolio.name} details`;
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
      portfolioList.append(card);
    });
    portfolioList.append(createPlanCard());
  }

  // "Create your own plan" box shown after the portfolio boxes
  function createPlanCard() {
    const card = document.createElement('a');
    card.href = 'plan.html';
    card.className = 'portfolio-card plan-card';
    card.title = 'Plan how to split your next investment';
    const top = document.createElement('span');
    top.className = 'portfolio-card-top';
    const icon = document.createElement('span');
    icon.className = 'portfolio-card-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '＋';
    const tag = document.createElement('span');
    tag.className = 'portfolio-card-currency';
    tag.textContent = 'PLAN';
    top.append(icon, tag);
    const name = document.createElement('strong');
    name.textContent = 'Create your own plan';
    card.append(top, name);
    return card;
  }

  // Selecting a portfolio (via the dropdown) highlights its card; advisory buttons use it
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
          renderWeekTrend(dates);
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

    // Badge: follows the BSE Sensex. The Bhav Copy has no index values, so use the
    // day's change of a Sensex-tracking ETF. If none is present, fall back to breadth.
    const badge = document.querySelector('#bse-trend-badge');
    const badgeText = document.querySelector('#bse-trend-text');
    const badgeIcon = document.querySelector('#bse-trend-icon');
    if (badge && badgeText && badgeIcon) {
      const sensex = findSensexTracker(prices);
      let isUp;
      if (sensex) {
        isUp = sensex.pct >= 0;
        const sign = sensex.pct > 0 ? '+' : '';
        badgeText.textContent = `BSE Sensex is ${isUp ? 'UP' : 'DOWN'} (${sign}${sensex.pct.toFixed(2)}%)`;
        badge.title = `Based on ${sensex.symbol} (${sensex.name}), a Sensex-tracking ETF: `
          + `₹${formatNumber(sensex.prev)} → ₹${formatNumber(sensex.close)}. `
          + `The official Sensex change can differ slightly.`;
      } else {
        isUp = advances >= declines;
        const sign = Number(avgChange) > 0 ? '+' : '';
        badgeText.textContent = `Market breadth is ${isUp ? 'UP' : 'DOWN'} (${sign}${avgChange}% Avg)`;
        badge.title = 'No Sensex ETF price found for this date; showing all-securities breadth instead.';
      }
      badge.className = isUp ? 'bse-trend-badge up' : 'bse-trend-badge down';
      badgeIcon.textContent = isUp ? '▲' : '▼';
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

  // Number of trading days shown in the trend chart
  const WEEK_TREND_DAYS = 9;

  // Colours of the daily-change line and of its up and down day markers
  const TREND_LINE_COLOR = '#3a6fc4';
  const TREND_UP_COLOR = '#2d7a4d';
  const TREND_DOWN_COLOR = '#c24141';

  // Loads the most recent trade dates and draws the Sensex ETF prices for each day.
  // dates is newest first, as the API returns it. Failures only hide the chart.
  async function renderWeekTrend(dates) {
    const container = document.querySelector('#bse-week-trend');
    if (!container) return;
    const days = dates.slice(0, WEEK_TREND_DAYS).map((date) => toIsoDateString(date)).reverse();
    try {
      const pricesByDay = await Promise.all(days.map((day) =>
        api(`api/market-data/bse/by-date?tradeDate=${encodeURIComponent(day)}`)));
      drawWeekTrend(days.map((day, index) => ({ day, row: findSensexRow(pricesByDay[index]) })));
      container.hidden = false;
    } catch (error) {
      console.error('The 9-day BSE trend could not be drawn:', error);
      container.hidden = true;
    }
  }

  function svgElement(tag, attributes = {}, text = null) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
    if (text !== null) element.textContent = text;
    return element;
  }

  // Percentage change of a day's close against the previous close
  function dailyChange(row) {
    return ((Number(row.closePrice) - Number(row.previousClose)) / Number(row.previousClose)) * 100;
  }

  function signed(value) {
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  }

  function dayCount(count) {
    return `${count} day${count === 1 ? '' : 's'}`;
  }

  function statCard(label, value, detail, tone = '') {
    const card = document.createElement('div');
    card.className = 'bse-stat-card';
    const labelElement = document.createElement('span');
    labelElement.className = 'bse-stat-label';
    labelElement.textContent = label;
    const valueElement = document.createElement('span');
    valueElement.className = `bse-stat-value ${tone}`.trim();
    valueElement.textContent = value;
    card.append(labelElement, valueElement);
    if (detail) {
      const detailElement = document.createElement('span');
      detailElement.className = 'bse-stat-detail';
      detailElement.textContent = detail;
      card.append(detailElement);
    }
    return card;
  }

  // Fills the summary panel beside the chart from the same daily % changes the chart shows
  function renderTrendStats(valid) {
    const stats = document.querySelector('#bse-week-trend-stats');
    if (!stats) return;
    stats.replaceChildren();
    const days = valid.map((point) => ({ day: point.day, change: dailyChange(point.row) }));
    const first = days[0];
    const latest = days[days.length - 1];
    const ups = days.filter((d) => d.change >= 0);
    const downs = days.filter((d) => d.change < 0);
    const average = (list) => list.reduce((total, d) => total + d.change, 0) / list.length;
    // Daily changes compound, so the period change multiplies them rather than adding them
    const overall = (days.reduce((growth, d) => growth * (1 + d.change / 100), 1) - 1) * 100;
    const biggestRise = days.reduce((best, d) => (d.change > best.change ? d : best), first);
    const biggestFall = days.reduce((best, d) => (d.change < best.change ? d : best), first);
    const tone = (value) => (value >= 0 ? 'up' : 'down');
    const range = `${formatTradeDate(first.day)} – ${formatTradeDate(latest.day)}`;

    stats.append(
      statCard('Change on latest day', signed(latest.change), formatTradeDate(latest.day), tone(latest.change)),
      statCard(`Change over ${days.length} days`, signed(overall), range, tone(overall)),
      statCard('Average daily change', signed(average(days)), `over ${days.length} days`, tone(average(days))),
      statCard('Up / down days', `${ups.length} / ${downs.length}`),
      statCard('Biggest rise', signed(biggestRise.change), formatTradeDate(biggestRise.day), tone(biggestRise.change)),
      statCard('Biggest fall', signed(biggestFall.change), formatTradeDate(biggestFall.day), tone(biggestFall.change)),
      statCard('Average up day', ups.length ? signed(average(ups)) : '—', dayCount(ups.length), ups.length ? 'up' : ''),
      statCard('Average down day', downs.length ? signed(average(downs)) : '—', dayCount(downs.length), downs.length ? 'down' : '')
    );
  }
  function positiveNumber(row, field) {
    const value = Number(row?.[field]);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  // Picks round tick values covering the values, with half a step of space above and below
  // so labels never touch the axes. includeZero starts the axis at 0 (used for percentages).
  function niceTicks(values, includeZero) {
    const extra = includeZero ? [0] : [];
    const low = Math.min(...extra, ...values);
    const high = Math.max(...extra, ...values);
    const rawStep = Math.max(high - low, 0.5) / 4;
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const fraction = rawStep / magnitude;
    const multiple = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
    const step = Number((multiple * magnitude).toPrecision(6));
    let start = Math.floor(low / step) * step;
    let end = Math.ceil(high / step) * step;
    while (start > low - step / 2) start -= step;
    while (end < high + step / 2) end += step;
    const count = Math.round((end - start) / step);
    const ticks = Array.from({ length: count + 1 }, (_, index) => Number((start + index * step).toPrecision(6)));
    return { ticks, step };
  }

  // points: oldest first, each { day: 'YYYY-MM-DD', row: the ETF's BSE row or null }
  function drawWeekTrend(points) {
    const chart = document.querySelector('#bse-week-trend-chart');
    const summary = document.querySelector('#bse-week-trend-summary');
    if (!chart) return;
    chart.replaceChildren();
    const valid = points.filter((point) => point.row);
    if (valid.length === 0) {
      chart.textContent = 'No Sensex ETF prices found for these days.';
      if (summary) summary.textContent = '';
      return;
    }

    const { ticks } = niceTicks(valid.map((point) => dailyChange(point.row)), true);
    const low = ticks[0];
    const high = ticks[ticks.length - 1];

    const sign = (value) => (value > 0 ? '+' : '');
    const latest = points[points.length - 1];
    const upDays = valid.filter((point) => dailyChange(point.row) >= 0).length;
    const summaryText = `Sensex rose on ${upDays} of ${valid.length} days`
      + (latest.row ? `. Latest (${formatTradeDate(latest.day)}): ${sign(dailyChange(latest.row))}${dailyChange(latest.row).toFixed(2)}%` : '');
    if (summary) summary.textContent = summaryText;

    const width = 760;
    const height = 318;
    const left = 72;
    const right = 40;
    const top = 44;
    const bottom = 100;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const baseline = height - bottom;
    const x = (index) => left + (points.length === 1 ? plotWidth / 2 : index * plotWidth / (points.length - 1));
    const y = (value) => top + (high - value) * plotHeight / (high - low);

    const svg = svgElement('svg', {
      viewBox: `0 0 ${width} ${height}`,
      class: 'bse-week-trend-svg',
      role: 'img',
      'aria-label': `${summaryText}. Percentage change of the Sensex against the previous day, for each day.`
    });

    svg.append(svgElement('text', {
      x: left + plotWidth / 2, y: 30, 'text-anchor': 'middle', class: 'chart-title'
    }, `BSE SENSEX DAILY CHANGE · LAST ${WEEK_TREND_DAYS} TRADING DAYS`));

    // Solid horizontal grid lines with percentage labels; the 0% line is drawn darker
    ticks.forEach((value) => {
      svg.append(svgElement('line', {
        x1: left, x2: left + plotWidth, y1: y(value), y2: y(value), class: value === 0 ? 'zero-line' : 'grid'
      }));
      svg.append(svgElement('text', {
        x: left - 10, y: y(value) + 4, 'text-anchor': 'end', class: 'axis'
      }, `${sign(value)}${formatNumber(value)}%`));
    });

    // The y-axis and x-axis lines
    svg.append(svgElement('line', { x1: left, x2: left, y1: top, y2: baseline, class: 'axis-line' }));
    svg.append(svgElement('line', { x1: left, x2: left + plotWidth, y1: baseline, y2: baseline, class: 'axis-line' }));

    // X-axis title, centred under the dates
    svg.append(svgElement('text', {
      x: left + plotWidth / 2, y: height - 8, 'text-anchor': 'middle', class: 'axis-title'
    }, 'Trading date'));
    // Y-axis title, written upwards beside the price labels
    const axisTitleY = top + plotHeight / 2;
    svg.append(svgElement('text', {
      x: 16, y: axisTitleY, 'text-anchor': 'middle', class: 'axis-title',
      transform: `rotate(-90 16 ${axisTitleY})`
    }, 'Percentage (%)'));
    // Dates under the x-axis, rotated like the reference chart
    points.forEach((point, index) => {
      const xPos = x(index);
      svg.append(svgElement('line', { x1: xPos, x2: xPos, y1: baseline, y2: baseline + 5, class: 'tick' }));
      svg.append(svgElement('text', {
        x: xPos, y: baseline + 14, 'text-anchor': 'end', class: 'axis',
        transform: `rotate(-45 ${xPos} ${baseline + 14})`
      }, formatTradeDate(point.day)));
    });

    // One line through each day's change, with a green dot for up days and a red dot for down days
    const coordinates = points
      .map((point, index) => {
        if (!point.row) return null;
        const value = dailyChange(point.row);
        return { x: x(index), y: y(value), value, day: point.day };
      })
      .filter(Boolean);
    if (coordinates.length > 1) {
      svg.append(svgElement('polyline', {
        points: coordinates.map((c) => `${c.x},${c.y}`).join(' '),
        class: 'series',
        stroke: TREND_LINE_COLOR
      }));
    }
    coordinates.forEach((c) => {
      const color = c.value >= 0 ? TREND_UP_COLOR : TREND_DOWN_COLOR;
      const dot = svgElement('circle', { cx: c.x, cy: c.y, r: 3.6, fill: color });
      dot.append(svgElement('title', {}, `${formatTradeDate(c.day)} · ${signed(c.value)} vs previous day`));
      svg.append(dot);
      svg.append(svgElement('text', {
        x: c.x, y: c.value >= 0 ? c.y - 9 : c.y + 16, 'text-anchor': 'middle', class: 'point-label', fill: color
      }, signed(c.value)));
    });

    chart.append(svg);
    renderTrendStats(valid);
  }
  // Sensex-tracking ETFs in the BSE Bhav Copy, most liquid first
  const SENSEX_TRACKERS = ['SENSEXBEES', 'SBISENSEX', 'HDFCSENSEX', 'SENSEXBETA'];

  // The Sensex-tracking ETF row for a day (its open, high, low and close), or null
  function findSensexRow(prices) {
    for (const symbol of SENSEX_TRACKERS) {
      const row = prices.find((p) => p.symbol?.trim().toUpperCase() === symbol);
      if (row && positiveNumber(row, 'closePrice') !== null && positiveNumber(row, 'previousClose') !== null) {
        return row;
      }
    }
    return null;
  }

  function findSensexTracker(prices) {
    const row = findSensexRow(prices);
    if (!row) return null;
    const close = Number(row.closePrice);
    const prev = Number(row.previousClose);
    const symbol = row.symbol.trim().toUpperCase();
    return {
      symbol, name: row.companyName || symbol, close, prev,
      pct: ((close - prev) / prev) * 100
    };
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
