/**
 * Dashboard page — shows current week status.
 */

(async function () {
  const data = await apiFetch('current');

  if (data.error) {
    showError('content', data.error);
    return;
  }

  document.getElementById('week-date').textContent = data.friday_display;

  const content = document.getElementById('content');
  const names = data.player_names || {};

  function getName(id) {
    if (names[id] && names[id].name) return names[id].name;
    if (typeof names[id] === 'string') return names[id];
    return id;
  }

  let html = '';

  if (data.finalized) {
    // Show final lineup with court assignments
    html += '<h2>Lineup Finalized</h2>';

    const courts = data.courts || {};

    if (courts.doubles_1) {
      html += '<div class="card card-green"><strong>Court 1 — Doubles</strong>';
      html += '<ul class="player-list">';
      courts.doubles_1.forEach(id => {
        html += '<li>' + getName(id) + '</li>';
      });
      html += '</ul></div>';
    }

    if (courts.doubles_2) {
      html += '<div class="card card-green"><strong>Court 2 — Doubles</strong>';
      html += '<ul class="player-list">';
      courts.doubles_2.forEach(id => {
        html += '<li>' + getName(id) + '</li>';
      });
      html += '</ul></div>';
    }

    if (courts.singles_1) {
      const label = courts.doubles_1 ? 'Court 2' : 'Court 1';
      html += '<div class="card card-blue"><strong>' + label + ' — Singles</strong>';
      html += '<ul class="player-list">';
      courts.singles_1.forEach(id => {
        html += '<li>' + getName(id) + '</li>';
      });
      html += '</ul></div>';
    }

    if (data.benched.length > 0) {
      html += '<div class="card card-yellow"><strong>Benched This Week</strong>';
      html += '<ul class="player-list">';
      data.benched.forEach(id => {
        html += '<li>' + getName(id) + '</li>';
      });
      html += '</ul>';
      html += '<p class="text-gray" style="font-size:13px;margin-top:8px;">Benched players have priority next week.</p>';
      html += '</div>';
    }

    if (data.playing.length === 0 && data.benched.length === 0) {
      html += '<div class="card card-red"><strong>Cancelled</strong>';
      html += '<p>Not enough players this week.</p></div>';
    }
  } else {
    // Show responses so far
    const inPlayers = data.responses.filter(r => r.response === 'in');
    const outPlayers = data.responses.filter(r => r.response === 'out');

    html += '<h2>Responses So Far</h2>';

    if (inPlayers.length > 0) {
      html += '<div class="card card-green"><strong>In (' + inPlayers.length + ')</strong>';
      html += '<ul class="player-list">';
      inPlayers.forEach(r => {
        html += '<li>' + r.name + '</li>';
      });
      html += '</ul></div>';
    }

    if (outPlayers.length > 0) {
      html += '<div class="card card-red"><strong>Out (' + outPlayers.length + ')</strong>';
      html += '<ul class="player-list">';
      outPlayers.forEach(r => {
        html += '<li>' + r.name + '</li>';
      });
      html += '</ul></div>';
    }

    if (data.no_response.length > 0) {
      html += '<div class="card card-gray"><strong>No Response (' + data.no_response.length + ')</strong>';
      html += '<ul class="player-list">';
      data.no_response.forEach(p => {
        html += '<li>' + p.name + '</li>';
      });
      html += '</ul></div>';
    }

    if (inPlayers.length === 0 && outPlayers.length === 0) {
      html += '<div class="card card-gray"><strong>No responses yet</strong>';
      html += '<p>Emails were sent Monday morning. Check back later.</p></div>';
    }
  }

  content.innerHTML = html;

  // Auto-refresh every 60 seconds
  setTimeout(() => location.reload(), 60000);
})();
