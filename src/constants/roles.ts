import type { UserRole } from "../types";

export const ROLE_OPTIONS: {
  value: UserRole;
  label: string;
  description: string;
}[] = [
  {
    value: "admin",
    label: "Administrador",
    description: "Control total del sistema.",
  },
  {
    value: "mesero",
    label: "Mesero",
    description: "Atención directa y pedidos.",
  },
  {
    value: "cocinero",
    label: "Cocinero",
    description: "Comandas y preparación en cocina.",
  },
  {
    value: "cajero",
    label: "Cajero",
    description: "Consulta el resumen del local.",
  },
];

export function roleLabel(role: UserRole) {
  return ROLE_OPTIONS.find((item) => item.value === role)?.label ?? role;
}
