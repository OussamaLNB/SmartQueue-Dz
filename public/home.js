const list = document.getElementById('list');
const search = document.getElementById('search');
const empty = document.getElementById('empty');

let shops = [];

async function load() {
  const res = await fetch('/shops');
  shops = await res.json();
  render(shops);
}

function render(data) {
  list.innerHTML = '';

  if (data.length === 0) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  data.forEach(s => {
    const li = document.createElement('li');
    li.textContent = s.name;
    li.onclick = () => location.href = `/shop/${s.name}`;
    list.appendChild(li);
  });
}

search.oninput = () => {
  const v = search.value.toLowerCase();
  render(shops.filter(s => s.name.includes(v)));
};

load();