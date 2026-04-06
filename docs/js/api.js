/**
 * API wrapper using JSONP to avoid CORS issues with Google Apps Script.
 */

let _jsonpCounter = 0;

/**
 * Makes a JSONP request to the Apps Script backend.
 * Works by injecting a <script> tag — no CORS restrictions.
 */
function jsonpRequest(params) {
  return new Promise((resolve, reject) => {
    const callbackName = '_jsonpCb_' + (++_jsonpCounter) + '_' + Date.now();
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Request timed out'));
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = function (data) {
      cleanup();
      resolve(data);
    };

    params.callback = callbackName;
    const qs = new URLSearchParams(params).toString();
    const script = document.createElement('script');
    script.src = APP_CONFIG.API_URL + '?' + qs;
    script.onerror = function () {
      cleanup();
      reject(new Error('Network error'));
    };
    document.head.appendChild(script);
  });
}

async function apiFetch(endpoint) {
  try {
    return await jsonpRequest({ action: 'api', endpoint: endpoint });
  } catch (err) {
    console.error('API error:', err);
    return { error: err.message };
  }
}

async function adminFetch(adminAction, params) {
  try {
    const allParams = Object.assign({
      action: 'admin',
      key: getAdminKey(),
      adminAction: adminAction
    }, params || {});
    return await jsonpRequest(allParams);
  } catch (err) {
    console.error('Admin API error:', err);
    return { error: err.message };
  }
}

function getAdminKey() {
  const params = new URLSearchParams(window.location.search);
  return params.get('key') || '';
}

function showLoading(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.innerHTML = '<div class="loading">Loading</div>';
}

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) el.innerHTML = '<div class="card card-red"><strong>Error</strong>' + message + '</div>';
}
