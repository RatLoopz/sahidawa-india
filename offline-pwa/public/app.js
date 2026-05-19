const phoneForm = document.getElementById('phone-form');
const otpForm = document.getElementById('otp-form');
const phoneInput = document.getElementById('phone');
const otpInput = document.getElementById('otp');
const smsMessage = document.getElementById('sms-message');
const statusBadge = document.getElementById('status');
const historyForm = document.getElementById('history-form');
const nameInput = document.getElementById('medicine-name');
const batchInput = document.getElementById('batch-number');
const expiryInput = document.getElementById('expiry-date');
const notesInput = document.getElementById('notes');
const historyList = document.getElementById('history-list');
const syncButton = document.getElementById('sync-button');
const viewReportsButton = document.getElementById('view-reports-button');
const exportButton = document.getElementById('export-button');
const clearButton = document.getElementById('clear-button');

const STORAGE_KEY = 'offline-medicine-history';
const VERIFIED_KEY = 'offline-pwa-verified-phone';
const OTP_STORE = 'offline-pwa-otp-store';

function setStatus() {
  const online = navigator.onLine;
  statusBadge.textContent = online ? 'Online' : 'Offline';
  statusBadge.classList.toggle('online', online);
  statusBadge.classList.toggle('offline', !online);
}

function showMessage(message, type = 'info') {
  smsMessage.textContent = message;
  smsMessage.style.color = type === 'error' ? '#fecaca' : '#a5f3fc';
}

async function requestOtp(phone) {
  try {
    const response = await fetch('/api/verify/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error || 'Verification request failed');
    }
    if (body.status === 'mock' && body.otp) {
      localStorage.setItem(OTP_STORE, JSON.stringify({ phone, otp: body.otp }));
      showMessage(`Offline SMS mock: use code ${body.otp}`);
    } else {
      showMessage('Verification code sent by SMS.');
    }
    otpForm.classList.remove('hidden');
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function confirmOtp(phone, code) {
  try {
    const response = await fetch('/api/verify/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code })
    });
    const body = await response.json();
    if (!response.ok || !body.verified) {
      throw new Error(body.error || 'Invalid OTP');
    }
    localStorage.setItem(VERIFIED_KEY, phone);
    showMessage('Phone verified successfully. Medicine history sync is enabled.');
    otpForm.classList.add('hidden');
    phoneForm.classList.add('hidden');
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

function getHistory() {
  const history = localStorage.getItem(STORAGE_KEY);
  return history ? JSON.parse(history) : [];
}

function saveHistory(history) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const history = getHistory();
  const summary = document.getElementById('report-summary');
  if (summary) {
    summary.textContent = history.length
      ? `Saved report records: ${history.length}. Scroll down to view the latest entries.`
      : 'No saved report records yet. Add a record to create the first report.';
  }

  historyList.innerHTML = history.length
    ? history
        .map(
          (item) => `
      <article class="history-card">
        <strong>${item.name}</strong>
        <div>Batch: ${item.batch}</div>
        <div>Expiry: ${item.expiry}</div>
        <div>Notes: ${item.notes || 'None'}</div>
        <div class="record-time">Saved: ${new Date(item.createdAt).toLocaleString()}</div>
      </article>`
        )
        .join('')
    : '<p>No medicine history saved yet. Add a record to start.</p>';
}

function addHistoryRecord(record) {
  const history = getHistory();
  history.unshift(record);
  saveHistory(history);
}

phoneForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const phone = phoneInput.value.trim();
  if (phone) requestOtp(phone);
});

otpForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const phone = phoneInput.value.trim();
  const code = otpInput.value.trim();
  if (!phone || !code) {
    showMessage('Fill phone and OTP.', 'error');
    return;
  }
  confirmOtp(phone, code);
});

historyForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const record = {
    name: nameInput.value.trim(),
    batch: batchInput.value.trim(),
    expiry: expiryInput.value,
    notes: notesInput.value.trim(),
    createdAt: new Date().toISOString()
  };

  if (!record.name || !record.batch || !record.expiry) {
    showMessage('Please fill medicine name, batch, and expiry.', 'error');
    return;
  }

  addHistoryRecord(record);
  historyForm.reset();
  showMessage('Saved locally. You can sync later when online.');
});

syncButton.addEventListener('click', async () => {
  const phone = localStorage.getItem(VERIFIED_KEY);
  if (!phone) {
    showMessage('Verify your phone first before syncing.', 'error');
    return;
  }

  const history = getHistory();
  if (!history.length) {
    showMessage('No local history to sync.');
    return;
  }

  if (!navigator.onLine) {
    showMessage('You are offline. Sync will run when connection returns.', 'error');
    return;
  }

  try {
    const response = await fetch('/api/history/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, history })
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error || 'Sync failed');
    }
    showMessage(`Synced ${body.records} records successfully.`);
  } catch (error) {
    showMessage(error.message, 'error');
  }
});

clearButton.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  renderHistory();
  showMessage('Local history cleared.');
});

if (viewReportsButton) {
  viewReportsButton.addEventListener('click', () => {
    historyList.scrollIntoView({ behavior: 'smooth' });
    showMessage('Report view focused. Scroll down to see saved records.');
  });
}

function downloadReport() {
  const history = getHistory();
  if (!history.length) {
    showMessage('No records to export.', 'error');
    return;
  }

  const filename = `medicine-history-report-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify({ createdAt: new Date().toISOString(), records: history }, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showMessage(`Report exported as ${filename}.`);
}

if (exportButton) {
  exportButton.addEventListener('click', downloadReport);
}

window.addEventListener('online', setStatus);
window.addEventListener('offline', setStatus);

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/service-worker.js');
      console.log('Service worker registered');
    } catch (error) {
      console.warn('Service worker registration failed', error);
    }
  }
}

function init() {
  setStatus();
  renderHistory();
  registerServiceWorker();
}

init();
