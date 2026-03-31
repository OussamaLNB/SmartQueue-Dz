// Get elements
const phoneInput = document.getElementById('phone');
const joinBtn = document.getElementById('joinBtn');
const result = document.getElementById('result');

// Only allow digits while typing
phoneInput.addEventListener('input', () => {
  phoneInput.value = phoneInput.value.replace(/\D/g, '');
});

joinBtn.addEventListener('click', async () => {
  const phone = phoneInput.value.trim();

  // Validate Algerian number
  if (!/^0[567]\d{8}$/.test(phone)) {
    result.textContent = "Numéro invalide (ex: 0551234567)";
    return;
  }

  try {
    const res = await fetch('/join-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });

    const data = await res.json();

    if (data.error) {
      result.textContent = data.error;
    } else {
      result.textContent = data.message;
    }

  } catch (err) {
    console.error(err);
    result.textContent = "Server error";
  }
});
