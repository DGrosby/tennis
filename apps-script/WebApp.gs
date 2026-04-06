/**
 * HTTP endpoint handler for the Apps Script web app.
 * Handles player responses (from email links), API calls (from frontend), and admin actions.
 */

function doGet(e) {
  const action = e.parameter.action;

  if (action === 'respond') {
    return handleResponse(e);
  } else if (action === 'api') {
    return handleApi(e);
  } else if (action === 'admin') {
    return handleAdmin(e);
  }

  return ContentService.createTextOutput('Invalid action')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  // Route POST requests through the same handler
  const params = e.parameter;
  if (params.action === 'admin') {
    return handleAdmin(e);
  }
  return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid action' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handles a player clicking "I'm In" or "I'm Out" from the email.
 * Records the response and redirects to the confirmation page.
 */
function handleResponse(e) {
  const playerId = e.parameter.player;
  const weekId = e.parameter.week;
  const response = e.parameter.response;

  if (!playerId || !weekId || !response) {
    return HtmlService.createHtmlOutput('<h2>Invalid link. Please use the buttons in your email.</h2>');
  }

  const player = getPlayerById(playerId);
  const playerName = player ? encodeURIComponent(player.name.split(' ')[0]) : 'Player';
  const finalized = isLineupFinalized(weekId);

  // Always record the response even if finalized (for admin retrigger)
  recordResponse(weekId, playerId, response);

  // Redirect to confirmation page
  const status = finalized ? 'late' : response;
  const redirectUrl = CONFIG.GITHUB_PAGES_URL + '/confirm.html?status=' + status +
    '&name=' + playerName + '&week=' + encodeURIComponent(weekId);

  return HtmlService.createHtmlOutput(
    '<html><head><meta http-equiv="refresh" content="0;url=' + redirectUrl + '"></head>' +
    '<body><p>Redirecting... <a href="' + redirectUrl + '">Click here</a> if not redirected.</p></body></html>'
  );
}

/**
 * Handles API requests from the GitHub Pages frontend.
 * Returns JSON data for the dashboard, stats, and history pages.
 */
function handleApi(e) {
  const endpoint = e.parameter.endpoint;
  let data;

  if (endpoint === 'current') {
    data = getCurrentWeekData();
  } else if (endpoint === 'stats') {
    data = getPlayerStats();
  } else if (endpoint === 'history') {
    data = getHistoryData();
  } else {
    data = { error: 'Unknown endpoint' };
  }

  const output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * Returns current week data for the dashboard.
 */
function getCurrentWeekData() {
  const weekId = getCurrentWeekId();
  const friday = getNextFriday(new Date());
  const players = getActivePlayers();
  const responses = getResponsesForWeek(weekId);
  const weekData = getWeekData(weekId);
  const playerMap = {};
  players.forEach(p => { playerMap[p.player_id] = p; });

  const responseList = responses.map(r => ({
    player_id: r.player_id,
    name: playerMap[r.player_id] ? playerMap[r.player_id].name : r.player_id,
    response: r.response,
    responded_at: r.responded_at
  }));

  const respondedIds = new Set(responses.map(r => r.player_id));
  const noResponse = players
    .filter(p => !respondedIds.has(p.player_id))
    .map(p => ({ player_id: p.player_id, name: p.name }));

  return {
    week_id: weekId,
    friday_date: friday.toISOString(),
    friday_display: formatDateLong(friday),
    responses: responseList,
    no_response: noResponse,
    finalized: weekData ? weekData.lineup_finalized : false,
    playing: weekData ? weekData.playing_players : [],
    benched: weekData ? weekData.benched_players : [],
    courts: weekData ? weekData.court_assignments : {},
    player_names: playerMap
  };
}

/**
 * Returns all player stats.
 */
function getPlayerStats() {
  const players = getActivePlayers();
  return players.map(p => ({
    player_id: p.player_id,
    name: p.name,
    total_plays: p.total_plays,
    total_benched: p.total_benched,
    benched_last_week: p.benched_last_week,
    play_pct: (p.total_plays + p.total_benched) > 0
      ? Math.round((p.total_plays / (p.total_plays + p.total_benched)) * 100)
      : 0
  }));
}

/**
 * Returns history data for past weeks.
 */
function getHistoryData() {
  const sheet = getSheet(CONFIG.SHEETS.HISTORY);
  const data = sheet.getDataRange().getValues();
  const weeks = {};

  for (let i = 1; i < data.length; i++) {
    const weekId = data[i][0];
    if (!weeks[weekId]) {
      weeks[weekId] = {
        week_id: weekId,
        friday_date: data[i][1],
        players: []
      };
    }
    weeks[weekId].players.push({
      player_id: data[i][2],
      status: data[i][3]
    });
  }

  // Also get court assignments from Weeks sheet
  const weeksSheet = getSheet(CONFIG.SHEETS.WEEKS);
  const weeksData = weeksSheet.getDataRange().getValues();
  for (let i = 1; i < weeksData.length; i++) {
    const wid = weeksData[i][0];
    if (weeks[wid]) {
      weeks[wid].courts = weeksData[i][7] ? JSON.parse(weeksData[i][7]) : {};
    }
  }

  // Get player names
  const players = getActivePlayers();
  const playerMap = {};
  players.forEach(p => { playerMap[p.player_id] = p.name; });

  return {
    weeks: Object.values(weeks).sort((a, b) => b.week_id.localeCompare(a.week_id)),
    player_names: playerMap
  };
}

/**
 * Handles admin actions (lineup adjustments, retrigger email).
 */
function handleAdmin(e) {
  const key = e.parameter.key;
  if (key !== CONFIG.ADMIN_KEY) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Unauthorized' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const adminAction = e.parameter.adminAction;

  if (adminAction === 'getData') {
    // Return current week data for the admin panel
    const data = getCurrentWeekData();
    data.all_players = getActivePlayers();
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (adminAction === 'togglePlayer') {
    return handleTogglePlayer(e);
  }

  if (adminAction === 'addSub') {
    return handleAddSub(e);
  }

  if (adminAction === 'retrigger') {
    return handleRetrigger(e);
  }

  return ContentService.createTextOutput(JSON.stringify({ error: 'Unknown admin action' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Toggles a player between playing and benched in the current week.
 */
function handleTogglePlayer(e) {
  const weekId = e.parameter.week || getCurrentWeekId();
  const playerId = e.parameter.player;

  const weekSheet = getSheet(CONFIG.SHEETS.WEEKS);
  const data = weekSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === weekId) {
      const row = i + 1;
      let playing = data[i][5] ? String(data[i][5]).split(',').filter(x => x) : [];
      let benched = data[i][6] ? String(data[i][6]).split(',').filter(x => x) : [];

      if (playing.includes(playerId)) {
        // Move to benched
        playing = playing.filter(id => id !== playerId);
        benched.push(playerId);
      } else if (benched.includes(playerId)) {
        // Move to playing
        benched = benched.filter(id => id !== playerId);
        playing.push(playerId);
      }

      // Reassign courts
      const courts = assignCourts(playing);

      weekSheet.getRange(row, 6).setValue(playing.join(','));
      weekSheet.getRange(row, 7).setValue(benched.join(','));
      weekSheet.getRange(row, 8).setValue(JSON.stringify(courts));

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        playing: playing,
        benched: benched,
        courts: courts
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ error: 'Week not found' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Adds a substitute player to the lineup for the current week.
 */
function handleAddSub(e) {
  const weekId = e.parameter.week || getCurrentWeekId();
  const subName = e.parameter.subName;
  const subPlayerId = e.parameter.subPlayerId || ('sub_' + Date.now());

  // Record as "in" response
  recordResponse(weekId, subPlayerId, 'in');

  // Add to playing list
  const weekSheet = getSheet(CONFIG.SHEETS.WEEKS);
  const data = weekSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === weekId) {
      const row = i + 1;
      let playing = data[i][5] ? String(data[i][5]).split(',').filter(x => x) : [];
      playing.push(subPlayerId);

      const courts = assignCourts(playing);

      weekSheet.getRange(row, 6).setValue(playing.join(','));
      weekSheet.getRange(row, 8).setValue(JSON.stringify(courts));

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        sub_id: subPlayerId,
        playing: playing,
        courts: courts
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ error: 'Week not found' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Re-sends the lineup email with the current (possibly modified) lineup.
 */
function handleRetrigger(e) {
  const weekId = e.parameter.week || getCurrentWeekId();
  const weekData = getWeekData(weekId);
  const friday = getNextFriday(new Date());
  const players = getActivePlayers();
  const playerMap = {};
  players.forEach(p => { playerMap[p.player_id] = p; });

  if (!weekData) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Week not found' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Build lineup object for the email function
  const lineup = {
    playing: weekData.playing_players.map(id => playerMap[id] || { player_id: id, name: id }),
    benched: weekData.benched_players.map(id => playerMap[id] || { player_id: id, name: id }),
    courts: weekData.court_assignments,
    cancelled: false
  };

  sendLineupEmail(friday, lineup);

  return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Lineup email re-sent' }))
    .setMimeType(ContentService.MimeType.JSON);
}
