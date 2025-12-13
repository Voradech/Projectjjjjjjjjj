export async function getPriceData() {
  const res = await fetch("http://localhost:3001/api/price");
  return res.json();
}
