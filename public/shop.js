const shop = location.pathname.split('/')[2];
document.getElementById('title').textContent = shop;

const phoneInput = document.getElementById('phone');

phoneInput.addEventListener('input', () => {
  phoneInput.value = phoneInput.value.replace(/\D/g, '');
});

async function join() {
  const phone = phoneInput.value;

  const res = await fetch('/join-queue', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ phone, shop })
  });

  const data = await res.json();
  document.getElementById('res').textContent = data.message || data.error;
}