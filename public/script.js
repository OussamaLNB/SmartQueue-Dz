// Get elements
const phoneInput = document.getElementById('phone');
const result = document.getElementById('response');

// Function instead of button listener
async function joinQueue() {
  const phone = phoneInput.value.trim();

  if (!/^0[567]\d{8}$/.test(phone)) {
    result.textContent = "Numéro invalide (ex: 0551234567)";
    result.style.color = "red";
    return;
  }

  try {
    const res = await fetch('/join-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });

    const data = await res.json();

    result.textContent = data.error || data.message;
    
    result.style.color = data.error ? "red" : "lightgreen";

  } catch (err) {
    console.error(err);
    result.textContent = "Server error";
    result.style.color = "red";
  }
}