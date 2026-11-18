export class SheetsError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'SheetsError';
    this.status = status;
  }
}

class SheetsNetworkError extends Error {}

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_READ_ATTEMPTS = 3;

async function sendRequest<T>(url: URL, options: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (response.ok) return (await response.json()) as T;

    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    let message = payload?.error?.message || `Google Sheets returned HTTP ${response.status}.`;
    if (response.status === 401) message = 'Your Google session expired. Reconnect to continue.';
    if (response.status === 403)
      message = 'Google Sheets denied access. Check your permissions and reconnect the workbook.';
    if (response.status === 429)
      message = 'Google Sheets is receiving too many requests. Wait a moment and try again.';
    throw new SheetsError(message, response.status);
  } catch (cause) {
    if (!controller.signal.aborted && !(cause instanceof TypeError)) throw cause;
    throw new SheetsNetworkError(
      options.method === 'GET'
        ? 'Could not reach Google Sheets. Check your connection and try again.'
        : 'The update could not be confirmed. Sync again to check the workbook before resending.',
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function request<T>(
  token: string,
  id: string,
  path = '',
  query?: URLSearchParams,
  body?: unknown,
): Promise<T> {
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}${path}`);
  if (query) url.search = query.toString();
  const options: RequestInit = {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
  for (let attempt = 0; ; attempt++) {
    try {
      return await sendRequest<T>(url, options);
    } catch (cause) {
      const retryable =
        cause instanceof SheetsNetworkError ||
        (cause instanceof SheetsError &&
          (cause.status === 429 || (cause.status !== undefined && cause.status >= 500)));
      // An uncertain write must be reconciled by a fresh sync, never blindly repeated.
      if (body !== undefined || !retryable || attempt + 1 >= MAX_READ_ATTEMPTS) throw cause;
      await new Promise<void>((resolve) => setTimeout(resolve, 750 * 2 ** attempt + Math.random() * 250));
    }
  }
}
