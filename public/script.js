const phoneInput = document.getElementById('phone');
const result = document.getElementById('response');

const pathParts = window.location.pathname.split('/');
const shopId = pathParts[2];

document.getElementById('shopName').textContent = shopId;

// JOIN
async function joinQueue() {
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

  if (data.message) {
    el.textContent = "Now Serving: None";
  } else {
    el.textContent = "Now Serving: " + data.phone;
  }
}

setInterval(loadCurrent, 3000);
loadCurrent();