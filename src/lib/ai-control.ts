import "server-only";

const API_URL = process.env.AI_CONTROL_API_URL;
const API_TOKEN = process.env.AI_CONTROL_API_TOKEN;

function getHeaders() {
  return {
    "Authorization": API_TOKEN ?? "",
    "Content-Type": "application/json",
  };
}

export function getPauseKey(telefone: string) {
  return `pause_agent_${telefone}`;
}

export async function getPauseTtl(telefone: string): Promise<number> {
  if (!API_URL) throw new Error("AI_CONTROL_API_URL is not configured.");
  
  try {
    const response = await fetch(`${API_URL}/ai-status?telefone=${encodeURIComponent(telefone)}`, {
      method: "GET",
      headers: getHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get AI status: ${response.statusText}`);
    }
    
    const data = (await response.json()) as { paused: boolean; ttl: number };
    return data.paused ? data.ttl : -2;
  } catch (error) {
    console.error("Error calling AI control GET status API:", error);
    return -2; // Fallback para não pausado em caso de erro
  }
}

export async function pauseAgent(telefone: string, seconds: number): Promise<void> {
  if (!API_URL) throw new Error("AI_CONTROL_API_URL is not configured.");
  
  const response = await fetch(`${API_URL}/pause-ai`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ telefone, seconds }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to pause AI via bridge: ${response.statusText}`);
  }
}

export async function wakeAgent(telefone: string): Promise<void> {
  if (!API_URL) throw new Error("AI_CONTROL_API_URL is not configured.");
  
  const response = await fetch(`${API_URL}/wake-ai`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ telefone }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to wake AI via bridge: ${response.statusText}`);
  }
}
