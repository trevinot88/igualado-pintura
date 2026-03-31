import { prisma } from "./prisma";

export async function calculatePrice(
  colorGroupId: string,
  liters: number
): Promise<{ pricePerLiter: number; totalPrice: number }> {
  const tier = await prisma.priceTier.findFirst({
    where: {
      colorGroupId,
      minLiters: { lte: liters },
      maxLiters: { gte: liters },
    },
    orderBy: { minLiters: "asc" },
  });

  if (!tier) {
    // Fallback: get the tier with the highest maxLiters
    const fallback = await prisma.priceTier.findFirst({
      where: { colorGroupId },
      orderBy: { maxLiters: "desc" },
    });
    if (!fallback) throw new Error("No hay precios configurados para este grupo de color");
    return {
      pricePerLiter: fallback.pricePerLiter,
      totalPrice: Math.round(fallback.pricePerLiter * liters * 100) / 100,
    };
  }

  return {
    pricePerLiter: tier.pricePerLiter,
    totalPrice: Math.round(tier.pricePerLiter * liters * 100) / 100,
  };
}
