/**
 * Trigger setup — run setupTriggers() once manually to install all time-based triggers.
 */

/**
 * Sets up all weekly triggers. Run this function once from the Apps Script editor.
 * It will remove existing triggers first to avoid duplicates.
 */
function setupTriggers() {
  // Remove all existing triggers for this project
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));

  // Monday at 7am — send availability email
  ScriptApp.newTrigger('sendWeeklyAvailabilityEmail')
    .timeBased()
    .onWeekDay(CONFIG.AVAILABILITY_EMAIL_DAY)
    .atHour(CONFIG.AVAILABILITY_EMAIL_HOUR)
    .create();

  // Wednesday at 9am — send reminder to non-respondents
  ScriptApp.newTrigger('sendReminderEmail')
    .timeBased()
    .onWeekDay(CONFIG.REMINDER_EMAIL_DAY)
    .atHour(CONFIG.REMINDER_EMAIL_HOUR)
    .create();

  // Thursday at noon — finalize lineup and send email
  ScriptApp.newTrigger('finalizeAndSendLineup')
    .timeBased()
    .onWeekDay(CONFIG.LINEUP_EMAIL_DAY)
    .atHour(CONFIG.LINEUP_EMAIL_HOUR)
    .create();

  Logger.log('All triggers set up successfully.');
  Logger.log('- Monday ' + CONFIG.AVAILABILITY_EMAIL_HOUR + ':00 — Availability email');
  Logger.log('- Wednesday ' + CONFIG.REMINDER_EMAIL_HOUR + ':00 — Reminder email');
  Logger.log('- Thursday ' + CONFIG.LINEUP_EMAIL_HOUR + ':00 — Lineup finalization');
}

/**
 * Lists all current triggers (for debugging).
 */
function listTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    Logger.log(trigger.getHandlerFunction() + ' — ' + trigger.getTriggerSource());
  });
}
