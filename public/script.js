const phoneInput = document.getElementById('phone');
const result = document.getElementById('result');

phoneInput.addEventListener('input', () => {
  phoneInput.value = phoneInput.value.replace(/\D/g, '');
});

async function joinQueue() {
  const phone = phoneInput.value;
  const shop = window.location.pathname.split('/')[2];

  const res = await fetch('/join-queue', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ phone, shop })
  });

  const data = await res.json();
  result.textContent = data.error || data.message;
}