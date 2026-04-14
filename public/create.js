async function create() {
  const name = document.getElementById('name').value;

  const res = await fetch('/create-shop', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ name })
  });

  const data = await res.json();

  document.getElementById('res').innerHTML =
    data.error || `
    Customer: <a href="${data.customerLink}">${data.customerLink}</a><br>
    Owner: <a href="${data.ownerLink}">${data.ownerLink}</a>
  `;
}