async function run() {
  const response = await fetch("https://n8n.atriozagencia.cloud/webhook/temp-env-check", {
    method: "GET"
  });

  if (!response.ok) {
    console.error("Error response:", await response.text());
    return;
  }

  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

run().catch(console.error);
