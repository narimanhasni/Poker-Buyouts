// ─── State ────────────────────────────────────────────────────────────────────

let playerCount = 0;
let currentLeaderboardType = 'totalWinnings';
const STORAGE_KEY = 'pokerSettlerData';
let conversionRate = 1; // chip value to real money (e.g., $200 chips = $10 real)
let appData = {
  sessions: [],
  playerStats: {}
};

// ─── Storage ──────────────────────────────────────────────────────────────────

function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      appData = JSON.parse(stored);
    }
  } catch (err) {
    console.error('Failed to load data from localStorage:', err);
    console.warn('Starting with fresh data');
    appData = {
      sessions: [],
      playerStats: {}
    };
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  } catch (err) {
    console.error('Failed to save data to localStorage:', err);
    if (err.name === 'QuotaExceededError') {
      alert('⚠️ Storage space is full. Please clear some data or history.');
    } else {
      alert('⚠️ Could not save your data. Please check your browser settings.');
    }
  }
}


function getPlayerStats(name) {
  if (!appData.playerStats[name]) {
    appData.playerStats[name] = {
      totalWinnings: 0,
      gamesPlayed: 0,
      wins: 0,
      losses: 0
    };
  }
  return appData.playerStats[name];
}

// ─── Conversion ───────────────────────────────────────────────────────────────

function updateConversionRate() {
  const chipValueInput = document.getElementById('chip-value').value.trim();
  const chipValue = chipValueInput === '' ? 200 : parseFloat(chipValueInput) || 200;
  
  const realValueInput = document.getElementById('real-value').value.trim();
  const realValue = realValueInput === '' ? 10 : parseFloat(realValueInput) || 10;
  
  conversionRate = realValue / chipValue;
  updateConversionDisplay();
}

function updateConversionDisplay() {
  const chipValueInput = document.getElementById('chip-value').value.trim();
  const chipValue = chipValueInput === '' ? 200 : parseFloat(chipValueInput) || 200;
  
  const realValueInput = document.getElementById('real-value').value.trim();
  const realValue = realValueInput === '' ? 10 : parseFloat(realValueInput) || 10;
  
  const rate = realValue / chipValue;
  document.getElementById('conversion-display').textContent = 
    `${chipValue.toFixed(0)} chips = $${realValue.toFixed(2)} real (×${rate.toFixed(4)})`;
}
function toRealMoney(chipAmount) {
  return chipAmount * conversionRate;
}

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

// ─── Tab Navigation ───────────────────────────────────────────────────────────

function switchTab(tabName) {
  haptic('light');
  
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Deactivate all buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Show selected tab
  document.getElementById(`${tabName}-tab`).classList.add('active');
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  
  // Load Hall of Fame data if switching to it
  if (tabName === 'halloffame') {
    renderHallOfFame();
  }
}

// ─── Hall of Fame ──────────────────────────────────────────────────────────────

function renderHallOfFame() {
  // Update stat cards
  updateStatCards();
  
  // Render leaderboard
  switchLeaderboard(currentLeaderboardType);
  
  // Render session history
  renderSessionHistory();
}

