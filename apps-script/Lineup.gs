/**
 * Lineup generation algorithm.
 * Determines who plays, who's benched, and court assignments.
 */

/**
 * Generates the lineup for a given week.
 * Returns { playing: [...], benched: [...], courts: {...}, cancelled: boolean }
 */
function generateLineup(weekId) {
  const responses = getResponsesForWeek(weekId);
  const players = getActivePlayers();
  const playerMap = {};
  players.forEach(p => { playerMap[p.player_id] = p; });

  // Get players who said "in"
  const availableIds = responses
    .filter(r => r.response === 'in')
    .map(r => r.player_id);

  const available = availableIds
    .map(id => playerMap[id])
    .filter(p => p != null);

  // Cancel if fewer than 2
  if (available.length < 2) {
    return { playing: [], benched: [], courts: {}, cancelled: true };
  }

  const targetCount = getTargetCount(available.length);
  const benchCount = available.length - targetCount;

  let playing, benched;

  if (benchCount === 0) {
    playing = available;
    benched = [];
  } else {
    const result = selectBenched(available, benchCount, weekId);
    benched = result.benched;
    const benchedIds = new Set(benched.map(p => p.player_id));
    playing = available.filter(p => !benchedIds.has(p.player_id));
  }

  // Assign courts
  const courts = assignCourts(playing.map(p => p.player_id));

  return {
    playing: playing,
    benched: benched,
    courts: courts,
    cancelled: false
  };
}

/**
 * Selects which players to bench using fairness rules.
 * - Players benched last week are protected (never bench two weeks in a row)
 * - Among benchable players, those with the most plays sit first
 * - Tiebreaker: fewer benchings = more likely to sit, then seeded random
 */
function selectBenched(available, benchCount, weekId) {
  const protected_ = available.filter(p => p.benched_last_week);
  const benchable = available.filter(p => !p.benched_last_week);

  // Sort benchable: most plays first, then fewest benchings, then seeded random
  benchable.sort((a, b) => {
    if (b.total_plays !== a.total_plays) return b.total_plays - a.total_plays;
    if (a.total_benched !== b.total_benched) return a.total_benched - b.total_benched;
    return seededRandom(weekId + a.player_id) - seededRandom(weekId + b.player_id);
  });

  const benched = [];

  // Bench from the benchable pool first
  while (benched.length < benchCount && benchable.length > 0) {
    benched.push(benchable.shift());
  }

  // Edge case: need to bench more but only protected players remain
  if (benched.length < benchCount) {
    // Sort protected the same way
    protected_.sort((a, b) => {
      if (b.total_plays !== a.total_plays) return b.total_plays - a.total_plays;
      if (a.total_benched !== b.total_benched) return a.total_benched - b.total_benched;
      return seededRandom(weekId + a.player_id) - seededRandom(weekId + b.player_id);
    });

    while (benched.length < benchCount && protected_.length > 0) {
      benched.push(protected_.shift());
    }

    // Alert organizer about the edge case
    GmailApp.sendEmail(
      CONFIG.ORGANIZER_EMAIL,
      'Tennis Alert: Had to bench a protected player',
      'The lineup algorithm had to bench a player who was also benched last week ' +
      'because there were not enough non-protected players. Week: ' + weekId +
      '. Please review the lineup.'
    );
  }

  return { benched: benched };
}

/**
 * Finalizes the lineup: updates sheets, stats, and history.
 */
function finalizeLineup(weekId) {
  const friday = getNextFriday(new Date());
  const lineup = generateLineup(weekId);
  const sheet = getSheet(CONFIG.SHEETS.WEEKS);
  const data = sheet.getDataRange().getValues();
  const players = getActivePlayers();
  const responses = getResponsesForWeek(weekId);
  const respondedIds = new Set(responses.map(r => r.player_id));
  const inIds = new Set(responses.filter(r => r.response === 'in').map(r => r.player_id));

  // Find the week row
  let weekRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === weekId) {
      weekRow = i + 1;
      break;
    }
  }

  if (weekRow === -1) {
    // Create week row if it doesn't exist
    sheet.appendRow([weekId, friday, new Date(), false, '', '', '', '']);
    weekRow = sheet.getLastRow();
  }

  if (lineup.cancelled) {
    // Mark as finalized but cancelled
    sheet.getRange(weekRow, 4).setValue(true);  // lineup_finalized
    sheet.getRange(weekRow, 5).setValue(new Date()); // lineup_sent_at
    sheet.getRange(weekRow, 6).setValue(''); // playing
    sheet.getRange(weekRow, 7).setValue(''); // benched
    sheet.getRange(weekRow, 8).setValue('{}'); // courts

    // Write history for all players
    players.forEach(p => {
      if (inIds.has(p.player_id)) {
        writeHistory(weekId, friday, p.player_id, 'cancelled');
      } else if (respondedIds.has(p.player_id)) {
        writeHistory(weekId, friday, p.player_id, 'opted_out');
      } else {
        writeHistory(weekId, friday, p.player_id, 'no_response');
      }
    });

    sendCancellationEmail(friday);
    return lineup;
  }

  const playingIds = lineup.playing.map(p => p.player_id);
  const benchedIds = lineup.benched.map(p => p.player_id);
  const playingSet = new Set(playingIds);
  const benchedSet = new Set(benchedIds);

  // Update week row
  sheet.getRange(weekRow, 4).setValue(true);  // lineup_finalized
  sheet.getRange(weekRow, 5).setValue(new Date()); // lineup_sent_at
  sheet.getRange(weekRow, 6).setValue(playingIds.join(',')); // playing
  sheet.getRange(weekRow, 7).setValue(benchedIds.join(',')); // benched
  sheet.getRange(weekRow, 8).setValue(JSON.stringify(lineup.courts)); // courts

  // Update player stats and history
  players.forEach(p => {
    if (playingSet.has(p.player_id)) {
      updatePlayerStats(p.player_id, 'total_plays', p.total_plays + 1);
      updatePlayerStats(p.player_id, 'benched_last_week', false);
      writeHistory(weekId, friday, p.player_id, 'played');
    } else if (benchedSet.has(p.player_id)) {
      updatePlayerStats(p.player_id, 'total_benched', p.total_benched + 1);
      updatePlayerStats(p.player_id, 'benched_last_week', true);
      writeHistory(weekId, friday, p.player_id, 'benched');
    } else if (respondedIds.has(p.player_id)) {
      updatePlayerStats(p.player_id, 'benched_last_week', false);
      writeHistory(weekId, friday, p.player_id, 'opted_out');
    } else {
      updatePlayerStats(p.player_id, 'benched_last_week', false);
      writeHistory(weekId, friday, p.player_id, 'no_response');
    }
  });

  // Send the lineup email
  sendLineupEmail(friday, lineup);
  return lineup;
}

/**
 * Called by the Thursday noon trigger.
 */
function finalizeAndSendLineup() {
  const weekId = getCurrentWeekId();
  if (isLineupFinalized(weekId)) return; // already done
  finalizeLineup(weekId);
}
