export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function postJson<TBody, TResponse>(
  url: string,
  body: TBody,
): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}) as Record<string, unknown>);
    const message =
      (payload.detail as string | undefined) ??
      (payload.error as string | undefined) ??
      `HTTP ${response.status}`;
    throw new ApiError(response.status, message, payload.error as string | undefined);
  }
  return (await response.json()) as TResponse;
}