function updateStatCards() {
  const stats = appData.playerStats;
  
  if (Object.keys(stats).length === 0) {
    document.getElementById('stat-biggest-winner').textContent = '—';
    document.getElementById('stat-biggest-winner-amount').textContent = '$0';
    document.getElementById('stat-biggest-loser').textContent = '—';
    document.getElementById('stat-biggest-loser-amount').textContent = '$0';
    document.getElementById('stat-most-games').textContent = '—';
    document.getElementById('stat-most-games-count').textContent = '0';
    document.getElementById('stat-biggest-fish').textContent = '—';
    document.getElementById('stat-biggest-fish-avg').textContent = '$0 avg';
    return;
  }

  // Biggest Winner
  const sortedByWinnings = Object.entries(stats)
    .sort((a, b) => b[1].totalWinnings - a[1].totalWinnings);
  
  if (sortedByWinnings.length > 0) {
    const [winnerName, winnerStats] = sortedByWinnings[0];
    document.getElementById('stat-biggest-winner').textContent = winnerName;
    document.getElementById('stat-biggest-winner-amount').textContent = 
      `+$${winnerStats.totalWinnings.toFixed(2)}`;
  }

  // Biggest Loser
  const sortedByLosings = Object.entries(stats)
    .sort((a, b) => a[1].totalWinnings - b[1].totalWinnings);
  
  if (sortedByLosings.length > 0) {
    const [loserName, loserStats] = sortedByLosings[0];
    document.getElementById('stat-biggest-loser').textContent = loserName;
    document.getElementById('stat-biggest-loser-amount').textContent = 
      `$${loserStats.totalWinnings.toFixed(2)}`;
  }

  // Most Games
  const sortedByGames = Object.entries(stats)
    .sort((a, b) => b[1].gamesPlayed - a[1].gamesPlayed);
  
  if (sortedByGames.length > 0) {
    const [playerName, playerStats] = sortedByGames[0];
    document.getElementById('stat-most-games').textContent = playerName;
    document.getElementById('stat-most-games-count').textContent = playerStats.gamesPlayed;
  }

  // Biggest Fish (most losses/negative average)
  const sortedByFish = Object.entries(stats)
    .filter(([_, s]) => s.gamesPlayed > 0)
    .sort((a, b) => {
      const avgA = a[1].totalWinnings / a[1].gamesPlayed;
      const avgB = b[1].totalWinnings / b[1].gamesPlayed;
      return avgA - avgB;
    });
  
  if (sortedByFish.length > 0) {
    const [fishName, fishStats] = sortedByFish[0];
    const avgLoss = fishStats.totalWinnings / fishStats.gamesPlayed;
    document.getElementById('stat-biggest-fish').textContent = fishName;
    document.getElementById('stat-biggest-fish-avg').textContent = 
      `${avgLoss.toFixed(2)}/game`;
  }
}

function switchLeaderboard(type) {
  currentLeaderboardType = type;
  
  // Update button states
  document.querySelectorAll('.leaderboard-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Find the button with matching text and activate it
  const labelMap = {
    'totalWinnings': 'Total Winnings',
    'gamesPlayed': 'Games Played',
    'winRate': 'Win Rate'
  };
  
  document.querySelectorAll('.leaderboard-btn').forEach(btn => {
    if (btn.textContent.trim() === labelMap[type]) {
      btn.classList.add('active');
    }
  });
  
  renderLeaderboard(type);
}

function renderLeaderboard(type) {
  const stats = appData.playerStats;
  const container = document.getElementById('leaderboard-content');
  
  if (Object.keys(stats).length === 0) {
    container.innerHTML = '<p class="empty-message">No games played yet. Start a game!</p>';
    return;
  }

  let entries = Object.entries(stats);
  let sorted = [];

  switch(type) {
    case 'totalWinnings':
      sorted = entries.sort((a, b) => b[1].totalWinnings - a[1].totalWinnings);
      break;
    case 'gamesPlayed':
      sorted = entries.sort((a, b) => b[1].gamesPlayed - a[1].gamesPlayed);
      break;
    case 'winRate':
      sorted = entries
        .filter(([_, s]) => s.gamesPlayed > 0)
        .sort((a, b) => {
          const rateA = (a[1].wins / a[1].gamesPlayed) * 100;
          const rateB = (b[1].wins / b[1].gamesPlayed) * 100;
          return rateB - rateA;
        });
      break;
  }

  let html = '';
  sorted.forEach(([name, stats], index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1;
    
    let value = '';
    if (type === 'totalWinnings') {
      const sign = stats.totalWinnings >= 0 ? '+' : '';
      value = `${sign}$${stats.totalWinnings.toFixed(2)}`;
    } else if (type === 'gamesPlayed') {
      value = stats.gamesPlayed;
    } else if (type === 'winRate') {
      const rate = stats.gamesPlayed > 0 ? ((stats.wins / stats.gamesPlayed) * 100).toFixed(1) : 0;
      value = `${rate}%`;
    }

    const valueClass = stats.totalWinnings >= 0 ? 'positive' : 'negative';

    html += `
      <div class="leaderboard-row">
        <span class="medal">${medal}</span>
        <span class="player-name">${name}</span>
        <span class="leaderboard-value ${valueClass}">${value}</span>
      </div>`;
  });

  container.innerHTML = html;
}

function renderSessionHistory() {
  const container = document.getElementById('session-history');
  
  if (appData.sessions.length === 0) {
    container.innerHTML = '<p class="empty-message">No sessions recorded yet.</p>';
    return;
  }

  let html = '';
  const recentSessions = appData.sessions.slice(-10).reverse();
  
  recentSessions.forEach((session, index) => {
    const date = new Date(session.timestamp);
    const dateStr = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined 
    });

    html += `
      <div class="session-card">
        <div class="session-header">
          <span class="session-date">${dateStr}</span>
          <span class="session-players">${Object.keys(session.nets).length} players</span>
        </div>
        <div class="session-details">
          ${Object.entries(session.nets)
            .map(([name, net]) => {
              const sign = net > 0 ? '+' : '';
              const cls = net > 0.01 ? 'net-win' : net < -0.01 ? 'net-loss' : 'net-even';
              return `<div class="session-result"><span>${name}</span><span class="amount ${cls}">${sign}$${net.toFixed(2)}</span></div>`;
            })
            .join('')}
        </div>
      </div>`;
  });

  container.innerHTML = html;
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

