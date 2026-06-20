# Manual de Operación del Sistema

### Plataforma de Gestión de Igualación de Pintura — Pinturas Dyrlo

---

## 1. Introducción y Bienvenida

Bienvenido a su nueva plataforma de gestión operativa. Este sistema centraliza y
automatiza el ciclo completo de un pedido de igualación de pintura —desde su
captura en mostrador o ventas, pasando por la producción en el taller, hasta la
entrega y la notificación al cliente.

**¿Qué transforma para su empresa?**

- **Trazabilidad total** — cada pedido tiene un folio único y un historial auditable de quién hizo qué y cuándo.
- **Orden justo en el taller** — la fila de producción respeta el orden de llegada (primero en entrar, primero en salir), evitando favoritismos y cuellos de botella.
- **Atención al cliente automatizada** — cuando un pedido queda listo, el cliente recibe un **WhatsApp automático** avisándole que puede recogerlo.
- **Decisiones con datos** — tableros de control con indicadores de productividad, tiempos y volúmenes por color, vendedor y operador.

---

## 2. Guía de Operación por Módulos

### 2.1 Ingreso al Sistema

1. Abra la plataforma en su navegador.
2. Ingrese su **correo** y **contraseña**.
3. El sistema lo dirige automáticamente a la pantalla principal **según su rol**.

> 💡 Cada usuario ve únicamente los módulos que le corresponden. El menú lateral
> izquierdo muestra solo las opciones disponibles para su perfil.

### 2.2 Perfiles de Usuario

| Perfil | Para qué sirve | Qué puede hacer |
| :--- | :--- | :--- |
| **Administrador** | Dirección / supervisión | Acceso total: tableros, usuarios, catálogos, reordenar y pausar la fila, auditoría. |
| **Facturación** | Mostrador / captura | Crear pedidos y clientes; marcar pedidos como entregados. |
| **Igualador** | Taller / producción | Iniciar y completar pedidos en la fila de producción. |
| **Vendedor (consulta)** | Ventas | Consultar el estado de **sus** pedidos. |

### 2.3 Tablero Principal (Dashboard)

Pantalla de inicio del Administrador. Muestra de un vistazo los **indicadores clave**:
pedidos en cola, tiempo promedio de igualación, pedidos completados hoy y tasa de
colaboración (cuántos pedidos requirieron un ayudante).

### 2.4 Captura de un Nuevo Pedido

1. Menú → **Nuevo Pedido**.
2. Seleccione el **cliente** (o créelo desde el módulo Clientes).
3. Elija el **grupo de color**, el **código de igualación** y escriba el **color**.
4. Indique los **litros** y el **canal** de venta (Mostrador, Ventas, Redes).
   - Si el canal es **Ventas**, seleccione al **vendedor** correspondiente.
5. Guarde. El sistema genera automáticamente:
   - Un **folio único** del día (formato `AAMMDD-NN`).
   - La **posición en la fila** de producción.
   - La **asignación del igualador** de turno (rotación automática y justa).

### 2.5 Producción (Taller)

La pantalla de **Producción** muestra la fila de pedidos en orden de llegada.

1. **Iniciar** el siguiente pedido de la fila. El sistema **exige seleccionar quién lo está procesando** (operador físico) antes de continuar.
2. Trabajar la igualación.
3. **Completar** el pedido. Opcionalmente registre un **ayudante** y el tiempo empleado.

Al completar, el sistema **automáticamente**:

- Genera la **etiqueta** del pedido.
- Envía el **WhatsApp de "pedido listo"** al cliente.

> ⚠️ **Regla de la fila:** los igualadores deben atender los pedidos **en orden**.
> No es posible adelantarse a un pedido que entró antes. Solo el Administrador
> puede reordenar la fila.

### 2.6 Pedidos

Listado completo con **búsqueda** (folio, color o cliente) y **filtros** (estado,
canal, fecha). Cada pedido muestra su estatus y permite ver su detalle e historial.

### 2.7 Entrega

Cuando el cliente recoge su pedido, **Facturación** o **Administrador** lo marcan
como **Entregado**, cerrando el ciclo.

### 2.8 Catálogos y Administración *(solo Administrador)*

| Módulo | Función |
| :--- | :--- |
| **Clientes** | Alta y edición de la base de clientes. |
| **Códigos de IG** | Catálogo de líneas/códigos de igualación. |
| **Usuarios** | Alta de cuentas y asignación de roles. |
| **Auditoría** | Bitácora cronológica de todas las acciones del sistema. |

