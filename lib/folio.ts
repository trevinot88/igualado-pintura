import { prisma } from "./prisma";

/**
 * Generates a folio in format YYMM-NNNNN using atomic Prisma transaction.
 * Resets monthly.
 */
export async function generateFolio(): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `${yy}${mm}`;

  const sequence = await prisma.$transaction(async (tx) => {
    const seq = await tx.folioSequence.upsert({
      where: { id: prefix },
      create: { id: prefix, lastValue: 1 },
      update: { lastValue: { increment: 1 } },
    });
    return seq.lastValue;
  });

  return `${prefix}-${String(sequence).padStart(5, "0")}`;
}
