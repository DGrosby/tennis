/**
 * Email templates and sending functions.
 */

/**
 * Sends the Monday availability email to all active players.
 */
function sendWeeklyAvailabilityEmail() {
  const friday = getNextFriday(new Date());
  const weekId = getWeekId(friday);
  const dateStr = formatDate(friday);
  const dateLong = formatDateLong(friday);
  const players = getActivePlayers();

  // Create week row if it doesn't exist
  const weekSheet = getSheet(CONFIG.SHEETS.WEEKS);
  const existing = getWeekData(weekId);
  if (!existing) {
    weekSheet.appendRow([weekId, friday, new Date(), false, '', '', '', '']);
  }

  players.forEach(player => {
    const inUrl = CONFIG.WEB_APP_URL +
      '?action=respond&player=' + encodeURIComponent(player.player_id) +
      '&week=' + encodeURIComponent(weekId) +
      '&response=in';

    const outUrl = CONFIG.WEB_APP_URL +
      '?action=respond&player=' + encodeURIComponent(player.player_id) +
      '&week=' + encodeURIComponent(weekId) +
      '&response=out';

    const subject = 'Tennis This Friday (' + dateStr + ') — Are You In?';

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #2d5016; margin-bottom: 5px;">🎾 Tennis This Friday</h2>
  <p style="font-size: 18px; margin-top: 5px;">${dateLong}</p>

  <p style="font-size: 16px;">Hey ${player.name.split(' ')[0]}, are you in this week?</p>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${inUrl}" style="display: inline-block; background-color: #22863a; color: white; text-decoration: none; padding: 15px 40px; font-size: 18px; font-weight: bold; border-radius: 8px; margin: 0 10px;">I'M IN</a>
    <a href="${outUrl}" style="display: inline-block; background-color: #cb2431; color: white; text-decoration: none; padding: 15px 40px; font-size: 18px; font-weight: bold; border-radius: 8px; margin: 0 10px;">I'M OUT</a>
  </div>

  <p style="font-size: 14px; color: #586069;">
    Your stats: <strong>${player.total_plays}</strong> times played, <strong>${player.total_benched}</strong> times benched this season.
  </p>

  <p style="font-size: 14px; color: #586069;">
    Please respond by Wednesday. Lineup will be sent Thursday at noon.
  </p>

  <hr style="border: none; border-top: 1px solid #e1e4e8; margin: 20px 0;">
  <p style="font-size: 12px; color: #959da5;">
    <a href="${CONFIG.GITHUB_PAGES_URL}/stats.html" style="color: #0366d6;">View full stats</a> ·
    <a href="${CONFIG.GITHUB_PAGES_URL}" style="color: #0366d6;">Dashboard</a>
  </p>
</body>
</html>`;

    GmailApp.sendEmail(player.email, subject,
      'Tennis this Friday (' + dateStr + '). Reply IN or OUT. Visit: ' + inUrl,
      { htmlBody: htmlBody, name: 'Tennis Coordinator' }
    );
  });
}

/**
 * Sends the lineup email to all active players.
 */
function sendLineupEmail(friday, lineup) {
  const dateStr = formatDate(friday);
  const dateLong = formatDateLong(friday);
  const players = getActivePlayers();
  const playerMap = {};
  players.forEach(p => { playerMap[p.player_id] = p; });

  const subject = 'Tennis Lineup for Friday (' + dateStr + ')';

  // Build court assignment HTML
  let courtsHtml = '';
  const courts = lineup.courts;

  if (courts.doubles_1) {
    const names = courts.doubles_1.map(id => playerMap[id] ? playerMap[id].name : id).join(', ');
    courtsHtml += `
    <div style="background: #f0f8f0; border-left: 4px solid #22863a; padding: 12px 16px; margin: 10px 0; border-radius: 4px;">
      <strong>Court 1 — Doubles</strong><br>${names}
    </div>`;
  }

  if (courts.doubles_2) {
    const names = courts.doubles_2.map(id => playerMap[id] ? playerMap[id].name : id).join(', ');
    courtsHtml += `
    <div style="background: #f0f8f0; border-left: 4px solid #22863a; padding: 12px 16px; margin: 10px 0; border-radius: 4px;">
      <strong>Court 2 — Doubles</strong><br>${names}
    </div>`;
  }

  if (courts.singles_1) {
    const names = courts.singles_1.map(id => playerMap[id] ? playerMap[id].name : id).join(', ');
    courtsHtml += `
    <div style="background: #f0f8f0; border-left: 4px solid #2188ff; padding: 12px 16px; margin: 10px 0; border-radius: 4px;">
      <strong>${courts.doubles_1 ? 'Court 2' : 'Court 1'} — Singles</strong><br>${names}
    </div>`;
  }

  // Benched players section
  let benchedHtml = '';
  if (lineup.benched.length > 0) {
    const benchedNames = lineup.benched.map(p => p.name).join(', ');
    benchedHtml = `
    <div style="background: #fff8e1; border-left: 4px solid #f9a825; padding: 12px 16px; margin: 10px 0; border-radius: 4px;">
      <strong>Benched this week:</strong> ${benchedNames}
    </div>
    <p style="font-size: 13px; color: #586069;">Benched players will have priority next week.</p>`;
  }

  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #2d5016; margin-bottom: 5px;">🎾 Tennis Lineup</h2>
  <p style="font-size: 18px; margin-top: 5px;">${dateLong}</p>

  <p style="font-size: 16px;"><strong>${lineup.playing.length} players</strong> on the courts this week:</p>

  ${courtsHtml}
  ${benchedHtml}

  <hr style="border: none; border-top: 1px solid #e1e4e8; margin: 20px 0;">
  <p style="font-size: 12px; color: #959da5;">
    <a href="${CONFIG.GITHUB_PAGES_URL}/stats.html" style="color: #0366d6;">View full stats</a> ·
    <a href="${CONFIG.GITHUB_PAGES_URL}" style="color: #0366d6;">Dashboard</a>
  </p>
</body>
</html>`;

  players.forEach(player => {
    GmailApp.sendEmail(player.email, subject,
      'Tennis lineup for Friday (' + dateStr + '). View: ' + CONFIG.GITHUB_PAGES_URL,
      { htmlBody: htmlBody, name: 'Tennis Coordinator' }
    );
  });
}

/**
 * Sends a cancellation email when fewer than 2 players are available.
 */
function sendCancellationEmail(friday) {
  const dateStr = formatDate(friday);
  const dateLong = formatDateLong(friday);
  const players = getActivePlayers();

  const subject = 'Tennis Cancelled This Friday (' + dateStr + ')';

  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #cb2431; margin-bottom: 5px;">🎾 Tennis Cancelled</h2>
  <p style="font-size: 18px; margin-top: 5px;">${dateLong}</p>
  <p>Not enough players responded this week. Tennis is cancelled for Friday.</p>
  <p style="font-size: 14px; color: #586069;">See you next week!</p>
</body>
</html>`;

  players.forEach(player => {
    GmailApp.sendEmail(player.email, subject,
      'Tennis cancelled for Friday (' + dateStr + '). Not enough players.',
      { htmlBody: htmlBody, name: 'Tennis Coordinator' }
    );
  });
}

/**
 * Sends a reminder email to players who haven't responded yet.
 */
function sendReminderEmail() {
  const weekId = getCurrentWeekId();
  if (isLineupFinalized(weekId)) return;

  const friday = getNextFriday(new Date());
  const dateStr = formatDate(friday);
  const players = getActivePlayers();
  const responses = getResponsesForWeek(weekId);
  const respondedIds = new Set(responses.map(r => r.player_id));

  const nonResponders = players.filter(p => !respondedIds.has(p.player_id));

  nonResponders.forEach(player => {
    const inUrl = CONFIG.WEB_APP_URL +
      '?action=respond&player=' + encodeURIComponent(player.player_id) +
      '&week=' + encodeURIComponent(weekId) +
      '&response=in';

    const outUrl = CONFIG.WEB_APP_URL +
      '?action=respond&player=' + encodeURIComponent(player.player_id) +
      '&week=' + encodeURIComponent(weekId) +
      '&response=out';

    const subject = 'Reminder: Tennis This Friday (' + dateStr + ') — Please Respond';

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #e36209; margin-bottom: 5px;">🎾 Reminder: Tennis This Friday</h2>
  <p style="font-size: 16px;">Hey ${player.name.split(' ')[0]}, we haven't heard from you yet. Are you in?</p>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${inUrl}" style="display: inline-block; background-color: #22863a; color: white; text-decoration: none; padding: 15px 40px; font-size: 18px; font-weight: bold; border-radius: 8px; margin: 0 10px;">I'M IN</a>
    <a href="${outUrl}" style="display: inline-block; background-color: #cb2431; color: white; text-decoration: none; padding: 15px 40px; font-size: 18px; font-weight: bold; border-radius: 8px; margin: 0 10px;">I'M OUT</a>
  </div>

  <p style="font-size: 14px; color: #586069;">Lineup will be finalized Thursday at noon.</p>
</body>
</html>`;

    GmailApp.sendEmail(player.email, subject,
      'Reminder: Tennis this Friday (' + dateStr + '). Please respond: ' + inUrl,
      { htmlBody: htmlBody, name: 'Tennis Coordinator' }
    );
  });
}
