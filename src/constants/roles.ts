import type { UserRole } from "../types";

export const ROLE_OPTIONS: {
  value: UserRole;
  label: string;
  description: string;
}[] = [
  {
    value: "admin",
    label: "Administrador",
    description:
      "Control total del sistema: gestión de usuarios, configuración general, inventario y supervisión del salón y la cocina.",
  },
  {
    value: "mesero",
    label: "Mesero",
    description:
      "Atención directa: toma de pedidos, visualización de la carta y estado de las mesas.",
  },
  {
    value: "cocinero",
    label: "Cocinero",
    description:
      "Operaciones de cocina: recepción de comandas y avance de la preparación hasta que el pedido está listo.",
  },
  {
    value: "cajero",
    label: "Cajero",
    description:
      "Consulta el resumen del local. No administra usuarios, carta ni inventario.",
  },
];

export function roleLabel(role: UserRole) {
  return ROLE_OPTIONS.find((item) => item.value === role)?.label ?? role;
}
