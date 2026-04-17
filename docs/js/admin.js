/**
 * Admin page — lineup management, player swaps, substitutes, email retrigger.
 */

let adminData = null;

(async function () {
  const key = getAdminKey();
  if (!key) {
    document.getElementById('content').innerHTML =
      '<div class="card card-red"><strong>Access Denied</strong><p>Admin key required. Access this page with ?key=YOUR_ADMIN_KEY</p></div>';
    return;
  }

  await loadAdminData();
})();

async function loadAdminData() {
  showLoading('content');
  const data = await adminFetch('getData');

  if (data.error) {
    showError('content', data.error);
    return;
  }

  adminData = data;
  renderAdmin();
}

function renderAdmin() {
  const content = document.getElementById('content');
  const data = adminData;
  const names = {};
  if (data.all_players) {
    data.all_players.forEach(p => { names[p.player_id] = p.name; });
  }

  let html = '';

  // Week info
  html += '<div class="card"><strong>' + data.friday_display + '</strong>';
  html += '<p>Week: ' + data.week_id + ' &middot; ';
  html += data.finalized ? '<span class="badge badge-green">Finalized</span>' : '<span class="badge badge-gray">Pending</span>';
  html += '</p></div>';

  // Current lineup (if finalized)
  if (data.finalized) {
    html += '<h2>Current Lineup</h2>';

    // Playing players
    html += '<div class="card">';
    html += '<strong>Playing (' + data.playing.length + ')</strong>';
    data.playing.forEach(id => {
      const name = names[id] || id;
      html += '<div class="admin-player">';
      html += '<span>' + name + '</span>';
      html += '<button class="btn btn-red" style="padding:6px 12px;font-size:13px;min-height:36px;" onclick="togglePlayer(\'' + id + '\')">Bench</button>';
      html += '</div>';
    });
    html += '</div>';

    // Benched players
    if (data.benched.length > 0) {
      html += '<div class="card card-yellow">';
      html += '<strong>Benched (' + data.benched.length + ')</strong>';
      data.benched.forEach(id => {
        const name = names[id] || id;
        html += '<div class="admin-player">';
        html += '<span>' + name + '</span>';
        html += '<button class="btn btn-green" style="padding:6px 12px;font-size:13px;min-height:36px;" onclick="togglePlayer(\'' + id + '\')">Add to Lineup</button>';
        html += '</div>';
      });
      html += '</div>';
    }

    // Court assignments
    if (data.courts) {
      html += '<h3>Court Assignments</h3>';
      const courts = data.courts;
      if (courts.doubles_1) {
        html += '<div class="card card-green"><strong>Court 1 — Doubles</strong>';
        html += courts.doubles_1.map(id => names[id] || id).join(', ');
        html += '</div>';
      }
      if (courts.doubles_2) {
        html += '<div class="card card-green"><strong>Court 2 — Doubles</strong>';
        html += courts.doubles_2.map(id => names[id] || id).join(', ');
        html += '</div>';
      }
      if (courts.singles_1) {
        const label = courts.doubles_1 ? 'Court 2' : 'Court 1';
        html += '<div class="card card-blue"><strong>' + label + ' — Singles</strong>';
        html += courts.singles_1.map(id => names[id] || id).join(', ');
        html += '</div>';
      }
    }
  }

  // Responses
  html += '<h2>Responses</h2>';
  const preBenchIds = !data.finalized ? new Set(data.benched || []) : new Set();
  const allIn = (data.responses || []).filter(r => r.response === 'in');
  const inResponses = allIn.filter(r => !preBenchIds.has(r.player_id));
  const preBenched = allIn.filter(r => preBenchIds.has(r.player_id));
  const outResponses = (data.responses || []).filter(r => r.response === 'out');

  if (inResponses.length > 0) {
    html += '<div class="card card-green"><strong>In (' + inResponses.length + ')</strong>';
    if (!data.finalized) {
      inResponses.forEach(r => {
        html += '<div class="admin-player">';
        html += '<span>' + r.name + '</span>';
        html += '<button class="btn btn-red" style="padding:6px 12px;font-size:13px;min-height:36px;" onclick="togglePlayer(\'' + r.player_id + '\')">Bench</button>';
        html += '</div>';
      });
    } else {
      html += '<ul class="player-list">';
      inResponses.forEach(r => { html += '<li>' + r.name + '</li>'; });
      html += '</ul>';
    }
    html += '</div>';
  }

  if (preBenched.length > 0) {
    html += '<div class="card card-yellow"><strong>Benched by Admin (' + preBenched.length + ')</strong>';
    html += '<p style="font-size:13px;color:var(--gray);margin:4px 0 8px;">Will be excluded when the lineup is finalized.</p>';
    preBenched.forEach(r => {
      html += '<div class="admin-player">';
      html += '<span>' + r.name + '</span>';
      html += '<button class="btn btn-green" style="padding:6px 12px;font-size:13px;min-height:36px;" onclick="togglePlayer(\'' + r.player_id + '\')">Restore</button>';
      html += '</div>';
    });
    html += '</div>';
  }

  if (outResponses.length > 0) {
    html += '<div class="card card-red"><strong>Out (' + outResponses.length + ')</strong>';
    html += '<ul class="player-list">';
    outResponses.forEach(r => { html += '<li>' + r.name + '</li>'; });
    html += '</ul></div>';
  }

  if ((data.no_response || []).length > 0) {
    html += '<div class="card card-gray"><strong>No Response (' + data.no_response.length + ')</strong>';
    html += '<ul class="player-list">';
    data.no_response.forEach(p => { html += '<li>' + p.name + '</li>'; });
    html += '</ul></div>';
  }

  // Add substitute section
  html += '<h2>Add Substitute</h2>';
  html += '<div class="card">';
  html += '<div style="margin-bottom:12px;">';
  html += '<label style="font-size:13px;color:var(--gray);display:block;margin-bottom:4px;">Substitute Name</label>';
  html += '<input type="text" id="sub-name" placeholder="Enter substitute player name">';
  html += '</div>';
  html += '<button class="btn btn-blue" onclick="addSubstitute()">Add Substitute</button>';
  html += '</div>';

  // Retrigger email button
  if (data.finalized) {
    html += '<h2>Re-Send Lineup Email</h2>';
    html += '<div class="card">';
    html += '<p>Send the updated lineup to all players.</p>';
    html += '<button class="btn btn-green" id="retrigger-btn" onclick="retriggerEmail()">Send Lineup Email</button>';
    html += '</div>';
  }

  content.innerHTML = html;
}

async function togglePlayer(playerId) {
  const result = await adminFetch('togglePlayer', { player: playerId, week: adminData.week_id });
  if (result.error) {
    alert('Error: ' + result.error);
    return;
  }
  await loadAdminData();
}

async function addSubstitute() {
  const nameInput = document.getElementById('sub-name');
  const subName = nameInput.value.trim();
  if (!subName) {
    alert('Please enter a name for the substitute.');
    return;
  }

  const result = await adminFetch('addSub', { subName: subName, week: adminData.week_id });
  if (result.error) {
    alert('Error: ' + result.error);
    return;
  }
  nameInput.value = '';
  await loadAdminData();
}

async function retriggerEmail() {
  const btn = document.getElementById('retrigger-btn');
  btn.disabled = true;
  btn.textContent = 'Sending...';

  const result = await adminFetch('retrigger', { week: adminData.week_id });
  if (result.error) {
    alert('Error: ' + result.error);
    btn.disabled = false;
    btn.textContent = 'Send Lineup Email';
    return;
  }

  btn.textContent = 'Sent!';
  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = 'Send Lineup Email';
  }, 3000);
}
