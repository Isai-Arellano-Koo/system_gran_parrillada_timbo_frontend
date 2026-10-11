# Gran Parrillada Timbó — Frontend

Interfaz web del sistema de gestión de pedidos, cocina e inventario de **Gran Parrillada Timbó**, restaurante de parrillas de 30 mesas. Proyecto del curso *Proyecto Tecnológico* (ISIL, NRC 3710), desarrollado con Scrum.

Cada colaborador inicia sesión y ve solo las pantallas de su rol: el administrador gestiona usuarios, ingredientes, platos e inventario; el mesero registra pedidos; el cocinero atiende las comandas.

- Backend (API REST): https://github.com/Isai-Arellano-Koo/system_gran_parrillada_timbo_backend
- Tablero Scrum (Trello): https://trello.com/b/8duBXs5H/project-gran-parrillada-timbo
- Diseños (Figma): https://www.figma.com/design/HFS3KQvvDFlRI30mvj2E5v/Gran-Parrillada-Timbo?node-id=2-2
- Aplicación desplegada (Railway): https://systemgranparrilladatimbofrontend-production.up.railway.app/

## Alcance por sprint

| Sprint | Historias | Funcionalidad |
|---|---|---|
| Sprint 1 | HU16, HU01, HU02, HU03 | Registro de usuarios por rol, inicio de sesión, ingredientes, stock inicial y entradas |
| Siguientes | HU04 a HU15 | Platos y recetas, pedidos, comandas, descuento de inventario, cancelaciones, movimientos y alertas |

El repositorio ya incluye pantallas de módulos de sprints posteriores (platos, pedidos, cocina). Su validación formal contra los criterios de aceptación se hace en el sprint que corresponda, según el Product Backlog.

## Tecnologías

| Componente | Tecnología |
|---|---|
| Interfaz | React 19 + TypeScript |
| Empaquetador | Vite |
| Navegación | React Router 7 |
| Estado global | Context API (sesión y tema claro/oscuro) |
| Calidad de código | oxlint |
| Pruebas | Vitest |
| Despliegue | Railway |

## Requisitos previos

- Node.js 20 o superior 
- Backend en ejecución (local o desplegado)

## Instalación y ejecución local

```bash
# 1. Clonar e instalar
git clone https://github.com/Isai-Arellano-Koo/system_gran_parrillada_timbo_frontend.git
cd system_gran_parrillada_timbo_frontend
npm install

# 2. Variables de entorno
cp .env.example .env

# 3. Levantar el servidor de desarrollo
npm run dev
```

La aplicación queda en `http://localhost:5173`. Necesita el backend activo en la URL indicada en `VITE_API_URL`.

## Variables de entorno

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `VITE_API_URL` | URL base del backend, sin barra final y sin `/api` | `http://localhost:3000` |

En el despliegue, `VITE_API_URL` debe apuntar a la URL pública del backend y definirse **antes del build**, porque Vite la incorpora al compilar. En el backend, `CORS_ORIGIN` debe contener la URL del frontend.

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Verifica tipos y genera la versión de producción en `dist/` |
| `npm run preview` | Vista previa de la versión compilada |
| `npm run lint` | Análisis de código con oxlint |
| `npm test` | Ejecuta las pruebas con Vitest |

## Pantallas y acceso por rol

| Ruta | Pantalla | Roles con acceso |
|---|---|---|
| `/login` | Inicio de sesión (HU01) | Público |
| `/` | Inicio | Todos los autenticados |
| `/users`, `/users/nuevo`, `/users/:id` | Gestión de usuarios (HU16) | admin |
| `/ingredients` | Ingredientes (HU02) | admin |
| `/inventory` | Inventario: stock y entradas (HU03) | admin |
| `/dishes` | Platos y recetas | admin |
| `/orders` | Pedidos | admin, mesero |
| `/kitchen` | Comandas de cocina | admin, cocinero, mesero |

Las rutas protegidas redirigen al inicio de sesión si no hay sesión activa, y al inicio si el rol no tiene permiso. El login acepta correo o nombre de usuario. Si la cuenta aún no confirmó su correo, el sistema pide el código de verificación antes de dejar entrar.

## Estructura del proyecto

```
src/
├── api/           # Cliente HTTP, servicios y armado del cuerpo de login
├── components/    # AppLayout, ProtectedRoute, ThemeToggle
├── constants/     # Roles y sus descripciones
├── context/       # AuthContext y ThemeContext
├── pages/         # Una pantalla por módulo
├── types/         # Tipos compartidos
├── App.tsx        # Rutas de la aplicación
└── main.tsx       # Punto de entrada
test/              # Pruebas (loginBody, roles)
public/            # Logo y recursos estáticos
```

## Pruebas

```bash
npm test
```

Cubre el armado del cuerpo de login (correo si el identificador contiene `@`, usuario en caso contrario) y la lista de roles del sistema.

## Despliegue en Railway

1. Crear el servicio desde el repositorio de GitHub.
2. Definir `VITE_API_URL` con la URL pública del backend.
3. Build: `npm run build`. Se sirve la carpeta `dist/`.
4. Confirmar que el backend acepta el dominio del frontend en `CORS_ORIGIN`.

## Por qué lo hicimos así

| Decisión | Motivo |
|---|---|
| Pantallas y menú según el rol | Cada colaborador ve solo lo que usa en su trabajo: el mesero no necesita ingredientes ni usuarios. |
| Un solo campo de acceso (correo o usuario) | El cuerpo del login se arma según el texto escrito, para que el personal entre como prefiera (pruebas `loginBody`). |
| Tema claro y oscuro | Lo incluimos porque el personal puede trabajar en distintos ambientes y momentos del día. El tema oscuro puede resultar más cómodo cuando hay poca luz, mientras que el tema claro ayuda a ver la información con buena iluminación. |
| React con Context API en lugar de una librería de estado | El estado compartido es poco (sesión y tema), así que no justificaba sumar otra dependencia. |

## Cómo demostrar el Sprint 1

1. Abrir `/login` e ingresar como administrador.
2. Ir a **Usuarios** y crear un mesero (HU16).
3. Ir a **Ingredientes** y registrar un insumo de la parrilla (HU02).
4. Ir a **Inventario** y registrar el stock inicial y una entrada (HU03).
5. Cerrar sesión e ingresar como mesero para comprobar que ya no ve esas pantallas (HU01).

## Pendiente y limitaciones

- Faltan por marcar en Trello las validaciones finales del Product Owner de HU16, HU01, HU02 y HU03.
- Las pantallas de platos, pedidos y cocina están en el código y se validan formalmente en los siguientes sprints.


## Equipo

| Integrante | Rol Scrum | Aporte |
|---|---|---|
| Mateo Alejandro Goto Gusukuda | Product Owner | Gestión, priorización y validación del Product Backlog |
| Alessandro Del Piero Chavarria Medina | Scrum Master / Developer | Facilitación de Scrum, seguimiento del tablero y README |
| Isai Kaleb Arellano Koo | Developer | Desarrollo del backend y del frontend (código y base de datos) |
| Paul Marcelo Challco Peña | Integrator / UX-UI | Informe técnico y documentación |
| Victor Samir Huallpa Alvites | Developer | |

## Uso de herramientas de IA

Las herramientas de IA empleadas y las partes del código donde se usaron se declaran en el **Anexo A** del informe técnico. Todo el código asistido fue revisado, probado y adaptado por el equipo.
