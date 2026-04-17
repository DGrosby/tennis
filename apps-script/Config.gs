/**
 * Configuration constants for the Tennis Weekly Coordinator.
 * Update these values after setting up your Google Sheet and deploying the web app.
 */

const CONFIG = {
  // Google Sheet ID — found in the Sheet URL between /d/ and /edit
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',

  // Deployed Apps Script web app URL — set after first deployment
  WEB_APP_URL: 'YOUR_WEB_APP_URL_HERE',

  // GitHub Pages base URL — set after enabling Pages
  GITHUB_PAGES_URL: 'https://YOUR_USERNAME.github.io/tennis',

  // Secret key for admin actions — change this to something unguessable
  ADMIN_KEY: 'CHANGE_THIS_TO_A_RANDOM_STRING',

  // Sheet tab names
  SHEETS: {
    PLAYERS: 'Players',
    WEEKS: 'Weeks',
    RESPONSES: 'Responses',
    HISTORY: 'History'
  },

  // Max players per week (2 doubles courts)
  MAX_PLAYERS: 8,

  // Valid playing counts (must fill courts evenly)
  VALID_COUNTS: [4, 6, 8],

  // Organizer email — receives alerts for edge cases
  ORGANIZER_EMAIL: 'YOUR_EMAIL_HERE',

  // Email schedule
  AVAILABILITY_EMAIL_DAY: ScriptApp.WeekDay.MONDAY,
  AVAILABILITY_EMAIL_HOUR: 7,
  LINEUP_EMAIL_DAY: ScriptApp.WeekDay.THURSDAY,
  LINEUP_EMAIL_HOUR: 12,
  REMINDER_EMAIL_DAY: ScriptApp.WeekDay.WEDNESDAY,
  REMINDER_EMAIL_HOUR: 9
};
