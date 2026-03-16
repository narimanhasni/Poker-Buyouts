// ─── State ────────────────────────────────────────────────────────────────────

let playerCount = 0;

// ─── Haptic ───────────────────────────────────────────────────────────────────

function haptic(style = 'light') {
  if (window.navigator && window.navigator.vibrate) {
    const patterns = { light: [10], medium: [20], heavy: [30, 10, 30] };
    navigator.vibrate(patterns[style] || [10]);
  }
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.01);
  } catch (_) {}
}

// ─── Player Management ────────────────────────────────────────────────────────

function addPlayer() {
  haptic('light');
  playerCount++;

  const div = document.createElement('div');
  div.className = 'player';
  div.id = `player-${playerCount}`;

  div.innerHTML = `
    <div class="card-header">
      <div class="player-number">Player ${playerCount}</div>
      <button class="remove-btn" onclick="removePlayer(${playerCount})">✕ Remove</button>
    </div>
    <label>Name</label>
    <input type="text" placeholder="e.g. James" id="name-${playerCount}" autocomplete="off">
    <label>Total Buy-ins ($)</label>
    <input type="number" placeholder="e.g. 100" id="buyin-${playerCount}" inputmode="decimal">
    <label>Final Chips ($)</label>
    <input type="number" placeholder="e.g. 85" id="final-${playerCount}" inputmode="decimal">
  `;

  document.getElementById('players').appendChild(div);

  // Deal-in animation
  requestAnimationFrame(() => {
    div.classList.add('player-enter');
    setTimeout(() => div.classList.remove('player-enter'), 500);
  });

  setupSwipeToRemove(div);
}

function removePlayer(id) {
  haptic('medium');
  const card = document.getElementById(`player-${id}`);
  if (!card) return;
  card.classList.add('player-exit');
  setTimeout(() => card.remove(), 350);
}

// ─── Swipe to Remove ─────────────────────────────────────────────────────────

function setupSwipeToRemove(card) {
  let startX = 0;
  let currentX = 0;
  let isDragging = false;

  card.addEventListener('touchstart', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
    startX = e.touches[0].clientX;
    isDragging = true;
    card.style.transition = 'none';
  }, { passive: true });

  card.addEventListener('touchmove', e => {
    if (!isDragging) return;
    currentX = e.touches[0].clientX - startX;
    if (currentX < 0) {
      card.style.transform = `translateX(${currentX}px)`;
      card.style.opacity = Math.max(0.3, 1 + currentX / 200);
    }
  }, { passive: true });

  card.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    card.style.transition = '';

    if (currentX < -100) {
      haptic('heavy');
      card.style.transform = 'translateX(-110%)';
      card.style.opacity = '0';
      setTimeout(() => card.remove(), 300);
    } else {
      card.style.transform = '';
      card.style.opacity = '';
    }
    currentX = 0;
  });
}

// ─── Calculate ────────────────────────────────────────────────────────────────

function calculate() {
  haptic('medium');
  const nets = collectPlayerNets();
  const total = Object.values(nets).reduce((a, b) => a + b, 0);

  if (Math.abs(total) > 0.01) {
    renderError(`⚠️ Numbers don't balance — off by $${total.toFixed(2)}`);
    return;
  }

  const transactions = settle(nets);
  renderResults(transactions, nets);
}

function collectPlayerNets() {
  const nets = {};
  document.querySelectorAll('.player').forEach(p => {
    const id = p.id.split('-')[1];
    const name = document.getElementById(`name-${id}`).value.trim() || `Player ${id}`;
    const buyIn = parseFloat(document.getElementById(`buyin-${id}`).value) || 0;
    const final = parseFloat(document.getElementById(`final-${id}`).value) || 0;
    nets[name] = final - buyIn;
  });
  return nets;
}

// ─── Settlement Algorithm ─────────────────────────────────────────────────────

function settle(nets) {
  const losers  = [];
  const winners = [];

  for (const [name, amount] of Object.entries(nets)) {
    if (amount < -0.01) losers.push({ name, amount: Math.abs(amount) });
    if (amount > 0.01)  winners.push({ name, amount });
  }

  losers.sort((a, b) => b.amount - a.amount);
  winners.sort((a, b) => b.amount - a.amount);

  const transactions = [];
  while (losers.length > 0 && winners.length > 0) {
    const loser   = losers[0];
    const winner  = winners[0];
    const payment = Math.min(loser.amount, winner.amount);

    transactions.push({ from: loser.name, to: winner.name, amount: payment });

    loser.amount  -= payment;
    winner.amount -= payment;

    if (loser.amount  < 0.01) losers.shift();
    if (winner.amount < 0.01) winners.shift();
  }

  return transactions;
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function renderError(message) {
  const el = document.getElementById('results');
  el.innerHTML = `<div class="result error"><p>${message}</p></div>`;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderResults(transactions, nets) {
  const el = document.getElementById('results');

  let summaryHtml = '';
  for (const [name, net] of Object.entries(nets)) {
    const sign = net > 0 ? '+' : '';
    const cls  = net > 0.01 ? 'net-win' : net < -0.01 ? 'net-loss' : 'net-even';
    summaryHtml += `
      <div class="net-row">
        <span class="net-name">${name}</span>
        <span class="net-amount ${cls}">${sign}$${net.toFixed(2)}</span>
      </div>`;
  }

  let transHtml = '';
  if (transactions.length === 0) {
    transHtml = '<p class="even-message">Everyone is even — well played. 🎉</p>';
  } else {
    transactions.forEach(({ from, to, amount }, i) => {
      transHtml += `
        <div class="transaction" style="animation-delay:${i * 80}ms">
          <strong>${from}</strong>
          <span class="arrow">→</span>
          <strong>${to}</strong>
          <span class="amount">$${amount.toFixed(2)}</span>
        </div>`;
    });
  }

  el.innerHTML = `
    <div class="result">
      <h3>📊 Summary</h3>
      <div class="net-summary">${summaryHtml}</div>
      <div class="divider">Payments</div>
      ${transHtml}
      <button class="share-btn" onclick="shareResults()">↑ Share Results</button>
    </div>`;

  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  el.querySelectorAll('.transaction').forEach(t => t.classList.add('tx-animate'));
}

// ─── Share ────────────────────────────────────────────────────────────────────

function shareResults() {
  haptic('light');
  const transactions = document.querySelectorAll('.transaction');
  const nets         = document.querySelectorAll('.net-row');

  let text = "🃏 Poker Settler — Tonight's Results\n\n";

  text += '📊 Summary\n';
  nets.forEach(row => {
    const name = row.querySelector('.net-name').textContent;
    const amt  = row.querySelector('.net-amount').textContent;
    text += `  ${name}: ${amt}\n`;
  });

  text += '\n💰 Payments\n';
  if (transactions.length === 0) {
    text += '  Everyone is even!\n';
  } else {
    transactions.forEach(t => {
      const from   = t.querySelector('strong:first-of-type').textContent;
      const to     = t.querySelector('strong:last-of-type').textContent;
      const amount = t.querySelector('.amount').textContent;
      text += `  ${from} → ${to}: ${amount}\n`;
    });
  }

  if (navigator.share) {
    navigator.share({ title: 'Poker Results', text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.querySelector('.share-btn');
      btn.textContent = '✓ Copied!';
      setTimeout(() => btn.textContent = '↑ Share Results', 2000);
    });
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

addPlayer();
addPlayer();