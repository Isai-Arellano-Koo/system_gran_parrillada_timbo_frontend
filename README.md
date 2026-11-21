# Gran Parrillada Timbó — Frontend

Interfaz web del sistema de gestión de pedidos, cocina e inventario de **Gran Parrillada Timbó**, restaurante de parrillas de 30 mesas. Proyecto del curso *Proyecto Tecnológico* (ISIL, NRC 3710), desarrollado con Scrum.

Cada colaborador inicia sesión y ve solo las pantallas de su rol: el administrador gestiona usuarios, carta, inventario y mesas; el mesero atiende las mesas; el cocinero atiende las comandas; el cajero atiende delivery y pedidos para llevar y consulta las ventas.

- Backend (API REST): https://github.com/Isai-Arellano-Koo/system_gran_parrillada_timbo_backend
- Tablero Scrum (Trello): https://trello.com/b/8duBXs5H/project-gran-parrillada-timbo
- Diseños (Figma): https://www.figma.com/design/HFS3KQvvDFlRI30mvj2E5v/Gran-Parrillada-Timbo?node-id=2-2
- Aplicación desplegada (Railway): https://systemgranparrilladatimbofrontend-production.up.railway.app/

## Qué hace la aplicación

- **Acceso:** inicio de sesión con correo o usuario, confirmación del correo con código y recuperación de contraseña.
- **Carta y recetas:** categorías, platos con pestañas por categoría y receta de cada plato.
- **Inventario:** entradas de stock, movimientos con filtros, alertas de stock mínimo y revisión de mermas.
- **Pedidos:** atención de **mesa**, **delivery** y **para llevar**, con búsqueda de platos, observaciones, validación de stock, confirmación, platos extra, devoluciones, pago, cierre y cancelación.
- **Mesas:** plano de mesas con colores por estado, unir y separar mesas arrastrando (también en pantallas táctiles), habilitar o inhabilitar mesas.
- **Cocina:** comandas con el estado de cada plato, el nombre del mesero y la fecha y hora del pedido, con filtros y ordenamiento.
- **Notificaciones y tiempo real:** campanita con aviso y sonido cuando un plato queda listo, y pantallas que se actualizan solas.
- **Consultas:** historial de pedidos, historial de cambios de estado de usuarios y platos vendidos por rango de fechas.

## Alcance por sprint

| Sprint | Historias | Funcionalidad |
|---|---|---|
| Sprint 1 | HU16, HU01, HU02, HU03 | Registro de usuarios por rol, inicio de sesión, ingredientes, stock inicial y entradas |
| Sprint 2 | Historias del Sprint Backlog entre HU04 y HU15, y mejoras aprobadas | Carta y recetas, flujo del pedido (apertura, validación de stock, confirmación, extras, pago y cierre), cocina, movimientos y alertas de inventario, historial de cambios de estado de usuarios |
| Mejoras posteriores | Funcionalidades adicionales al backlog inicial | Delivery y para llevar, unir y separar mesas, notificaciones en vivo, historial y platos vendidos, devoluciones y mermas |

Qué historias entraron en cada sprint y su estado de validación se registran en el tablero de Trello.

## Tecnologías

| Componente | Tecnología |
|---|---|
| Interfaz | React 19 + TypeScript |
| Empaquetador | Vite |
| Navegación | React Router 7 |
| Estado global | Context API (sesión, tema claro/oscuro y actualizaciones en vivo) |
| Tiempo real | Canal SSE del backend (`/api/live`) |
| Calidad de código | oxlint |
| Pruebas | Vitest |
| Despliegue | Railway |

## Requisitos previos

- Node.js 20.19 o superior (se recomienda la versión LTS)
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

La aplicación queda en `http://localhost:5173`. Necesita el backend activo en la URL indicada en `VITE_API_URL`. En Windows, si `cp` no funciona en tu terminal, usa `copy .env.example .env`.

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
| `/users/historial` | Historial de cambios de estado de usuarios, con su motivo | admin |
| `/categories` | Categorías de la carta | admin |
| `/dishes/recetas`, `/dishes/:id/receta` | Recetas de cada plato (HU05) | admin |
| `/ingredients` | Ingredientes (HU02) | admin |
| `/inventory` | Inventario: entradas de stock, movimientos con filtros (HU14), alertas de stock mínimo (HU15) y revisión de mermas | admin |
| `/tables` | Mesas: habilitar o inhabilitar con motivo e historial de cambios | admin |
| `/historial-pedidos` | Historial de pedidos de mesa, delivery y para llevar | admin |
| `/dishes` | Carta de platos, con pestañas por categoría (HU04) | admin, mesero |
| `/orders` | Pedidos de mesa: abrir, agregar platos con observaciones, validar stock, confirmar, enviar extras, devolver platos, pagar, cerrar o cancelar; unir y separar mesas (HU06 a HU09, HU13) | admin, mesero |
| `/delivery` | Pedidos de delivery y para llevar, con datos del cliente | admin, cajero |
| `/sales` | Platos vendidos por rango de fechas | admin, cajero |
| `/kitchen` | Comandas de cocina: estado de la comanda y de cada plato, filtros y ordenamiento (HU10, HU11) | admin, cocinero, mesero |

Las rutas protegidas redirigen al inicio de sesión si no hay sesión activa, y al inicio si el rol no tiene permiso. El login acepta correo o nombre de usuario. Si la cuenta aún no confirmó su correo, el sistema pide el código de verificación antes de dejar entrar.

## Detalle de las funciones principales

