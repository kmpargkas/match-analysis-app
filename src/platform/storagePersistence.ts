let request: Promise<boolean> | undefined;

/**
 * Asks the browser not to evict our IndexedDB data under storage pressure.
 * Asked once per page load; every caller gets the same answer.
 */
export function requestPersistentStorage(): Promise<boolean> {
  request ??= (async () => {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return navigator.storage.persist();
  })().catch(() => false);
  return request;
}
