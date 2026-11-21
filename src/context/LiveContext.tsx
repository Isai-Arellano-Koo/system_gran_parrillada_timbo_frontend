import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { API_URL } from "../api/client";
import { useAuth } from "./AuthContext";

export type LiveScope =
  | "orders"
  | "kitchen"
  | "tables"
  | "notifications"
  | "inventory"
  | "catalog"
  | "users";

export type LiveEvent = {
  id: number;
  scope: LiveScope;
  at: string;
};

type LiveContextValue = {
  version: number;
  events: LiveEvent[];
  connected: boolean;
};

const LiveContext = createContext<LiveContextValue>({
  version: 0,
  events: [],
  connected: false,
});

function parseSseChunk(chunk: string, onEvent: (scope: LiveScope, at: string) => void) {
  const blocks = chunk.split("\n\n");
  for (const block of blocks) {
    if (!block.trim() || block.startsWith(":")) continue;
    const dataLine = block
      .split("\n")
      .find((line) => line.startsWith("data:"));
    if (!dataLine) continue;
    try {
      const payload = JSON.parse(dataLine.slice(5).trim()) as {
        scope?: LiveScope;
        at?: string;
      };
      if (payload.scope) onEvent(payload.scope, payload.at || "");
    } catch {
      /* bloque incompleto o no JSON */
    }
  }
}

export function LiveProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [version, setVersion] = useState(0);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!token) {
      setConnected(false);
      return;
    }
    const abort = new AbortController();
    let retry: number | null = null;
    let delay = 1000;

    const listen = async () => {
      try {
        const response = await fetch(`${API_URL}/api/live`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "text/event-stream",
          },
          signal: abort.signal,
        });
        if (!response.ok || !response.body) {
          throw new Error("live");
        }
        setConnected(true);
        delay = 1000;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!abort.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";
          const incoming: LiveEvent[] = [];
          for (const part of parts) {
            parseSseChunk(part, (scope, at) => {
              seq.current += 1;
              incoming.push({ id: seq.current, scope, at });
            });
          }
          if (!incoming.length) continue;
          setEvents((prev) => {
            const next = [...prev, ...incoming];
            return next.length > 80 ? next.slice(-80) : next;
          });
          setVersion(seq.current);
        }
        setConnected(false);
      } catch {
        setConnected(false);
      }
      if (!abort.signal.aborted) {
        retry = window.setTimeout(() => {
          void listen();
        }, delay);
        delay = Math.min(delay * 2, 15000);
      }
    };

    void listen();
    return () => {
      abort.abort();
      if (retry != null) window.clearTimeout(retry);
    };
  }, [token]);

  return (
    <LiveContext.Provider value={{ version, events, connected }}>
      {children}
    </LiveContext.Provider>
  );
}

export function useLive() {
  return useContext(LiveContext);
}

export function useLiveReload(scopes: LiveScope[], reload: () => void) {
  const { version, events } = useLive();
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const seenRef = useRef(version);
  const scopesKey = scopes.join(",");

  useEffect(() => {
    const unread = events.filter((event) => event.id > seenRef.current);
    seenRef.current = version;
    const wanted = scopesKey.split(",") as LiveScope[];
    if (!unread.some((event) => wanted.includes(event.scope))) return;
    const timer = window.setTimeout(() => {
      reloadRef.current();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [version, events, scopesKey]);
}
