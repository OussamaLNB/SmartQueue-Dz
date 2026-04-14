const list = document.getElementById('list');
const shop = window.location.pathname.split('/')[2];

async function load() {
  const res = await fetch(`/queue/${shop}`);
  const data = await res.json();

  list.innerHTML = '';

  data.forEach((c, i) => {
    const li = document.createElement('li');
    li.textContent = `#${i + 1} ${c.phone}`;
    list.appendChild(li);
  });
}

async function serve() {
  await fetch(`/serve-next/${shop}`, { method: 'DELETE' });
  load();
}

setInterval(load, 2000);
load();