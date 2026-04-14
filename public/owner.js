const shop = location.pathname.split('/')[2];
document.getElementById('title').textContent = shop;

async function load() {
  const res = await fetch(`/queue/${shop}`);
  const data = await res.json();

  const list = document.getElementById('list');
  list.innerHTML = '';

  data.forEach((u,i)=>{
    const li = document.createElement('li');
    li.textContent = `#${i+1} ${u.phone}`;
    list.appendChild(li);
  });
}

async function serve() {
  await fetch(`/serve-next/${shop}`, { method:'DELETE' });
  load();
}

setInterval(load,2000);
load();