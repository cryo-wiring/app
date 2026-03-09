export const customFetch = async <T>(
  url: string,
  options: RequestInit,
): Promise<T> => {
  const res = await fetch(url, options);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  return { data, status: res.status, headers: res.headers } as T;
};
