const phoneInput = document.getElementById('phone');
const result = document.getElementById('response');

// 🔥 BLOCK letters + limit 10 digits
phoneInput.addEventListener('input', () => {
  phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 10);
});

// GET SHOP ID
const pathParts = window.location.pathname.split('/');
const shopId = pathParts[2];

document.getElementById('shopName').textContent = shopId;

// JOIN
async function joinQueue() {
  if (!shopId) {
    result.textContent = "Invalid shop link";
    result.style.color = "red";
    return;
  }

  const phone = phoneInput.value.trim();

  if (!/^0[567]\d{8}$/.test(phone)) {
    result.textContent = "Invalid number";
    result.style.color = "red";
    return;
  }

  const res = await fetch('/join-queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, shop_id: shopId })
  });

  const data = await res.json();

  result.textContent = data.error || data.message;
  result.style.color = data.error ? "red" : "lightgreen";
}

// NOW SERVING
async function loadCurrent() {
  const res = await fetch(`/current/${shopId}`);
  const data = await res.json();

  const el = document.getElementById('currentServing');

  el.textContent = data.message
    ? "Now Serving: None"
    : "Now Serving: " + data.phone;
}

setInterval(loadCurrent, 3000);
loadCurrent();