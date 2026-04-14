function createShop() {
  const input = document.getElementById('shopInput');
  const links = document.getElementById('links');

  let name = input.value.trim().toLowerCase();

  if (!name) {
    links.textContent = "Enter a name";
    return;
  }

  name = name.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const base = window.location.origin;

  links.innerHTML = `
    Customer:<br>
    <a href="/shop/${name}" target="_blank">${base}/shop/${name}</a>
    <br><br>
    Owner:<br>
    <a href="/owner/${name}" target="_blank">${base}/owner/${name}</a>
  `;
}