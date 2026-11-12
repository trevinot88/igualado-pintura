-- Agrega los valores faltantes del enum AuditAction que el schema de
-- Prisma ya declara pero la base de datos aún no tiene. Sin esto, los
-- registros de auditoría (p. ej. WHATSAPP_SENT al enviar mensajes)
-- fallan con: invalid input value for enum "AuditAction".
ALTER TYPE "AuditAction" ADD VALUE 'ORDER_EDITED';
ALTER TYPE "AuditAction" ADD VALUE 'ORDER_PAUSED';
ALTER TYPE "AuditAction" ADD VALUE 'ORDER_QUEUE_MOVED';
ALTER TYPE "AuditAction" ADD VALUE 'WHATSAPP_SENT';
