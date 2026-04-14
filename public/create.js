async function create() {
  const name = document.getElementById('name').value;

  const res = await fetch('/create-shop', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name })
  });

  const data = await res.json();

  document.getElementById('links').innerHTML = `
    Customer: ${data.customer}<br>
    Owner: ${data.owner}
  `;
}