// Persistent KV store via jack0.x1.xyz:8800 (combined BB server)

const DATA_API = "https://jack0.x1.xyz:8800/api/data";

async function api(path: string, method = "GET", body?: unknown): Promise<any> {
  const opts: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${DATA_API}${path}`, opts);
    if (!res.ok) throw new Error(`Data API: ${res.status}`);
    const data = await res.json();
    return data?.result ?? data;
  } catch (e) {
    console.error("KV API error:", path, e);
    throw e;
  }
}

export async function kvGet<T = unknown>(key: string): Promise<T | null> {
  const parts = key.split(":");
  if (parts.length >= 2) {
    const hkey = parts.slice(0, -1).join(":");
    const field = parts[parts.length - 1];
    const hash = await api(`/hgetall/${hkey}`);
    return hash?.[field] ?? null;
  }
  return await api(`/get/${key}`);
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await api(`/set/${key}`, "POST", { value });
}

export async function kvDel(...keys: string[]): Promise<void> {
  for (const k of keys) await api(`/del/${k}`, "DELETE");
}

export async function kvSadd(key: string, ...members: (string | number)[]): Promise<number> {
  return await api(`/sadd/${key}`, "POST", { members: members.map(String) });
}

export async function kvSmembers(key: string): Promise<string[]> {
  return await api(`/smembers/${key}`);
}

export async function kvLpush(key: string, ...items: string[]): Promise<number> {
  return await api(`/lpush/${key}`, "POST", { items });
}

export async function kvLrange(key: string, start: number, stop: number): Promise<string[]> {
  return await api(`/lrange/${key}?start=${start}&stop=${stop}`);
}

export async function kvLrem(key: string, count: number, value: string): Promise<number> {
  return await api(`/lrem/${key}`, "POST", { count, value });
}

export async function kvHset(key: string, obj: Record<string, unknown>): Promise<void> {
  await api(`/hset/${key}`, "POST", obj);
}

export async function kvHgetall<T = Record<string, unknown>>(key: string): Promise<T | null> {
  return await api(`/hgetall/${key}`);
}

export async function kvHget<T = unknown>(key: string, field: string): Promise<T | null> {
  const hash = await api(`/hgetall/${key}`);
  return hash?.[field] ?? null;
}