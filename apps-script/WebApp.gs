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
 * Supports JSONP (via callback parameter) to avoid CORS issues.
 */
function handleApi(e) {
  const endpoint = e.parameter.endpoint;
  const callback = e.parameter.callback;
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

  const json = JSON.stringify(data);

  // JSONP: wrap in callback function to avoid CORS
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
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

  // Use all player names (including subs) for display
  const allNames = getAllPlayerNames();

  const responseList = responses.map(r => ({
    player_id: r.player_id,
    name: allNames[r.player_id] || r.player_id,
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
    player_names: allNames
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

  return {
    weeks: Object.values(weeks).sort((a, b) => b.week_id.localeCompare(a.week_id)),
    player_names: getAllPlayerNames()
  };
}

/**
 * Returns a JSONP or JSON response.
 */
function jsonpResponse(data, callback) {
  const json = JSON.stringify(data);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handles admin actions (lineup adjustments, retrigger email).
 */
function handleAdmin(e) {
  const key = e.parameter.key;
  const callback = e.parameter.callback;
  if (key !== CONFIG.ADMIN_KEY) {
    return jsonpResponse({ error: 'Unauthorized' }, callback);
  }

  const adminAction = e.parameter.adminAction;

  if (adminAction === 'getData') {
    const data = getCurrentWeekData();
    data.all_players = getActivePlayers();
    return jsonpResponse(data, callback);
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

  return jsonpResponse({ error: 'Unknown admin action' }, callback);
}

/**
 * Toggles a player between playing and benched in the current week.
 */
function handleTogglePlayer(e) {
  const weekId = e.parameter.week || getCurrentWeekId();
  const playerId = e.parameter.player;
  const callback = e.parameter.callback;

  const weekSheet = getSheet(CONFIG.SHEETS.WEEKS);
  const data = weekSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === weekId) {
      const row = i + 1;
      let playing = data[i][5] ? String(data[i][5]).split(',').filter(x => x) : [];
      let benched = data[i][6] ? String(data[i][6]).split(',').filter(x => x) : [];

      if (playing.includes(playerId)) {
        playing = playing.filter(id => id !== playerId);
        benched.push(playerId);
      } else if (benched.includes(playerId)) {
        benched = benched.filter(id => id !== playerId);
        playing.push(playerId);
      }

      const courts = assignCourts(playing);

      weekSheet.getRange(row, 6).setValue(playing.join(','));
      weekSheet.getRange(row, 7).setValue(benched.join(','));
      weekSheet.getRange(row, 8).setValue(JSON.stringify(courts));

      return jsonpResponse({ success: true, playing: playing, benched: benched, courts: courts }, callback);
    }
  }

  return jsonpResponse({ error: 'Week not found' }, callback);
}

/**
 * Adds a substitute player to the lineup for the current week.
 */
function handleAddSub(e) {
  const weekId = e.parameter.week || getCurrentWeekId();
  const subName = e.parameter.subName;
  const subPlayerId = e.parameter.subPlayerId || ('sub_' + Date.now());
  const callback = e.parameter.callback;

  // Add substitute to Players sheet (inactive so they don't get weekly emails)
  const playersSheet = getSheet(CONFIG.SHEETS.PLAYERS);
  playersSheet.appendRow([subPlayerId, subName, '', false, 0, 0, false, new Date()]);

  recordResponse(weekId, subPlayerId, 'in');

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

      return jsonpResponse({ success: true, sub_id: subPlayerId, playing: playing, courts: courts }, callback);
    }
  }

  return jsonpResponse({ error: 'Week not found' }, callback);
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
  const callback = e.parameter.callback;
  players.forEach(p => { playerMap[p.player_id] = p; });

  if (!weekData) {
    return jsonpResponse({ error: 'Week not found' }, callback);
  }

  const lineup = {
    playing: weekData.playing_players.map(id => playerMap[id] || { player_id: id, name: id }),
    benched: weekData.benched_players.map(id => playerMap[id] || { player_id: id, name: id }),
    courts: weekData.court_assignments,
    cancelled: false
  };

  sendLineupEmail(friday, lineup);

  return jsonpResponse({ success: true, message: 'Lineup email re-sent' }, callback);
}
