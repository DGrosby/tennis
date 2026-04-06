/**
 * Confirmation page — shown after a player clicks In/Out from email.
 */

(function () {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status');
  const name = decodeURIComponent(params.get('name') || 'Player');
  const content = document.getElementById('content');

  let html = '';

  if (status === 'in') {
    html = `
      <div class="icon">&#127934;</div>
      <h1 class="text-green">You're In!</h1>
      <p>Thanks, ${name}! You're marked as <strong>available</strong> for this Friday.</p>
      <p class="text-gray">The lineup will be sent Thursday at noon.</p>
      <p class="mt-4"><a href="index.html" class="btn btn-green">View Dashboard</a></p>
    `;
  } else if (status === 'out') {
    html = `
      <div class="icon">&#128075;</div>
      <h1>You're Out</h1>
      <p>Thanks, ${name}! You're marked as <strong>unavailable</strong> this Friday.</p>
      <p class="text-gray">See you next week!</p>
      <p class="mt-4"><a href="index.html" class="btn btn-gray">View Dashboard</a></p>
    `;
  } else if (status === 'late') {
    html = `
      <div class="icon">&#9200;</div>
      <h1>Response Recorded</h1>
      <p>Thanks, ${name}! Your response has been recorded, but the lineup was already finalized.</p>
      <p class="text-gray">The organizer can make adjustments if needed.</p>
      <p class="mt-4"><a href="index.html" class="btn btn-gray">View Dashboard</a></p>
    `;
  } else {
    html = `
      <div class="icon">&#10067;</div>
      <h1>Something went wrong</h1>
      <p>We couldn't process your response. Please try clicking the button in your email again.</p>
      <p class="mt-4"><a href="index.html" class="btn btn-gray">View Dashboard</a></p>
    `;
  }

  content.innerHTML = html;
})();
