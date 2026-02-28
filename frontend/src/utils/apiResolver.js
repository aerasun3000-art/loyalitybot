/**
 * Определение рабочего API URL: пробует PRIMARY (Cloudflare), при таймауте — FALLBACK (RU-зеркало).
 */

const PRIMARY_URL = import.meta.env.VITE_API_URL
const FALLBACK_URL = import.meta.env.VITE_API_URL_FALLBACK

let resolvedUrl = ''

/**
 * Выполняет проверку один раз, кэширует результат.
 * @returns {Promise<string>}
 */
export async function resolveApiUrl() {
  if (resolvedUrl) return resolvedUrl

  if (!FALLBACK_URL) {
    resolvedUrl = PRIMARY_URL || ''
    return resolvedUrl
  }

  try {
    const res = await fetch(`${PRIMARY_URL}/health`, {
      signal: AbortSignal.timeout(1500)
    })
    if (res.ok) {
      resolvedUrl = PRIMARY_URL
      return resolvedUrl
    }
  } catch (_) {
    // таймаут или ошибка — пробуем fallback
  }

  try {
    const res = await fetch(`${FALLBACK_URL}/health`, {
      signal: AbortSignal.timeout(3000)
    })
    if (res.ok) {
      resolvedUrl = FALLBACK_URL
      return resolvedUrl
    }
  } catch (_) {
    // оба не ответили
  }

  resolvedUrl = PRIMARY_URL || ''
  return resolvedUrl
}

/**
 * Синхронно возвращает кэшированный результат ('' если ещё не resolved).
 * @returns {string}
 */
export function getResolvedApiUrl() {
  return resolvedUrl
}
