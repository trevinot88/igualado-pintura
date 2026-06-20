@AGENTS.md

# CLAUDE.md — Memoria Técnica (Igualado Pintura / Pinturas Dyrlo)

> ⚠️ **Next.js 16 — NO es el Next.js que conoces.** Esta versión tiene breaking
> changes (APIs, convenciones, estructura). Antes de escribir código de Next,
> lee la guía relevante en `node_modules/next/dist/docs/` y respeta los avisos
> de deprecación. (Ver `AGENTS.md`.)

## 1. Tech Stack & Infraestructura
- **Framework:** Next.js **16.2.1** (App Router) + React **19.2** + TypeScript 5.
- **ORM / DB:** Prisma **7.6** sobre **PostgreSQL** (driver `@prisma/adapter-pg`).
- **Auth:** NextAuth **v5 (beta)** — estrategia **JWT**, provider `Credentials`.
- **UI:** Tailwind CSS **4**, Radix UI, `lucide-react`, gráficas con **Recharts**.
- **Validación:** **Zod** en cada route handler.
- **Hosting:** **Render** (`render.yaml`, plan free, runtime Node). Build aplica
  `prisma migrate deploy` automáticamente.
- **APIs de terceros:**
  - **Green API** → notificaciones WhatsApp al cliente (`lib/notifications.ts`).
  - **Resend** → email (`lib/email.ts`).
  - Impresión de etiquetas térmicas (ZPL) — `lib/label-printer.ts` (stub, `PRINTER_URL` pendiente).

## 2. Arquitectura de Carpetas
```
app/
  api/            # Route handlers (REST). Subcarpeta por recurso.
    pedidos/ produccion/ admin/queue/ clientes/ usuarios/
    igualadores/ vendedores/ color-groups/ igualacion-lines/
    reportes/ audit/ notificaciones/ health/ auth/[...nextauth]/
  dashboard/      # UI protegida (server+client). Una carpeta por pantalla.
    page.tsx(KPIs) pedidos/ produccion/ reportes/ usuarios/ clientes/
    codigos-ig/ audit/  + layout.tsx (Sidebar)
  login/  page.tsx  layout.tsx
lib/              # Lógica de negocio reutilizable
  auth.ts auth.config.ts  permissions.ts  folio.ts
  notifications.ts email.ts label-printer.ts audit.ts
  prisma.ts  demo-data.ts  utils.ts
components/       # sidebar, providers, ui/* (Radix wrappers)
prisma/           # schema.prisma, migrations/, seed.ts
middleware.ts     # Gate de auth + roles (Edge)
prisma.config.ts  # datasource.url = DIRECT_URL || DATABASE_URL
render.yaml
```

## 3. Core Business Logic
Gestión de pedidos de **igualación de pintura** para un taller con mostrador y ventas.
- **Ciclo de vida del pedido (`OrderStatus`):**
  `PENDIENTE → EN_PROCESO → LISTO → ENTREGADO`; ramas `CANCELADO`, `PAUSADO`.
  Transiciones permitidas por rol en `lib/permissions.ts` (`canTransition`).
- **Folio:** formato `YYMMDD-XX`, secuencia atómica que **reinicia diario**
  (`lib/folio.ts` + tabla `FolioSequence`).
- **Cola (`queuePosition`):** FIFO. Usuarios no-ADMIN solo pueden **iniciar el
  siguiente** y **completar el más antiguo** en proceso; ADMIN puede saltarse el orden.
  Reordenar/pausar/reanudar/skip → `app/api/admin/queue/*` (solo ADMIN).
- **Asignación round-robin:** al crear pedido se asigna un `igualador` (User rol
  IGUALADOR) automáticamente, rotando por fecha de creación.
- **Operador físico vs. usuario de sistema:** `Igualador` y `Vendedor` son tablas de
  **personas reales** del taller, distintas de las cuentas `User`. Al **iniciar
  producción es OBLIGATORIO** `operadorFisicoId`; los reportes miden por persona física.
- **Triggers al completar (`/api/produccion/complete`):** genera **etiqueta** +
  envía **WhatsApp** al cliente; ambos fallan en silencio sin abortar el pedido.
  Permite registrar un `ayudante` (debe ser distinto al igualador).
- **Auditoría:** toda acción relevante se registra vía `lib/audit.ts` (`AuditLog`).
- **Demo mode:** `DEMO_MODE=true` (solo fuera de producción) sirve datos falsos y
  login `admin@dyrlo.com / admin123` sin DB.

## 4. Modelos de Datos Clave (`prisma/schema.prisma`)
- **`Order`** (entidad central) → relaciona:
  `client` (Client), `seller` (User), `igualador`/`ayudante` (User),
  `operadorFisico` (**Igualador**), `vendedor` (**Vendedor**), `colorGroup`,
  `igualacionLine`, `location`, `labels`. Campos: `folio`, `status`, `source`,
  `queuePosition`, `liters` (Float), `productionTimeMinutes`, timestamps de ciclo.
- **`User`** — cuentas de sistema con `role` (enum `Role`).
- **`Igualador` / `Vendedor`** — personas físicas (`nombre`, `activo`), FK nullable desde Order.
- **`ColorGroup`** (familias de color) y **`IgualacionLine`** (catálogo ~266 códigos).
- **`Label`** (JSON de etiqueta), **`AuditLog`**, **`Location`**, **`FolioSequence`**.
- **Enums:** `Role`, `OrderStatus`, `OrderSource`, `AuditAction`.

## 5. Autenticación & Seguridad
- **Roles:** `ADMIN`, `FACTURACION`, `IGUALADOR`, `VENDEDOR_READONLY`.
- **Sesión:** JWT; `jwt`/`session` callbacks inyectan `id`, `role`, `locationId`
  (`lib/auth.config.ts`). Password = SHA-256 (`lib/auth.ts`).
  > ⚠️ Hash SHA-256 sin sal: si se endurece seguridad, migrar a bcrypt/argon2.
- **`middleware.ts`** (matcher `/dashboard/:path*`, `/api/:path*`):
  - Públicas: `/login`, `/api/auth/*`.
  - Sin sesión → redirige a `/login`.
  - **Gate por rol y prefijo** (`ROLE_ALLOWED_PREFIXES`): p.ej. FACTURACION solo
    `/dashboard/pedidos` y `/dashboard/clientes`; IGUALADOR producción+pedidos;
    `/dashboard` (home KPIs) solo ADMIN. Cada rol tiene dashboard default.
- **Doble defensa:** además del middleware, **cada route handler** valida con
  `requireRole(...)` y helpers `canX(role)` de `lib/permissions.ts`. La query de
  pedidos hace *scoping* (VENDEDOR_READONLY ve solo los suyos).
- Sidebar (`components/sidebar.tsx`) filtra el nav por `roles`.

## 6. Guía de Desarrollo Rápido
```bash
npm install                      # postinstall corre 'prisma generate'
npm run dev                      # Next dev server
npx prisma migrate dev --name x  # crear+aplicar migración en local
npx prisma migrate deploy        # aplicar migraciones en prod (Render Shell)
npm run db:seed                  # poblar datos (prisma/seed.ts)
npm run db:studio                # Prisma Studio
npm run build && npm start       # build producción
```
**Variables de entorno:** ver `.env.example`.

**Regla de oro:** todo cambio en `schema.prisma` requiere una migración commiteada;
el deploy de Render la aplica vía `prisma migrate deploy` en el `buildCommand`.