// NEW: Call this instead of calculate() when user clicks "Settle Up"
function calculate() {
  haptic('medium');
  
  try {
    const nets = collectPlayerNets();
    const total = Object.values(nets).reduce((a, b) => a + b, 0);

    if (Math.abs(total) > 0.01) {
      renderError(`⚠️ Numbers don't balance — off by $${total.toFixed(2)}`);
      return;
    }

    const transactions = settle(nets);
    
    // Show preview before saving
    showSettlementPreview(transactions, nets);
  } catch (err) {
    // collectPlayerNets() will show alert if there's an error
    return;
  }
}

// NEW: Show preview modal
function showSettlementPreview(transactions, nets) {
  let summaryHtml = '';
  for (const [name, net] of Object.entries(nets)) {
    const sign = net > 0 ? '+' : '';
    const cls = net > 0.01 ? 'color: #4caf84' : net < -0.01 ? 'color: var(--red-bright)' : 'color: var(--cream-dim)';
    summaryHtml += `
      <div class="net-row">
        <span class="net-name">${name}</span>
        <span class="net-amount" style="${cls}">${sign}$${net.toFixed(2)}</span>
      </div>`;
  }

  let transHtml = '';
  if (transactions.length === 0) {
    transHtml = '<p class="even-message">Everyone is even — well played. 🎉</p>';
  } else {
    transactions.forEach(({ from, to, amount }) => {
      transHtml += `
        <div class="transaction" style="animation-delay: 0ms; opacity: 1;">
          <strong>${from}</strong>
          <span class="arrow">→</span>
          <strong>${to}</strong>
          <span class="amount">$${amount.toFixed(2)}</span>
        </div>`;
    });
  }

  const el = document.getElementById('results');
  el.innerHTML = `
    <div class="result">
      <h3>📋 Confirm Settlement</h3>
      <div style="background: rgba(0,0,0,0.3); padding: var(--space-md); border-radius: 6px; margin-bottom: var(--space-md);">
        <h4 style="color: var(--gold-light); margin-top: 0; margin-bottom: var(--space-sm);">Player Totals</h4>
        <div class="net-summary">${summaryHtml}</div>
        
        <h4 style="color: var(--gold-light); margin-top: var(--space-md); margin-bottom: var(--space-sm);">Payments</h4>
        ${transHtml}
      </div>
      
      <p style="color: var(--cream-dim); font-size: var(--text-xs); margin-bottom: var(--space-md); text-align: center;">
        ⚠️ Please review above before confirming. This will be saved to Hall of Fame.
      </p>
      
      <div style="display: flex; gap: var(--space-sm);">
        <button 
          style="flex: 1; background: linear-gradient(135deg, #8b1520, var(--red)); color: var(--cream); border: 1px solid rgba(224, 36, 58, 0.4); margin: 0;"
          onclick="proceedWithSettlement('${JSON.stringify(nets).replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${JSON.stringify(transactions).replace(/'/g, "\\'").replace(/"/g, '&quot;')}')">
          ✓ Confirm & Save
        </button>
        <button 
          style="flex: 1; background: transparent; border: 1px solid var(--gold-dim); color: var(--cream); margin: 0;"
          onclick="cancelSettlement()">
          ✕ Cancel & Edit
        </button>
      </div>
    </div>`;

  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// NEW: Actually save after confirmation
function proceedWithSettlement(netsJson, transactionsJson) {
  haptic('heavy');
  
  const nets = JSON.parse(netsJson);
  const transactions = JSON.parse(transactionsJson);
  
  // Save session data
  const session = {
    timestamp: new Date().toISOString(),
    nets: nets,
    transactions: transactions
  };
  appData.sessions.push(session);

  // Update player stats
  Object.entries(nets).forEach(([name, net]) => {
    const playerStat = getPlayerStats(name);
    playerStat.totalWinnings += net;
    playerStat.gamesPlayed += 1;
    if (net > 0.01) playerStat.wins += 1;
    if (net < -0.01) playerStat.losses += 1;
  });

  saveData();
  renderResults(transactions, nets);
}

// NEW: Cancel and go back to editing
function cancelSettlement() {
  haptic('light');
  document.getElementById('results').innerHTML = '';
}

function collectPlayerNets() {
  const nets = {};
  const seenNames = new Set();
  
  document.querySelectorAll('.player').forEach(p => {
    const id = p.id.split('-')[1];
    let name = document.getElementById(`name-${id}`).value.trim();
    
    // Require names
    if (!name) {
      alert('⚠️ All players must have a name before settling.');
      throw new Error('Missing player name');
    }
    
    // Check for duplicates
    if (seenNames.has(name)) {
      alert(`⚠️ Duplicate name: "${name}". Each player needs a unique name.`);
      throw new Error('Duplicate player name');
    }
    seenNames.add(name);
    
    const buyIn = parseFloat(document.getElementById(`buyin-${id}`).value) || 0;
    const final = parseFloat(document.getElementById(`final-${id}`).value) || 0;

    const chipNet = final - buyIn;
    nets[name] = toRealMoney(chipNet);
  });
  return nets;
}

// ─── Settlement Algorithm ─────────────────────────────────────────────────────

// NEW: Add this utility function at the top of script.js (around line 10)
function roundToNearest(amount) {
  return Math.round(amount * 100) / 100;
}

function settle(nets) {
  const losers  = [];
  const winners = [];

  for (const [name, amount] of Object.entries(nets)) {
    const rounded = roundToNearest(amount);  // ✅ Round first
    if (rounded < -0.01) losers.push({ name, amount: Math.abs(rounded) });
    if (rounded > 0.01)  winners.push({ name, amount: rounded });
  }

  losers.sort((a, b) => b.amount - a.amount);
  winners.sort((a, b) => b.amount - a.amount);

  const transactions = [];
  while (losers.length > 0 && winners.length > 0) {
    const loser   = losers[0];
    const winner  = winners[0];
    const payment = roundToNearest(Math.min(loser.amount, winner.amount));  // ✅ Round here too

    transactions.push({ from: loser.name, to: winner.name, amount: payment });

    loser.amount  = roundToNearest(loser.amount - payment);  // ✅ Round the result
    winner.amount = roundToNearest(winner.amount - payment);  // ✅ Round the result

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
      <button class="new-game-btn" onclick="resetForNewGame()">🔄 New Game</button>
    </div>`;

  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  el.querySelectorAll('.transaction').forEach(t => t.classList.add('tx-animate'));
}

function resetForNewGame() {
  haptic('light');
  document.getElementById('players').innerHTML = '';
  document.getElementById('results').innerHTML = '';
  playerCount = 0;
  addPlayer();
  addPlayer();
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

  const btn = document.querySelector('.share-btn');
  
  if (navigator.share) {
    navigator.share({ title: 'Poker Results', text })
      .then(() => {
        btn.textContent = '✓ Shared!';
        setTimeout(() => btn.textContent = '↑ Share Results', 2000);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
          // Fallback to clipboard
          fallbackCopyToClipboard(text, btn);
        }
      });
  } else if (navigator.clipboard) {
    fallbackCopyToClipboard(text, btn);
  } else {
    alert('Share not available on this browser');
  }
}

// NEW: Helper function for fallback copy
function fallbackCopyToClipboard(text, btn) {
  navigator.clipboard.writeText(text)
    .then(() => {
      btn.textContent = '✓ Copied!';
      setTimeout(() => btn.textContent = '↑ Share Results', 2000);
    })
    .catch((err) => {
      console.error('Copy failed:', err);
      btn.textContent = '✕ Copy failed';
      setTimeout(() => btn.textContent = '↑ Share Results', 2000);
    });
}

// ─── History Management ───────────────────────────────────────────────────────

function confirmResetHistory() {
  if (confirm('⚠️ Are you sure? This will permanently delete all game history and leaderboard data.')) {
    appData = {
      sessions: [],
      playerStats: {}
    };
    saveData();
    haptic('heavy');
    renderHallOfFame();
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

loadData();
updateConversionRate(); // Initialize conversion display
addPlayer();
addPlayer();