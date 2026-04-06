/**
 * Utility functions for sheet access, date math, and court assignment.
 */

function getSpreadsheet() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getSheet(name) {
  return getSpreadsheet().getSheetByName(name);
}

/**
 * Returns the ISO week ID for a given date, e.g. "2026-W14".
 */
function getWeekId(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return d.getFullYear() + '-W' + String(weekNum).padStart(2, '0');
}

/**
 * Returns the next Friday from the given date.
 */
function getNextFriday(fromDate) {
  const d = new Date(fromDate);
  const day = d.getDay();
  const daysUntilFriday = (5 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + daysUntilFriday);
  return d;
}

/**
 * Returns current week ID based on the upcoming Friday.
 */
function getCurrentWeekId() {
  return getWeekId(getNextFriday(new Date()));
}

/**
 * Formats a date as "Apr 10" style.
 */
function formatDate(date) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[date.getMonth()] + ' ' + date.getDate();
}

/**
 * Formats a date as "Friday, April 10".
 */
function formatDateLong(date) {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return days[date.getDay()] + ', ' + months[date.getMonth()] + ' ' + date.getDate();
}

/**
 * Gets all active players from the Players sheet.
 * Returns array of {player_id, name, email, total_plays, total_benched, benched_last_week}.
 */
function getActivePlayers() {
  const sheet = getSheet(CONFIG.SHEETS.PLAYERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const players = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[3] === true || row[3] === 'TRUE') { // active column
      players.push({
        player_id: row[0],
        name: row[1],
        email: row[2],
        active: true,
        total_plays: row[4] || 0,
        total_benched: row[5] || 0,
        benched_last_week: row[6] === true || row[6] === 'TRUE'
      });
    }
  }
  return players;
}

/**
 * Gets a single player by ID.
 */
function getPlayerById(playerId) {
  const players = getActivePlayers();
  return players.find(p => p.player_id === playerId) || null;
}

/**
 * Gets all responses for a given week.
 * Returns array of {player_id, response, responded_at}.
 */
function getResponsesForWeek(weekId) {
  const sheet = getSheet(CONFIG.SHEETS.RESPONSES);
  const data = sheet.getDataRange().getValues();
  const responses = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === weekId) {
      responses.push({
        player_id: data[i][1],
        response: data[i][2],
        responded_at: data[i][3]
      });
    }
  }
  return responses;
}

/**
 * Records or updates a player's response for a week (upsert).
 */
function recordResponse(weekId, playerId, response) {
  const sheet = getSheet(CONFIG.SHEETS.RESPONSES);
  const data = sheet.getDataRange().getValues();

  // Look for existing response to update
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === weekId && data[i][1] === playerId) {
      sheet.getRange(i + 1, 3).setValue(response);
      sheet.getRange(i + 1, 4).setValue(new Date());
      return;
    }
  }

  // New response
  sheet.appendRow([weekId, playerId, response, new Date()]);
}

/**
 * Checks if the lineup for a week has been finalized.
 */
function isLineupFinalized(weekId) {
  const sheet = getSheet(CONFIG.SHEETS.WEEKS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === weekId) {
      return data[i][3] === true || data[i][3] === 'TRUE';
    }
  }
  return false;
}

/**
 * Gets the week row data for a given week ID.
 */
function getWeekData(weekId) {
  const sheet = getSheet(CONFIG.SHEETS.WEEKS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === weekId) {
      return {
        week_id: data[i][0],
        friday_date: data[i][1],
        email_sent_at: data[i][2],
        lineup_finalized: data[i][3] === true || data[i][3] === 'TRUE',
        lineup_sent_at: data[i][4],
        playing_players: data[i][5] ? String(data[i][5]).split(',') : [],
        benched_players: data[i][6] ? String(data[i][6]).split(',') : [],
        court_assignments: data[i][7] ? JSON.parse(data[i][7]) : {}
      };
    }
  }
  return null;
}

/**
 * Determines the target player count (nearest valid count ≤ available).
 */
function getTargetCount(availableCount) {
  const valid = CONFIG.VALID_COUNTS;
  for (let i = valid.length - 1; i >= 0; i--) {
    if (valid[i] <= availableCount) return valid[i];
  }
  return 0; // fewer than 2
}

/**
 * Assigns players to courts based on the playing count.
 * Returns object like {"doubles_1": [...], "singles_1": [...], "doubles_2": [...]}.
 */
function assignCourts(playingPlayers) {
  const count = playingPlayers.length;
  // Shuffle for random court assignment
  const shuffled = [...playingPlayers].sort(() => Math.random() - 0.5);
  const assignments = {};

  if (count === 2) {
    assignments.singles_1 = [shuffled[0], shuffled[1]];
  } else if (count === 4) {
    assignments.doubles_1 = shuffled.slice(0, 4);
  } else if (count === 6) {
    assignments.doubles_1 = shuffled.slice(0, 4);
    assignments.singles_1 = shuffled.slice(4, 6);
  } else if (count === 8) {
    assignments.doubles_1 = shuffled.slice(0, 4);
    assignments.doubles_2 = shuffled.slice(4, 8);
  }

  return assignments;
}

/**
 * Simple seeded random for deterministic tiebreaking.
 */
function seededRandom(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) / 2147483647;
}

/**
 * Updates a player's stats in the Players sheet.
 */
function updatePlayerStats(playerId, field, value) {
  const sheet = getSheet(CONFIG.SHEETS.PLAYERS);
  const data = sheet.getDataRange().getValues();
  const colMap = {
    total_plays: 5,   // column E
    total_benched: 6,  // column F
    benched_last_week: 7 // column G
  };

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === playerId) {
      sheet.getRange(i + 1, colMap[field]).setValue(value);
      return;
    }
  }
}

/**
 * Writes a history entry.
 */
function writeHistory(weekId, fridayDate, playerId, status) {
  const sheet = getSheet(CONFIG.SHEETS.HISTORY);
  sheet.appendRow([weekId, fridayDate, playerId, status]);
}
