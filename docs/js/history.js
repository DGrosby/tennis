/**
 * History page — shows past weeks with expandable details.
 */

(async function () {
  const data = await apiFetch('history');

  if (data.error) {
    showError('content', data.error);
    return;
  }

  const content = document.getElementById('content');
  const names = data.player_names || {};
  const weeks = data.weeks || [];

  if (weeks.length === 0) {
    content.innerHTML = '<div class="card card-gray"><strong>No history yet</strong><p>History will appear after the first week is completed.</p></div>';
    return;
  }

  let html = '';

  weeks.forEach((week, index) => {
    const played = week.players.filter(p => p.status === 'played');
    const benched = week.players.filter(p => p.status === 'benched');
    const optedOut = week.players.filter(p => p.status === 'opted_out');
    const cancelled = week.players.some(p => p.status === 'cancelled');

    const fridayStr = week.friday_date ? new Date(week.friday_date).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric'
    }) : week.week_id;

    const statusBadge = cancelled
      ? '<span class="badge badge-red">Cancelled</span>'
      : '<span class="badge badge-green">' + played.length + ' played</span>';

    html += '<div class="week-card">';
    html += '<div class="week-card-header" onclick="toggleWeek(' + index + ')">';
    html += '<span>' + fridayStr + ' (' + week.week_id + ')</span>';
    html += statusBadge;
    html += '</div>';
    html += '<div class="week-card-body" id="week-' + index + '">';

    if (cancelled) {
      html += '<p>Tennis was cancelled this week due to insufficient players.</p>';
    } else {
      // Court assignments
      if (week.courts) {
        if (week.courts.doubles_1) {
          html += '<div class="card card-green"><strong>Court 1 — Doubles</strong>';
          html += week.courts.doubles_1.map(id => names[id] || id).join(', ');
          html += '</div>';
        }
        if (week.courts.doubles_2) {
          html += '<div class="card card-green"><strong>Court 2 — Doubles</strong>';
          html += week.courts.doubles_2.map(id => names[id] || id).join(', ');
          html += '</div>';
        }
        if (week.courts.singles_1) {
          const label = week.courts.doubles_1 ? 'Court 2' : 'Court 1';
          html += '<div class="card card-blue"><strong>' + label + ' — Singles</strong>';
          html += week.courts.singles_1.map(id => names[id] || id).join(', ');
          html += '</div>';
        }
      } else if (played.length > 0) {
        html += '<div class="card card-green"><strong>Played (' + played.length + ')</strong>';
        html += played.map(p => names[p.player_id] || p.player_id).join(', ');
        html += '</div>';
      }

      if (benched.length > 0) {
        html += '<div class="card card-yellow"><strong>Benched (' + benched.length + ')</strong>';
        html += benched.map(p => names[p.player_id] || p.player_id).join(', ');
        html += '</div>';
      }

      if (optedOut.length > 0) {
        html += '<p class="text-gray" style="font-size:13px;">Opted out: ' +
          optedOut.map(p => names[p.player_id] || p.player_id).join(', ') + '</p>';
      }
    }

    html += '</div></div>';
  });

  content.innerHTML = html;

  // Auto-expand first week
  if (weeks.length > 0) toggleWeek(0);
})();

function toggleWeek(index) {
  const body = document.getElementById('week-' + index);
  if (body) body.classList.toggle('open');
}
