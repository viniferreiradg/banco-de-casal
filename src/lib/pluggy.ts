const PLUGGY_BASE_URL = "https://api.pluggy.ai";

let cachedApiKey: string | null = null;
let apiKeyExpiresAt = 0;

async function getApiKey(): Promise<string> {
  if (cachedApiKey && Date.now() < apiKeyExpiresAt) {
    return cachedApiKey;
  }

  const res = await fetch(`${PLUGGY_BASE_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: process.env.PLUGGY_CLIENT_ID,
      clientSecret: process.env.PLUGGY_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    throw new Error(`Pluggy auth failed: ${res.statusText}`);
  }

  const data = await res.json();
  cachedApiKey = data.apiKey;
  apiKeyExpiresAt = Date.now() + 2 * 60 * 60 * 1000; // 2 hours

  return cachedApiKey!;
}

async function pluggyFetch(path: string, options: RequestInit = {}) {
  const apiKey = await getApiKey();

  const res = await fetch(`${PLUGGY_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Pluggy request failed (${res.status}): ${error}`);
  }

  return res.json();
}

export async function createConnectToken(itemId?: string): Promise<string> {
  const body: Record<string, unknown> = {
    clientUserId: "banco-de-casal",
    webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/pluggy/webhook`,
  };

  if (itemId) body.itemId = itemId;

  const data = await pluggyFetch("/connect_token", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return data.accessToken;
}

export async function getItem(itemId: string) {
  return pluggyFetch(`/items/${itemId}`);
}

export async function getAccounts(itemId: string) {
  return pluggyFetch(`/accounts?itemId=${itemId}`);
}

export interface PluggyTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  currencyCode: string;
  category: string | null;
  accountId: string;
}

export async function getTransactions(
  accountId: string,
  from?: string,
  to?: string
): Promise<{ results: PluggyTransaction[]; total: number }> {
  let url = `/transactions?accountId=${accountId}&pageSize=500`;
  if (from) url += `&from=${from}`;
  if (to) url += `&to=${to}`;

  return pluggyFetch(url);
}

export async function deleteItem(itemId: string) {
  return pluggyFetch(`/items/${itemId}`, { method: "DELETE" });
}
