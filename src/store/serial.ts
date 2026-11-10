/**
 * Runs saves one at a time and skips values that were superseded before
 * their turn came. The app saves after every change, often several in quick
 * succession; without this, two writes can race on the same file and the
 * newest change can be lost.
 */
export function serialWriter(write: (key: string, value: string) => Promise<void>, onError: (e: unknown) => void = () => undefined) {
  let chain: Promise<void> = Promise.resolve();
  const pending = new Map<string, string>();
  return (key: string, value: string): Promise<void> => {
    pending.set(key, value);
    chain = chain
      .then(async () => {
        if (!pending.has(key)) return; // an earlier turn already wrote the newest value
        const latest = pending.get(key) as string;
        pending.delete(key);
        await write(key, latest);
      })
      .catch(onError);
    return chain;
  };
}
