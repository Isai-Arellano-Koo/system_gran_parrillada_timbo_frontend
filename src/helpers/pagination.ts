import { useEffect, useMemo, useState } from "react";

export const PAGE_SIZE = 10;

export function pageSlice<T>(items: T[], page: number, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize) || 1);
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * pageSize;
  return {
    current,
    totalPages,
    rows: items.slice(start, start + pageSize),
  };
}

export function usePagedRows<T>(items: T[], resetKey: string, pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const paged = useMemo(
    () => pageSlice(items, page, pageSize),
    [items, page, pageSize]
  );

  useEffect(() => {
    if (paged.current !== page) setPage(paged.current);
  }, [page, paged.current]);

  return { ...paged, setPage, total: items.length };
}