---

## 3. Gestión de Alertas y Excepciones

### 3.1 Cómo leer los estatus de un pedido

| Estatus | Significado | Acción esperada |
| :--- | :--- | :--- |
| **Pendiente** | En la fila, aún no inicia | Esperar su turno en producción. |
| **En proceso** | Un operador lo está igualando | En curso. |
| **Listo** | Terminado; cliente notificado por WhatsApp | Espera la recolección. |
| **Entregado** | Recogido por el cliente | Ciclo cerrado. |
| **Pausado** | Detenido por el Administrador | Requiere reanudación manual. |
| **Cancelado** | Anulado | Sin acción. |

### 3.2 Situaciones frecuentes y qué hacer

- **"Debe completar el pedido anterior en la cola"** — un operador intentó adelantarse. Atienda primero el pedido más antiguo, o pida al Administrador reordenar la fila.
- **"Debe seleccionar quién está procesando este pedido"** — no se eligió el operador físico al iniciar. Selecciónelo y reintente.
- **El cliente no recibió el WhatsApp** — el pedido **igual queda completado**. Suele deberse a un teléfono mal capturado o a la conexión del servicio de mensajería (ver Anexo). Verifique el teléfono del cliente y, si persiste, avise al administrador.
- **Pedido pausado** — solo el Administrador puede reanudarlo (vuelve a Pendiente).

### 3.3 Tableros de control (Reportes)

El módulo de **Reportes** (Administrador) permite filtrar por fechas y muestra:

- Productividad por **operador físico** (solos vs. con ayuda).
- Volumen por **vendedor**.
- **Litros** por grupo y por color.
- Distribución de pedidos por **canal**.

> 💡 Úselos para detectar cuellos de botella y planear la carga del taller.

---

## 4. Anexo Técnico para Administradores

### 4.1 Servicios en la nube (mantenimiento mensual)

| Servicio | Función | Qué vigilar |
| :--- | :--- | :--- |
| **Render** | Hospedaje de la aplicación y publicación | Que el servicio esté "Live" y los despliegues terminen sin error. |
| **PostgreSQL** | Almacena pedidos, clientes y catálogos | Espacio disponible y respaldos. |
| **Green API (WhatsApp)** | Notificaciones automáticas al cliente | Que la instancia/sesión de WhatsApp siga autorizada y con saldo. |
| **Resend (Email)** | Correos del sistema | Validez de la API y del dominio remitente. |

### 4.2 Monitoreo básico para mantener la plataforma óptima

- **Salud de la app** — la ruta `/api/health` confirma que el sistema responde.
- **Despliegues** — cada cambio publicado aplica automáticamente las actualizaciones de base de datos durante el proceso de publicación (*build*). Si un despliegue falla, la versión anterior sigue funcionando.
- **Actualizaciones de base de datos (migraciones)** — ante cualquier cambio de estructura debe ejecutarse `npx prisma migrate deploy`. En condiciones normales esto ocurre solo en el despliegue; de forma excepcional puede ejecutarse manualmente desde la consola (*Shell*) del servicio en Render.
- **Bitácora de auditoría** — el módulo de Auditoría es la fuente de verdad para revisar incidencias y actividad de usuarios.
- **Buenas prácticas** — dar de baja a usuarios que ya no laboran (desactivar, no borrar) y mantener actualizada la base de clientes y los códigos de igualación.

### 4.3 Glosario de términos

| Término | Definición |
| :--- | :--- |
| **Folio** | Identificador único de cada pedido (`AAMMDD-NN`); se reinicia cada día. |
| **Cola / Fila de producción** | Orden en que los pedidos se igualan (primero en entrar, primero en salir). |
| **Igualador (cuenta)** | El acceso al sistema de un trabajador del taller. |
| **Operador físico** | La persona real registrada que procesó el pedido (clave para los reportes de productividad). |
| **Ayudante** | Segunda persona que apoyó en la igualación de un pedido. |
| **Grupo de color / Línea de igualación** | Clasificaciones del catálogo de pintura. |
| **Estatus** | Etapa del pedido (Pendiente, En proceso, Listo, Entregado, etc.). |
| **Migración** | Actualización controlada de la estructura de la base de datos. |
| **Auditoría** | Registro histórico e inalterable de las acciones del sistema. |

---

*Documento de entrega — Plataforma de Gestión de Igualación de Pintura, Pinturas Dyrlo.*
