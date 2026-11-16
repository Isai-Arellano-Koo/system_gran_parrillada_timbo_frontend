import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { notificationsApi } from "../api/services";
import type { WaiterNotification, WaiterNotificationList } from "../types";
import { orderCodeLabel } from "../types";
import { formatNotifyStamp } from "../helpers/datetime";
import {
  notifySoundReady,
  playReadyChime,
  unlockNotifySound,
} from "../helpers/notifySound";

const empty: WaiterNotificationList = {
  pending: [],
  history: [],
  pending_count: 0,
};

function orderTitle(item: WaiterNotification) {
  return `Pedido ${orderCodeLabel({ code: item.order_code, id: item.order_id })}`;
}

export function NotificationBell() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [data, setData] = useState<WaiterNotificationList>(empty);
  const [toast, setToast] = useState<WaiterNotification | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const seen = useRef<Set<number>>(new Set());
  const primed = useRef(false);
  const root = useRef<HTMLDivElement>(null);

  const canSee =
    Boolean(token) && (user?.role === "mesero" || user?.role === "admin");

  const refresh = async (announce: boolean) => {
    if (!token || !canSee) return;
    const list = await notificationsApi.list(token);
    if (!primed.current) {
      for (const item of list.pending) seen.current.add(item.id);
      primed.current = true;
      setData(list);
      return;
    }
    const fresh = list.pending.filter((item) => !seen.current.has(item.id));
    for (const item of list.pending) seen.current.add(item.id);
    setData(list);
    if (announce && fresh.length) {
      setToast(fresh[0]);
      let played = false;
      for (let index = 0; index < fresh.length; index += 1) {
        if (index === 0) {
          played = await playReadyChime();
        } else {
          window.setTimeout(() => {
            void playReadyChime();
          }, index * 280);
        }
      }
      setSoundOn(played || notifySoundReady());
    }
  };

  useEffect(() => {
    const unlock = () => {
      void unlockNotifySound().then(() => setSoundOn(notifySoundReady()));
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    if (!canSee) {
      setData(empty);
      primed.current = false;
      seen.current.clear();
      return;
    }
    refresh(false).catch(() => undefined);
    const timer = window.setInterval(() => {
      refresh(true).catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [token, canSee]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 7000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!canSee) return null;

  const openOrder = async (item: WaiterNotification, attend: boolean) => {
    void unlockNotifySound();
    if (attend && token && !item.attended_at) {
      try {
        await notificationsApi.attend(token, item.id);
        setData((prev) => {
          const moved = { ...item, attended_at: new Date().toISOString() };
          return {
            pending: prev.pending.filter((row) => row.id !== item.id),
            history: [moved, ...prev.history.filter((row) => row.id !== item.id)],
            pending_count: Math.max(0, prev.pending_count - 1),
          };
        });
      } catch {
        /* el pedido igual se abre */
      }
    }
    setOpen(false);
    setToast(null);
    navigate(`/orders?order=${item.order_id}`);
  };

  const items = tab === "pending" ? data.pending : data.history;
  const count = data.pending_count;

  return (
    <div className="notify-root" ref={root}>
      <button
        type="button"
        className="notify-bell"
        aria-label="Notificaciones"
        aria-expanded={open}
        onClick={() => {
          void unlockNotifySound().then(() => setSoundOn(notifySoundReady()));
          setOpen((value) => !value);
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {count ? <span className="notify-badge">{count}</span> : null}
      </button>

      {open ? (
        <div className="notify-panel" role="dialog" aria-label="Notificaciones">
          <header className="notify-head">
            <h2>Notificaciones</h2>
            <p>Platos listos para recoger</p>
          </header>
          <div className="notify-tabs" role="tablist">
            <button
              type="button"
              className={tab === "pending" ? "on" : ""}
              onClick={() => setTab("pending")}
            >
              Pendientes {count}
            </button>
            <button
              type="button"
              className={tab === "history" ? "on" : ""}
              onClick={() => setTab("history")}
            >
              Historial
            </button>
          </div>
          <div className="notify-list">
            {!items.length ? (
              <p className="notify-empty">
                {tab === "pending"
                  ? "No hay platos pendientes de recoger."
                  : "Todavía no hay notificaciones atendidas."}
              </p>
            ) : (
              items.map((item) => (
                <article key={item.id} className="notify-card">
                  <div className="notify-card-top">
                    <div>
                      <strong>{item.dish_label || orderTitle(item)}</strong>
                      <span>
                        {orderTitle(item)} · {item.table_label}
                      </span>
                    </div>
                    <em className={item.attended_at ? "done" : "ready"}>
                      {item.attended_at ? "Atendida" : "Listo"}
                    </em>
                  </div>
                  <p>
                    Generada el {formatNotifyStamp(item.generated_at)}
                  </p>
                  <button
                    type="button"
                    className="notify-open"
                    onClick={() => void openOrder(item, !item.attended_at)}
                  >
                    Ver pedido
                    <span aria-hidden="true">›</span>
                  </button>
                </article>
              ))
            )}
          </div>
          <p className="notify-foot">
            Abre el pedido para atender la notificación. Abrirla no cambia la
            comanda ni sus platos.
          </p>
        </div>
      ) : null}

      {toast && !open
        ? createPortal(
            <button
              type="button"
              className="notify-toast"
              onClick={() => void openOrder(toast, true)}
            >
              <span className="notify-toast-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M6 9a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
                  <path d="M10 20a2 2 0 0 0 4 0" />
                </svg>
              </span>
              <span>
                <strong>Plato listo para recoger</strong>
                <em>
                  {toast.dish_label || orderTitle(toast)} · {toast.table_label}
                </em>
                <em className="sound">
                  {soundOn
                    ? "Sonido activado"
                    : "Toca para activar el aviso con sonido"}
                </em>
              </span>
            </button>,
            document.body
          )
        : null}
    </div>
  );
}
