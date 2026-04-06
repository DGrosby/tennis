/**
 * Stats page — sortable player statistics table.
 */

let statsData = [];
let sortCol = 'name';
let sortDir = 'asc';

(async function () {
  const data = await apiFetch('stats');

  if (data.error) {
    showError('content', data.error);
    return;
  }

  statsData = data;
  renderTable();
})();

function renderTable() {
  const content = document.getElementById('content');

  // Sort data
  const sorted = [...statsData].sort((a, b) => {
    let aVal = a[sortCol];
    let bVal = b[sortCol];
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const columns = [
    { key: 'name', label: 'Player' },
    { key: 'total_plays', label: 'Played' },
    { key: 'total_benched', label: 'Benched' },
    { key: 'play_pct', label: 'Play %' }
  ];

  let html = '<table class="stats-table"><thead><tr>';
  columns.forEach(col => {
    let cls = '';
    if (sortCol === col.key) {
      cls = sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc';
    }
    html += '<th class="' + cls + '" onclick="sortBy(\'' + col.key + '\')">' + col.label + '</th>';
  });
  html += '</tr></thead><tbody>';

  sorted.forEach(p => {
    const rowClass = p.benched_last_week ? ' class="protected"' : '';
    html += '<tr' + rowClass + '>';
    html += '<td data-label="Player">' + p.name;
    if (p.benched_last_week) html += ' <span class="badge badge-yellow">Protected</span>';
    html += '</td>';
    html += '<td data-label="Played">' + p.total_plays + '</td>';
    html += '<td data-label="Benched">' + p.total_benched + '</td>';
    html += '<td data-label="Play %">' + p.play_pct + '%</td>';
    html += '</tr>';
  });

  html += '</tbody></table>';

  if (sorted.some(p => p.benched_last_week)) {
    html += '<p class="text-gray mt-4" style="font-size:13px;">Players highlighted in yellow were benched last week and are protected from being benched this week.</p>';
  }

  content.innerHTML = html;
}

function sortBy(col) {
  if (sortCol === col) {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortCol = col;
    sortDir = col === 'name' ? 'asc' : 'desc';
  }
  renderTable();
}
