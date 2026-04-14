const queueList = document.getElementById('queueList');

const pathParts = window.location.pathname.split('/');
const shopId = pathParts[2];

document.getElementById('shopName').textContent = shopId;

// LOAD QUEUE
async function loadQueue() {
  const res = await fetch(`/queue/${shopId}`);
  const data = await res.json();

  queueList.innerHTML = '';

  data.forEach((item, index) => {
    const li = document.createElement('li');
    li.textContent = `#${index + 1} — ${item.phone}`;
    queueList.appendChild(li);
  });
}

// NOW SERVING
async function loadCurrent() {
  const res = await fetch(`/current/${shopId}`);
  const data = await res.json();

  const el = document.getElementById('currentServing');

  if (data.message) {
    el.textContent = "Now Serving: None";
  } else {
    el.textContent = "Now Serving: " + data.phone;
  }
}

// BUTTONS
document.getElementById('serveBtn').addEventListener('click', async () => {
  await fetch(`/serve-next/${shopId}`, { method: 'DELETE' });
  loadQueue();
});

document.getElementById('clearBtn').addEventListener('click', async () => {
  await fetch(`/clear-queue/${shopId}`, { method: 'DELETE' });
  loadQueue();
});

// AUTO REFRESH
setInterval(() => {
  loadQueue();
  loadCurrent();
}, 3000);

loadQueue();
loadCurrent();