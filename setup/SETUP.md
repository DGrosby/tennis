# Tennis Weekly Coordinator — Setup Guide

Follow these steps to deploy the Tennis Weekly Coordinator. Total time: ~30 minutes.

---

## Step 1: Create the Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new spreadsheet
2. Name it **"Tennis Weekly Coordinator"**
3. Create 4 sheet tabs (rename the default "Sheet1" and add 3 more):

### Tab: `Players`
Add these headers in row 1:

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| player_id | name | email | active | total_plays | total_benched | benched_last_week | joined_date |

Then add your players starting in row 2. Example:
```
p01 | John Smith    | john@email.com    | TRUE | 0 | 0 | FALSE | 2026-04-01
p02 | Jane Doe      | jane@email.com    | TRUE | 0 | 0 | FALSE | 2026-04-01
p03 | Bob Wilson     | bob@email.com     | TRUE | 0 | 0 | FALSE | 2026-04-01
...
```

Use short IDs like `p01` through `p16`. Set `active` to `TRUE` for all current players.

### Tab: `Weeks`
Add these headers in row 1:

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| week_id | friday_date | email_sent_at | lineup_finalized | lineup_sent_at | playing_players | benched_players | court_assignments |

Leave the data rows empty — they'll be populated automatically.

### Tab: `Responses`
Add these headers in row 1:

| A | B | C | D |
|---|---|---|---|
| week_id | player_id | response | responded_at |

### Tab: `History`
Add these headers in row 1:

| A | B | C | D |
|---|---|---|---|
| week_id | friday_date | player_id | status |

4. **Copy the Spreadsheet ID** from the URL. It's the long string between `/d/` and `/edit`:
   ```
   https://docs.google.com/spreadsheets/d/THIS_PART_IS_YOUR_ID/edit
   ```

---

## Step 2: Set Up Google Apps Script

