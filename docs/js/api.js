/**
 * API wrapper for fetching data from the Google Apps Script backend.
 */

async function apiFetch(endpoint, extraParams) {
  const params = new URLSearchParams({ action: 'api', endpoint: endpoint });
  if (extraParams) {
    Object.entries(extraParams).forEach(([k, v]) => params.set(k, v));
  }

  const url = APP_CONFIG.API_URL + '?' + params.toString();

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return await response.json();
  } catch (err) {
    console.error('API error:', err);
    return { error: err.message };
  }
}

async function adminFetch(adminAction, params) {
  const urlParams = new URLSearchParams({
    action: 'admin',
    key: getAdminKey(),
    adminAction: adminAction
  });
  if (params) {
    Object.entries(params).forEach(([k, v]) => urlParams.set(k, v));
  }

  const url = APP_CONFIG.API_URL + '?' + urlParams.toString();

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return await response.json();
  } catch (err) {
    console.error('Admin API error:', err);
    return { error: err.message };
  }
}

function getAdminKey() {
  const params = new URLSearchParams(window.location.search);
  return params.get('key') || '';
}

/**
 * Shows a loading spinner in the target element.
 */
function showLoading(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.innerHTML = '<div class="loading">Loading</div>';
}

/**
 * Shows an error message in the target element.
 */
function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) el.innerHTML = '<div class="card card-red"><strong>Error</strong>' + message + '</div>';
}
