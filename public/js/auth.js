function showAlert(type, message) {
  const errEl = document.getElementById('error-msg');
  const sucEl = document.getElementById('success-msg');
  errEl.classList.add('hidden');
  sucEl.classList.add('hidden');

  const el = type === 'error' ? errEl : sucEl;
  el.textContent = (type === 'error' ? '⚠ ' : '✓ ') + message;
  el.classList.remove('hidden');

  if (type === 'success') {
    setTimeout(() => el.classList.add('hidden'), 5000);
  }
}

async function handleAuth(url, data, btnId) {
  const btn = document.getElementById(btnId);
  const btnText = btn.querySelector('.btn-text');
  const btnLoader = btn.querySelector('.btn-loader');

  btn.disabled = true;
  btnText.classList.add('hidden');
  btnLoader.classList.remove('hidden');

  // Clear previous alerts
  document.getElementById('error-msg').classList.add('hidden');
  document.getElementById('success-msg').classList.add('hidden');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (result.error) {
      showAlert('error', result.error);
    } else if (result.success) {
      showAlert('success', result.message || 'Success!');
      setTimeout(() => window.location.href = result.redirect || '/dashboard', 800);
    }
  } catch (err) {
    showAlert('error', 'Connection error. Please try again.');
  } finally {
    btn.disabled = false;
    btnText.classList.remove('hidden');
    btnLoader.classList.add('hidden');
  }
}
