type OpenOrderListener = (orderId: number) => void;

const listeners = new Set<OpenOrderListener>();

export function requestOpenOrder(orderId: number) {
  if (!Number.isFinite(orderId) || orderId <= 0) return;
  for (const listener of listeners) listener(orderId);
}

export function subscribeOpenOrder(listener: OpenOrderListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
