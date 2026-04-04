const queueList = document.getElementById('queueList');

// LOAD QUEUE
async function loadQueue() {
  const res = await fetch('/queue');
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
  const res = await fetch('/current');
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
  await fetch('/serve-next', { method: 'DELETE' });
  loadQueue();
});

document.getElementById('clearBtn').addEventListener('click', async () => {
  await fetch('/clear-queue', { method: 'DELETE' });
  loadQueue();
});

// AUTO REFRESH
setInterval(() => {
  loadQueue();
  loadCurrent();
}, 3000);

loadQueue();
loadCurrent();