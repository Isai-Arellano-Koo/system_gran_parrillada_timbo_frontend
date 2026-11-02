import type { ReactNode } from "react";
import { PAGE_SIZE } from "../helpers/pagination";

type TablePagerProps = {
  total: number;
  page: number;
  pageSize?: number;
  onPage: (page: number) => void;
  extra?: ReactNode;
};

export function TablePager({
  total,
  page,
  pageSize = PAGE_SIZE,
  onPage,
  extra,
}: TablePagerProps) {
  if (total === 0) {
    return extra ? <div className="list-foot pager">{extra}</div> : null;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const from = (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  return (
    <div className="list-foot pager">
      <span>
        Mostrando {from}–{to} de {total}
      </span>
      {extra}
      {totalPages > 1 ? (
        <div className="pager-nav" role="navigation" aria-label="Paginación">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={current <= 1}
            onClick={() => onPage(current - 1)}
          >
            Anterior
          </button>
          <span>
            Página {current} de {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={current >= totalPages}
            onClick={() => onPage(current + 1)}
          >
            Siguiente
          </button>
        </div>
      ) : null}
    </div>
  );
}
