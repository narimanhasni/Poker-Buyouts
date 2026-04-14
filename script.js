// ─────────────────────────────────────────────────────────────────────────────
// script.js — Poker Settler (Supabase-backed)
// ─────────────────────────────────────────────────────────────────────────────

// ── Supabase Client ────────────────────────────────────────────────────────
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// ── State ──────────────────────────────────────────────────────────────────
let playerCount       = 0;
let conversionRate    = 0.05;
let currentLBType     = 'totalWinnings';
let cachedStats       = [];   // player_stats view rows
let cachedSessions    = [];   // sessions + results

// ── Sync Status ────────────────────────────────────────────────────────────
function setSyncStatus(state, msg) {
  const el = document.getElementById('sync-status');
  el.textContent = msg;
  el.className = 'sync-bar' + (state === 'syncing' ? ' syncing' : state === 'error' ? ' error' : '');
}

// ── Conversion Rate ────────────────────────────────────────────────────────
function updateConversionRate() {
  const chips = parseFloat(document.getElementById('chip-value').value) || 200;
  const real  = parseFloat(document.getElementById('real-value').value) || 10;
  conversionRate = real / chips;
  document.getElementById('conversion-display').textContent =
    `${chips.toFixed(0)} chips = $${real.toFixed(2)} real (×${conversionRate.toFixed(4)})`;
}

function toRealMoney(chipAmount) {
  return chipAmount * conversionRate;
}

// ── Tab Navigation ─────────────────────────────────────────────────────────
function switchTab(tabName) {
  haptic('light');
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`${tabName}-tab`).classList.add('active');
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  if (tabName === 'halloffame') loadAndRenderHallOfFame();
}

// ── Load Hall of Fame from Supabase ────────────────────────────────────────
async function loadAndRenderHallOfFame() {
  setSyncStatus('syncing', '⟳  loading shared data…');

  try {
    // Fetch player_stats view
    const { data: stats, error: statsErr } = await supabaseClient
      .from('player_stats')
      .select('*')
      .order('total_winnings', { ascending: false });
    if (statsErr) throw statsErr;
    cachedStats = stats || [];

    // Fetch sessions with their results (last 15)
    const { data: sessions, error: sessErr } = await supabaseClient
      .from('sessions')
      .select(`
        id,
        played_at,
        session_results ( player_name, net_real ),
        transactions    ( from_player, to_player, amount )
      `)
      .order('played_at', { ascending: false })
      .limit(15);
    if (sessErr) throw sessErr;
    cachedSessions = sessions || [];

    setSyncStatus('ok', '●  connected — shared leaderboard');
    renderHallOfFame();
  } catch (err) {
    console.error('Supabase load error:', err);
    setSyncStatus('error', '✕  failed to load — check config.js credentials');
  }
}

// ── Render Hall of Fame ────────────────────────────────────────────────────
function renderHallOfFame() {
  renderStatCards();
  renderLeaderboard(currentLBType);
  renderSQLTable();
  renderSessionHistory();
}

function renderStatCards() {
  if (!cachedStats.length) {
    ['stat-biggest-winner','stat-biggest-loser','stat-most-games','stat-biggest-fish']
      .forEach(id => document.getElementById(id).textContent = '—');
    document.getElementById('stat-biggest-winner-amount').textContent = '$0';
    document.getElementById('stat-biggest-loser-amount').textContent  = '$0';
    document.getElementById('stat-most-games-count').textContent      = '0 games';
    document.getElementById('stat-biggest-fish-avg').textContent      = '$0 avg';
    return;
  }

  // Stats are ordered by total_winnings DESC from the view
  const winner = cachedStats[0];
  document.getElementById('stat-biggest-winner').textContent        = winner.player_name;
  document.getElementById('stat-biggest-winner-amount').textContent = `+$${parseFloat(winner.total_winnings).toFixed(2)}`;

  const loser = cachedStats[cachedStats.length - 1];
  document.getElementById('stat-biggest-loser').textContent        = loser.player_name;
  document.getElementById('stat-biggest-loser-amount').textContent = `$${parseFloat(loser.total_winnings).toFixed(2)}`;

  const mostGames = [...cachedStats].sort((a, b) => b.games_played - a.games_played)[0];
  document.getElementById('stat-most-games').textContent       = mostGames.player_name;
  document.getElementById('stat-most-games-count').textContent = `${mostGames.games_played} games`;

  const fish = [...cachedStats]
    .filter(s => s.games_played > 0)
    .sort((a, b) => parseFloat(a.avg_per_game) - parseFloat(b.avg_per_game))[0];
  if (fish) {
    document.getElementById('stat-biggest-fish').textContent    = fish.player_name;
    document.getElementById('stat-biggest-fish-avg').textContent = `$${parseFloat(fish.avg_per_game).toFixed(2)}/game`;
  }
}