**Pedidos de mesa**
- Se elige la mesa, se buscan platos por nombre, categoría o precio y se agregan con cantidad y observación (por ejemplo, el término de cocción de la carne).
- Antes de confirmar se puede validar el stock; al confirmar, el pedido pasa a cocina y el inventario se descuenta.
- Si el cliente pide más, los platos nuevos se envían como **extras**; se registra el **pago** y luego se **cierra** el pedido, que libera la mesa.
- Un plato ya enviado a cocina no se modifica: se devuelve (con motivo) o se cancela el pedido (con motivo).
- Para unir mesas se arrastra una sobre otra; el mesero también puede separarlas. Funciona con el dedo en pantallas táctiles.

**Delivery y para llevar**
- El delivery pide nombre, teléfono y dirección; el pedido para llevar pide el nombre del cliente. El cajero los registra, cobra y cierra.

**Cocina**
- Cada tarjeta muestra el pedido, el mesero, la fecha y hora, y el estado de cada plato (pendiente, en preparación, listo, entregado). Solo cocina cambia los estados.

**Notificaciones y tiempo real**
- Cuando cocina marca un plato como listo, el mesero responsable ve la notificación en la campanita, con sonido, y puede ir al pedido. La leyenda de colores explica los estados de pedidos y mesas.

**Inventario**
- Las devoluciones de platos generan mermas pendientes; el administrador decide si se **recuperan** (el stock vuelve) o se **descartan**.

## Estructura del proyecto

```
src/
├── api/           # Cliente HTTP, servicios y armado del cuerpo de login
├── components/    # AppLayout, ProtectedRoute, ThemeToggle, NotificationBell,
│                  #   OrderStockActions, StatusLegend, TablePager, UserStatusHistory
├── constants/     # Roles y sus descripciones
├── context/       # AuthContext, ThemeContext y LiveContext (tiempo real)
├── helpers/       # Fechas, paginación, búsqueda, sonido de notificación,
│                  #   estados de pedidos y apertura de pedidos
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

Cubre el armado del cuerpo de login (correo si el identificador contiene `@`, usuario en caso contrario) y la lista de roles del sistema. Las pruebas de la lógica de negocio están en el backend.

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
| Tema claro y oscuro | Cada usuario puede elegir el tema que le resulte más cómodo a la vista. |
| Menú lateral adaptable (responsive) | El menú se adapta al tamaño de pantalla para poder usar el sistema en computadora o en dispositivos más pequeños. |
| Gestos táctiles para unir mesas | El mesero usa el sistema desde pantallas táctiles, donde arrastrar con el dedo es más natural que hacer clic. |
| Búsqueda, filtros y paginación en las tablas | Con una carta de 19 categorías y muchos movimientos de inventario, las listas largas se vuelven difíciles de usar. |
| Colores por estado y leyenda | El estado de mesas y pedidos se reconoce de un vistazo, sin abrir cada pedido. |
| Actualización en vivo con `LiveContext` | El servidor avisa qué área cambió y la pantalla vuelve a consultar solo esos datos, sin recargar la página. |
| Notificación con sonido al mesero | Un plato listo debe servirse pronto; el aviso evita que el mesero tenga que consultar cocina. |
| React con Context API en lugar de una librería de estado | El estado compartido es poco (sesión, tema y avisos en vivo), así que no justificaba sumar otra dependencia. |

## Cómo demostrar el sistema

**Sprint 1**
1. Abrir `/login` e ingresar como administrador.
2. Ir a **Usuarios** y crear un mesero.
3. Ir a **Ingredientes** y registrar un insumo de la parrilla.
4. Ir a **Inventario** y registrar el stock inicial y una entrada.
5. Cerrar sesión e ingresar como mesero para comprobar que ya no ve esas pantallas.

**Sprint 2**
1. Como administrador, abrir **Platos** y revisar la carta por categorías; abrir la receta de un plato.
2. Ir a **Inventario**, registrar una entrada de stock y revisar los movimientos con sus filtros y las alertas de stock mínimo.
3. Como mesero, abrir **Pedidos**, elegir una mesa, buscar un plato, agregarlo con una observación y validar el stock.
4. Confirmar el pedido y comprobar que aparece en **Cocina**.
5. Como cocinero, cambiar el estado de la comanda y de un plato; el mesero recibe la notificación.
6. Como mesero, enviar un plato extra, marcar el pago y cerrar el pedido.

**Mejoras posteriores**
1. Como cajero, registrar un pedido de delivery y uno para llevar, y cobrarlos.
2. Como mesero, unir dos mesas arrastrando una sobre otra y separarlas.
3. Devolver un plato y, como administrador, revisar la merma en **Inventario**.
4. Como administrador, inhabilitar una mesa, revisar el historial de pedidos y los platos vendidos.

## Pendiente y limitaciones

- Las pantallas del Sprint 2 están implementadas; su validación final contra los criterios de aceptación y la Definition of Done queda registrada en Trello.
- Las funcionalidades posteriores al backlog inicial (delivery, para llevar, unir mesas, notificaciones, historiales y mermas) deben quedar registradas como historias de usuario en el Product Backlog.
- Las pruebas automáticas del frontend son pocas (login y roles); la mayor parte de la verificación de pantallas es manual.
- La aplicación depende del backend: si la API no está disponible, las pantallas no muestran datos.

## Equipo

| Integrante | Rol Scrum | Aporte |
|---|---|---|
| Mateo Alejandro Goto Gusukuda | Product Owner | Gestión, priorización y validación del Product Backlog |
| Alessandro Del Piero Chavarria Medina | Scrum Master / Developer | Facilitación de Scrum, seguimiento del tablero y README |
| Isai Kaleb Arellano Koo | Developer | Desarrollo del backend y del frontend (código y base de datos) |
| Paul Marcelo Challco Peña | Integrator / UX-UI | Informe técnico y documentación |
| Victor Samir Huallpa Alvites | Developer | Apoyo en desarrollo a Isai y a Mateo, y pruebas del Sprint 2 en el backend |

