import { prisma } from "./prisma";

/**
 * Generates a folio in format YYMMDD-XX using atomic Prisma transaction.
 * Resets daily.
 */
export async function generateFolio(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const prefix = `${yy}${mm}${dd}`;

  const sequence = await prisma.$transaction(async (tx) => {
    const seq = await tx.folioSequence.upsert({
      where: { id: prefix },
      create: { id: prefix, lastValue: 1 },
      update: { lastValue: { increment: 1 } },
    });
    return seq.lastValue;
  });

  return `${prefix}-${String(sequence).padStart(2, "0")}`;
}