// ── SQL Stats Table ────────────────────────────────────────────────────────
function renderSQLTable() {
  const container = document.getElementById('sql-table-container');
  if (!cachedStats.length) {
    container.innerHTML = '<p class="empty-message">No data yet — play a game first.</p>';
    return;
  }

  const columns = [
    { key: 'player_name',    label: 'Player',       fmt: v => v },
    { key: 'games_played',   label: 'Games',        fmt: v => v },
    { key: 'wins',           label: 'Wins',         fmt: v => v },
    { key: 'losses',         label: 'Losses',       fmt: v => v },
    { key: 'win_rate_pct',   label: 'Win %',        fmt: v => v != null ? `${parseFloat(v).toFixed(1)}%` : '—' },
    { key: 'total_winnings', label: 'Total $',      fmt: v => { const n = parseFloat(v); return (n >= 0 ? '+' : '') + '$' + n.toFixed(2); } },
    { key: 'avg_per_game',   label: 'Avg/Game',     fmt: v => { const n = parseFloat(v); return (n >= 0 ? '+' : '') + '$' + n.toFixed(2); } },
  ];

  const headerRow = columns.map(c => `<th>${c.label}</th>`).join('');
  const bodyRows = cachedStats.map((row, i) => {
    const medal = i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : '';
    const cells = columns.map(c => {
      const val = row[c.key];
      const formatted = c.fmt(val);
      let cls = '';
      if (c.key === 'total_winnings' || c.key === 'avg_per_game') {
        cls = parseFloat(val) >= 0 ? 'positive' : 'negative';
      }
      if (c.key === 'player_name') {
        return `<td><span class="medal-inline">${medal}</span>${formatted}</td>`;
      }
      return `<td class="${cls}">${formatted}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  container.innerHTML = `
    <table class="sql-table">
      <thead><tr>${headerRow}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>`;
}

// ── Leaderboard ────────────────────────────────────────────────────────────
function switchLeaderboard(type) {
  currentLBType = type;
  document.querySelectorAll('.leaderboard-btn').forEach((btn, i) => {
    btn.classList.toggle('active', ['totalWinnings','gamesPlayed','winRate'][i] === type);
  });
  renderLeaderboard(type);
}

function renderLeaderboard(type) {
  const el = document.getElementById('leaderboard-content');
  if (!cachedStats.length) {
    el.innerHTML = '<p class="empty-message">No games played yet. Start a game!</p>';
    return;
  }

  let sorted = [...cachedStats];
  if (type === 'totalWinnings') sorted.sort((a, b) => parseFloat(b.total_winnings) - parseFloat(a.total_winnings));
  else if (type === 'gamesPlayed') sorted.sort((a, b) => b.games_played - a.games_played);
  else if (type === 'winRate') sorted.sort((a, b) => parseFloat(b.win_rate_pct || 0) - parseFloat(a.win_rate_pct || 0));

  el.innerHTML = sorted.map((row, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1;
    let val = '', cls = '';
    if (type === 'totalWinnings') {
      const n = parseFloat(row.total_winnings);
      val = (n >= 0 ? '+' : '') + '$' + n.toFixed(2);
      cls = n >= 0 ? 'positive' : 'negative';
    } else if (type === 'gamesPlayed') {
      val = `${row.games_played} games`;
    } else {
      val = row.win_rate_pct != null ? `${parseFloat(row.win_rate_pct).toFixed(1)}%` : '0%';
    }
    return `<div class="leaderboard-row">
      <span class="medal">${medal}</span>
      <span class="player-name">${row.player_name}</span>
      <span class="leaderboard-value ${cls}">${val}</span>
    </div>`;
  }).join('');
}

// ── Session History ────────────────────────────────────────────────────────
function renderSessionHistory() {
  const el = document.getElementById('session-history');
  if (!cachedSessions.length) {
    el.innerHTML = '<p class="empty-message">No sessions recorded yet.</p>';
    return;
  }

  el.innerHTML = cachedSessions.map(session => {
    const date = new Date(session.played_at);
    const dateStr = date.toLocaleDateString('en-AU', {
      month: 'short', day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
    const results = session.session_results || [];
    const rows = results.map(r => {
      const net = parseFloat(r.net_real);
      const sign = net > 0 ? '+' : '';
      const cls  = net > 0.01 ? 'net-win' : net < -0.01 ? 'net-loss' : 'net-even';
      return `<div class="session-result">
        <span>${r.player_name}</span>
        <span class="amount ${cls}">${sign}$${net.toFixed(2)}</span>
      </div>`;
    }).join('');
    return `<div class="session-card">
      <div class="session-header">
        <span class="session-date">${dateStr}</span>
        <span class="session-players">${results.length} players</span>
      </div>
      <div class="session-details">${rows}</div>
    </div>`;
  }).join('');
}

// ── Haptic ─────────────────────────────────────────────────────────────────
function haptic(style = 'light') {
  if (window.navigator && window.navigator.vibrate) {
    navigator.vibrate({ light: [10], medium: [20], heavy: [30, 10, 30] }[style] || [10]);
  }
}

// ── Player Management ──────────────────────────────────────────────────────
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
    <label>Total Buy-ins (chips)</label>
    <input type="number" placeholder="e.g. 200" id="buyin-${playerCount}" inputmode="decimal">
    <label>Final Chips</label>
    <input type="number" placeholder="e.g. 180" id="final-${playerCount}" inputmode="decimal">
  `;
  document.getElementById('players').appendChild(div);
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

function setupSwipeToRemove(card) {
  let startX = 0, currentX = 0, isDragging = false;
  card.addEventListener('touchstart', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
    startX = e.touches[0].clientX; isDragging = true; card.style.transition = 'none';
  }, { passive: true });
  card.addEventListener('touchmove', e => {
    if (!isDragging) return;
    currentX = e.touches[0].clientX - startX;
    if (currentX < 0) { card.style.transform = `translateX(${currentX}px)`; card.style.opacity = Math.max(0.3, 1 + currentX / 200); }
  }, { passive: true });
  card.addEventListener('touchend', () => {
    if (!isDragging) return; isDragging = false; card.style.transition = '';
    if (currentX < -100) {
      haptic('heavy'); card.style.transform = 'translateX(-110%)'; card.style.opacity = '0';
      setTimeout(() => card.remove(), 300);
    } else { card.style.transform = ''; card.style.opacity = ''; }
    currentX = 0;
  });
}

// ── Calculate & Settle ─────────────────────────────────────────────────────
function collectPlayerNets() {
  const nets = {}; const seen = new Set();
  for (const p of document.querySelectorAll('.player')) {
    const id   = p.id.split('-')[1];
    const name = document.getElementById(`name-${id}`).value.trim();
    if (!name) { alert('⚠️ All players must have a name before settling.'); throw new Error('Missing name'); }
    if (seen.has(name)) { alert(`⚠️ Duplicate name: "${name}". Each player needs a unique name.`); throw new Error('Duplicate name'); }
    seen.add(name);
    const buyIn = parseFloat(document.getElementById(`buyin-${id}`).value) || 0;
    const final = parseFloat(document.getElementById(`final-${id}`).value) || 0;
    nets[name] = toRealMoney(final - buyIn);
  }
  return nets;
}

function round2(n) { return Math.round(n * 100) / 100; }

function settle(nets) {
  const losers = [], winners = [];
  for (const [name, amount] of Object.entries(nets)) {
    const r = round2(amount);
    if (r < -0.01) losers.push({ name, amount: Math.abs(r) });
    if (r >  0.01) winners.push({ name, amount: r });
  }
  losers.sort((a, b) => b.amount - a.amount);
  winners.sort((a, b) => b.amount - a.amount);
  const txs = [];
  while (losers.length && winners.length) {
    const lo = losers[0], wi = winners[0];
    const pay = round2(Math.min(lo.amount, wi.amount));
    txs.push({ from: lo.name, to: wi.name, amount: pay });
    lo.amount = round2(lo.amount - pay); wi.amount = round2(wi.amount - pay);
    if (lo.amount < 0.01) losers.shift();
    if (wi.amount < 0.01) winners.shift();
  }
  return txs;
}

function calculate() {
  haptic('medium');
  try {
    const nets  = collectPlayerNets();
    const total = Object.values(nets).reduce((a, b) => a + b, 0);
    if (Math.abs(total) > 0.02) { renderError(`⚠️ Numbers don't balance — off by $${total.toFixed(2)}`); return; }
    const txs = settle(nets);
    showSettlementPreview(txs, nets);
  } catch (e) { /* alert already shown */ }
}

function showSettlementPreview(txs, nets) {
  const sumHtml = Object.entries(nets).map(([name, net]) => {
    const sign = net > 0 ? '+' : '';
    const cls  = net > 0.01 ? 'net-win' : net < -0.01 ? 'net-loss' : 'net-even';
    return `<div class="net-row"><span class="net-name">${name}</span><span class="net-amount ${cls}">${sign}$${net.toFixed(2)}</span></div>`;
  }).join('');
  const txHtml = txs.length === 0
    ? '<p class="even-message">Everyone is even — well played. 🎉</p>'
    : txs.map(({ from, to, amount }) =>
        `<div class="transaction" style="opacity:1"><strong>${from}</strong><span class="arrow">→</span><strong>${to}</strong><span class="amount">$${amount.toFixed(2)}</span></div>`
      ).join('');

  const payload = JSON.stringify({ nets, txs });
  const encoded = btoa(unescape(encodeURIComponent(payload)));

  document.getElementById('results').innerHTML = `
    <div class="result">
      <h3>📋 Confirm Settlement</h3>
      <div style="background:rgba(0,0,0,.3);padding:var(--space-md);border-radius:6px;margin-bottom:var(--space-md)">
        <h4 style="color:var(--gold-light);margin-top:0;margin-bottom:var(--space-sm)">Player Totals</h4>
        <div class="net-summary">${sumHtml}</div>
        <h4 style="color:var(--gold-light);margin-top:var(--space-md);margin-bottom:var(--space-sm)">Payments</h4>
        ${txHtml}
      </div>
      <p style="color:var(--cream-dim);font-size:var(--text-xs);text-align:center;margin-bottom:var(--space-md)">
        ⚠️ Review above — this will be saved to the shared Hall of Fame.
      </p>
      <div style="display:flex;gap:var(--space-sm)">
        <button style="flex:1;background:linear-gradient(135deg,#8b1520,var(--red));color:var(--cream);border:1px solid rgba(224,36,58,.4);margin:0"
          onclick="proceedWithSettlement('${encoded}')">✓ Confirm & Save</button>
        <button style="flex:1;background:transparent;border:1px solid var(--gold-dim);color:var(--cream);margin:0"
          onclick="document.getElementById('results').innerHTML=''">✕ Cancel & Edit</button>
      </div>
    </div>`;
  document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Save to Supabase ────────────────────────────────────────────────────────
async function proceedWithSettlement(encoded) {
  haptic('heavy');
  setSyncStatus('syncing', '⟳  saving to database…');

  let nets, txs;
  try {
    const payload = JSON.parse(decodeURIComponent(escape(atob(encoded))));
    nets = payload.nets; txs = payload.txs;
  } catch (e) { alert('⚠️ Failed to parse settlement data.'); return; }

  try {
    // 1. Insert session row
    const { data: sessionRow, error: sErr } = await supabaseClient
      .from('sessions')
      .insert({})
      .select()
      .single();
    if (sErr) throw sErr;
    const sessionId = sessionRow.id;

    // 2. Get chip conversion inputs (stored in conversion inputs)
    const chips = parseFloat(document.getElementById('chip-value').value) || 200;
    const real  = parseFloat(document.getElementById('real-value').value) || 10;

    // 3. Insert session_results rows
    const resultRows = Object.entries(nets).map(([name, netReal]) => {
      // Reverse-calculate buy-in and final chips from the UI
      const id = [...document.querySelectorAll('.player')]
        .find(p => document.getElementById(`name-${p.id.split('-')[1]}`).value.trim() === name)
        ?.id.split('-')[1];
      const buyIn = id ? parseFloat(document.getElementById(`buyin-${id}`).value) || 0 : 0;
      const final = id ? parseFloat(document.getElementById(`final-${id}`).value) || 0 : 0;
      return { session_id: sessionId, player_name: name, buy_in_chips: buyIn, final_chips: final, net_real: round2(netReal) };
    });
    const { error: rErr } = await supabaseClient.from('session_results').insert(resultRows);
    if (rErr) throw rErr;

    // 4. Insert transactions
    if (txs.length) {
      const txRows = txs.map(t => ({ session_id: sessionId, from_player: t.from, to_player: t.to, amount: t.amount }));
      const { error: tErr } = await supabaseClient.from('transactions').insert(txRows);
      if (tErr) throw tErr;
    }

    setSyncStatus('ok', '✓  saved — Hall of Fame updated!');
    setTimeout(() => setSyncStatus('ok', '●  connected — shared leaderboard'), 3000);
    renderFinalResults(txs, nets);
  } catch (err) {
    console.error('Supabase save error:', err);
    setSyncStatus('error', '✕  save failed — check console');
    alert('⚠️ Could not save to database. Check your config.js and console for details.');
  }
}

function renderFinalResults(txs, nets) {
  const sumHtml = Object.entries(nets).map(([name, net]) => {
    const sign = net > 0 ? '+' : '';
    const cls  = net > 0.01 ? 'net-win' : net < -0.01 ? 'net-loss' : 'net-even';
    return `<div class="net-row"><span class="net-name">${name}</span><span class="net-amount ${cls}">${sign}$${net.toFixed(2)}</span></div>`;
  }).join('');
  const txHtml = txs.length === 0
    ? '<p class="even-message">Everyone is even — well played. 🎉</p>'
    : txs.map(({ from, to, amount }, i) =>
        `<div class="transaction" style="animation-delay:${i * 80}ms"><strong>${from}</strong><span class="arrow">→</span><strong>${to}</strong><span class="amount">$${amount.toFixed(2)}</span></div>`
      ).join('');

  document.getElementById('results').innerHTML = `
    <div class="result">
      <h3>📊 Summary</h3>
      <div class="net-summary">${sumHtml}</div>
      <div class="divider">Payments</div>
      ${txHtml}
      <button class="share-btn" onclick="shareResults()">↑ Share Results</button>
      <button class="new-game-btn" onclick="resetForNewGame()">🔄 New Game</button>
    </div>`;
  document.getElementById('results').querySelectorAll('.transaction').forEach(t => t.classList.add('tx-animate'));
  document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderError(msg) {
  document.getElementById('results').innerHTML = `<div class="result error"><p>${msg}</p></div>`;
}

function resetForNewGame() {
  haptic('light');
  document.getElementById('players').innerHTML = '';
  document.getElementById('results').innerHTML = '';
  playerCount = 0;
  addPlayer(); addPlayer();
}

// ── Share ──────────────────────────────────────────────────────────────────
function shareResults() {
  haptic('light');
  const txEls  = document.querySelectorAll('.transaction');
  const netEls = document.querySelectorAll('.net-row');
  let text = "🃏 Poker Settler — Tonight's Results\n\n📊 Summary\n";
  netEls.forEach(r => { text += `  ${r.querySelector('.net-name').textContent}: ${r.querySelector('.net-amount').textContent}\n`; });
  text += '\n💰 Payments\n';
  if (!txEls.length) { text += '  Everyone is even!\n'; }
  else txEls.forEach(t => {
    const [from, to] = t.querySelectorAll('strong');
    text += `  ${from.textContent} → ${to.textContent}: ${t.querySelector('.amount').textContent}\n`;
  });
  const btn = document.querySelector('.share-btn');
  if (navigator.share) {
    navigator.share({ title: 'Poker Results', text })
      .then(() => { btn.textContent = '✓ Shared!'; setTimeout(() => btn.textContent = '↑ Share Results', 2000); })
      .catch(err => { if (err.name !== 'AbortError') copyToClipboard(text, btn); });
  } else { copyToClipboard(text, btn); }
}

function copyToClipboard(text, btn) {
  navigator.clipboard?.writeText(text)
    .then(() => { btn.textContent = '✓ Copied!'; setTimeout(() => btn.textContent = '↑ Share Results', 2000); })
    .catch(() => { btn.textContent = '✕ Copy failed'; setTimeout(() => btn.textContent = '↑ Share Results', 2000); });
}

// ── Clear History ──────────────────────────────────────────────────────────
async function confirmResetHistory() {
  if (!confirm('⚠️ This will permanently delete ALL game history and leaderboard data for everyone. Are you sure?')) return;
  setSyncStatus('syncing', '⟳  clearing…');
  try {
    // Delete all sessions (cascades to results + transactions via FK)
    const { error } = await supabaseClient.from('sessions').delete().neq('id', 0);
    if (error) throw error;
    cachedStats = []; cachedSessions = [];
    setSyncStatus('ok', '✓  cleared');
    setTimeout(() => setSyncStatus('ok', '●  connected — shared leaderboard'), 2000);
    renderHallOfFame();
  } catch (err) {
    console.error('Clear error:', err);
    setSyncStatus('error', '✕  failed to clear — check console');
  }
}

// ── Init ───────────────────────────────────────────────────────────────────
updateConversionRate();
addPlayer();
addPlayer();