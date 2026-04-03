const queueList = document.getElementById('queueList');
const serveBtn = document.getElementById('serveBtn');

async function loadQueue() {
  const res = await fetch('/queue');
  const data = await res.json();

  queueList.innerHTML = '';

  if (data.length === 0) {
    queueList.innerHTML = "<p>No customers in queue</p>";
    return;
  }

  data.forEach((item, index) => {
    const li = document.createElement('li');
    li.textContent = `#${index + 1} — ${item.phone}`;
    queueList.appendChild(li);
  });
}

serveBtn.addEventListener('click', async () => {
  await fetch('/serve-next', { method: 'DELETE' });
  loadQueue();
});

setInterval(loadQueue, 3000);
loadQueue();
const clearBtn = document.getElementById('clearBtn');

clearBtn.addEventListener('click', async () => {
  const confirmClear = confirm("Are you sure you want to clear the queue?");
  if (!confirmClear) return;

  await fetch('/clear-queue', { method: 'DELETE' });
  loadQueue();
});