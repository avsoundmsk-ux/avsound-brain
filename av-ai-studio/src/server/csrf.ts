/**
 * CSRF для mutation-роутов (POST/PUT/PATCH/DELETE): проверка Origin против Host.
 * Same-origin → ок. GET/HEAD/OPTIONS не проверяются.
 * (better-auth свои /api/auth/* эндпоинты защищает сам через trustedOrigins.)
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isMutation(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}

export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return false; // mutation без Origin/Host — отклоняем
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Бросает при несовпадении origin на mutation-запросе. */
export function assertCsrf(req: Request): void {
  if (isMutation(req.method) && !sameOrigin(req)) {
    throw new CsrfError();
  }
}

export class CsrfError extends Error {
  readonly status = 403;
  constructor() {
    super("CSRF: origin mismatch");
    this.name = "CsrfError";
  }
}
