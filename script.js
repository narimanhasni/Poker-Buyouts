let playerCount = 0;

// ─── Player Management ────────────────────────────────────────────────────────

function addPlayer() {
  playerCount++;

  const div = document.createElement('div');
  div.className = 'player';
  div.id = `player-${playerCount}`;
  div.innerHTML = `
    <button class="remove-btn" onclick="removePlayer(${playerCount})">✕ Remove</button>
          <div class="player-number">Player ${playerCount}</div>
    <label>Name</label>
    <input type="text" placeholder="Name" id="name-${playerCount}">
    <label>Total Buy-ins ($)</label>
    <input type="number" placeholder="e.g. 100" id="buyin-${playerCount}">
    <label>Final Chips ($)</label>
    <input type="number" placeholder="e.g. 85" id="final-${playerCount}">
  `;

  document.getElementById('players').appendChild(div);
}

function removePlayer(id) {
  document.getElementById(`player-${id}`).remove();
}

// ─── Calculate ────────────────────────────────────────────────────────────────

function calculate() {
  const nets = collectPlayerNets();
  const total = Object.values(nets).reduce((a, b) => a + b, 0);

  if (Math.abs(total) > 0.01) {
    renderError(`⚠️ Numbers don't add up! Off by $${total.toFixed(2)}`);
    return;
  }

  const transactions = settle(nets);
  renderResults(transactions);
}

function collectPlayerNets() {
  const nets = {};

  document.querySelectorAll('.player').forEach(p => {
    const id = p.id.split('-')[1];
    const name = document.getElementById(`name-${id}`).value || `Player ${id}`;
    const buyIn = parseFloat(document.getElementById(`buyin-${id}`).value) || 0;
    const final = parseFloat(document.getElementById(`final-${id}`).value) || 0;
    nets[name] = final - buyIn;
  });

  return nets;
}

// ─── Settlement Algorithm ─────────────────────────────────────────────────────

function settle(nets) {
  const losers = [];
  const winners = [];

  for (const [name, amount] of Object.entries(nets)) {
    if (amount < -0.01) losers.push({ name, amount: Math.abs(amount) });
    if (amount > 0.01)  winners.push({ name, amount });
  }

  losers.sort((a, b) => b.amount - a.amount);
  winners.sort((a, b) => b.amount - a.amount);

  const transactions = [];

  while (losers.length > 0 && winners.length > 0) {
    const loser = losers[0];
    const winner = winners[0];
    const payment = Math.min(loser.amount, winner.amount);

    transactions.push({ from: loser.name, to: winner.name, amount: payment });

    loser.amount -= payment;
    winner.amount -= payment;

    if (loser.amount < 0.01) losers.shift();
    if (winner.amount < 0.01) winners.shift();
  }

  return transactions;
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function renderError(message) {
  document.getElementById('results').innerHTML = `
    <div class="result error"><p>${message}</p></div>
  `;
}

function renderResults(transactions) {
  let html = '<div class="result"><h3>💰 Payments</h3>';

  if (transactions.length === 0) {
    html += '<p class="even-message">Everyone is even — well played.</p>';
  } else {
    transactions.forEach(({ from, to, amount }) => {
      html += `
        <div class="transaction">
          <strong>${from}</strong>
          <span class="arrow">pays</span>
          <strong>${to}</strong>
          <span class="amount">$${amount.toFixed(2)}</span>
        </div>
      `;
    });
  }

  html += '</div>';
  document.getElementById('results').innerHTML = html;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

addPlayer();
addPlayer();