const phoneInput = document.getElementById('phone');
const result = document.getElementById('response');

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
    body: JSON.stringify({ phone })
  });

  const data = await res.json();

  result.textContent = data.error || data.message;
  result.style.color = data.error ? "red" : "lightgreen";
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

loadCurrent();
setInterval(loadCurrent, 3000);