1. Go to [Google Apps Script](https://script.google.com) and click **New Project**
2. Name the project **"Tennis Coordinator"**
3. Delete the default `Code.gs` file content
4. Create the following files (use File → New → Script):

   Copy the contents from the `apps-script/` folder in this repository:
   - `Config.gs`
   - `Utilities.gs`
   - `Lineup.gs`
   - `WebApp.gs`
   - `Email.gs`
   - `Triggers.gs`

5. **Update `Config.gs`** with your values:
   - `SPREADSHEET_ID`: Paste the ID from Step 1
   - `ORGANIZER_EMAIL`: Your email address
   - `ADMIN_KEY`: Generate a random string (e.g., go to https://www.random.org/strings/ and generate a 20-character string)
   - Leave `WEB_APP_URL` and `GITHUB_PAGES_URL` blank for now — you'll fill them in later

6. Also update the `appsscript.json` manifest:
   - In the Apps Script editor, click the gear icon (Project Settings)
   - Check "Show 'appsscript.json' manifest file in editor"
   - Replace the contents with the `appsscript.json` from this repo
   - **Update the timezone** if you're not in Eastern time

7. **Deploy the web app**:
   - Click **Deploy → New deployment**
   - Click the gear icon next to "Select type" and choose **Web app**
   - Set "Execute as" to **Me**
   - Set "Who has access" to **Anyone**
   - Click **Deploy**
   - **Authorize** when prompted (you'll need to click through "Advanced" → "Go to Tennis Coordinator (unsafe)" since it's not verified)
   - **Copy the Web App URL** — it will look like `https://script.google.com/macros/s/LONG_STRING/exec`

8. **Update `Config.gs`** again:
   - Set `WEB_APP_URL` to the URL you just copied

9. **Set up triggers**:
   - In the Apps Script editor, select the `Triggers.gs` file
   - Run the `setupTriggers` function (click the play button ▶)
   - Authorize when prompted
   - Verify triggers were created: go to **Triggers** in the left sidebar (clock icon)

---

## Step 3: Set Up GitHub Pages

1. Create a **new repository** on GitHub:
   - Go to https://github.com/new
   - Name it `tennis` (or whatever you prefer)
   - Set it to **Public** (required for free GitHub Pages)
   - Don't initialize with README (we already have files)

2. **Push the code** from your local repo:
   ```bash
   cd /Users/dgrosby/Documents/Tennis
   git remote add origin https://github.com/YOUR_USERNAME/tennis.git
   git add .
   git commit -m "Initial commit: Tennis Weekly Coordinator"
   git push -u origin main
   ```

3. **Enable GitHub Pages**:
   - Go to your repo on GitHub → **Settings** → **Pages**
   - Under "Source", select **Deploy from a branch**
   - Set the branch to `main` and folder to `/docs`
   - Click **Save**
   - Your site will be live at `https://YOUR_USERNAME.github.io/tennis/` in a few minutes

4. **Update configuration with the GitHub Pages URL**:

   In `docs/js/config.js`, update:
   ```javascript
   API_URL: 'https://script.google.com/macros/s/YOUR_LONG_STRING/exec'
   ```

   In `apps-script/Config.gs` (in the Apps Script editor), update:
   ```javascript
   GITHUB_PAGES_URL: 'https://YOUR_USERNAME.github.io/tennis'
   ```

5. **Re-deploy the Apps Script** after updating the URL:
   - In Apps Script editor: Deploy → Manage deployments → Edit (pencil icon)
   - Set version to "New version"
   - Click **Deploy**

6. **Push the config change**:
   ```bash
   git add docs/js/config.js
   git commit -m "Update API URL in frontend config"
   git push
   ```

---

## Step 4: Test Everything

### Test 1: Email delivery
In the Apps Script editor, run `sendWeeklyAvailabilityEmail` manually. Check that:
- All players receive the email
- The "I'm In" and "I'm Out" buttons appear and are tappable on mobile
- Clicking a button redirects to the confirmation page on your GitHub Pages site

### Test 2: Response recording
After clicking "I'm In" from the email:
- Check the `Responses` tab in Google Sheets — your response should be there
- Visit the dashboard page — your response should show up

### Test 3: Lineup generation
In Google Sheets, manually add some test responses to the `Responses` tab, then run `finalizeAndSendLineup` in Apps Script. Check:
- The `Weeks` tab has the lineup data
- The `History` tab has entries for each player
- The lineup email arrives with correct court assignments

### Test 4: Admin page
Visit `https://YOUR_USERNAME.github.io/tennis/admin.html?key=YOUR_ADMIN_KEY`
- Verify you can see the current lineup
- Test toggling a player between playing/benched
- Test the "Re-send Lineup Email" button

### Test 5: Stats and History pages
Visit the stats and history pages on GitHub Pages and verify data displays correctly.

---

## Ongoing Maintenance

### Adding a new player
Add a new row to the `Players` sheet with:
- A unique `player_id` (e.g., `p17`)
- Their name, email, `active=TRUE`, zeroes for plays/benched, `FALSE` for benched_last_week

### Removing a player
Set their `active` column to `FALSE` in the `Players` sheet. Don't delete the row (their history is preserved).

### Adjusting the lineup after Thursday
1. Go to the admin page
2. Toggle players as needed
3. Click "Re-send Lineup Email"

### If emails stop sending
1. Check the Apps Script dashboard: https://script.google.com → Your project → Executions
2. Look for errors in the execution log
3. You may need to re-authorize if Google revokes permissions

### Updating the code
Edit files locally, commit, and push. GitHub Pages updates automatically within minutes.
For Apps Script changes, copy the updated code to the Apps Script editor and create a new deployment version.

---

## Your Admin Page URL

Bookmark this (keep it secret!):
```
https://YOUR_USERNAME.github.io/tennis/admin.html?key=YOUR_ADMIN_KEY
```
