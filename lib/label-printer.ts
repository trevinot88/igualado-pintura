import { prisma } from "./prisma";
import { logAudit } from "./audit";

export interface LabelData {
  folio: string;
  clientName: string;
  phone?: string;
  colorGroup: string;
  colorName: string;
  liters: number;
  line?: string;
  createdAt: Date;
}

/**
 * Generates and stores a label for an order
 * Returns label data for printing
 */
export async function generateLabel(orderId: string): Promise<LabelData> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      client: true,
      colorGroup: true,
      igualacionLine: true,
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  const labelData: LabelData = {
    folio: order.folio,
    clientName: order.client.name,
    phone: order.client.phone || undefined,
    colorGroup: order.colorGroup.name,
    colorName: order.colorName,
    liters: order.liters,
    line: order.igualacionLine?.name,
    createdAt: order.createdAt,
  };

  // Save label to database
  await prisma.label.create({
    data: {
      orderId,
      content: labelData as unknown as object,
    },
  });

  // Log to audit
  await logAudit(null, "LABEL_PRINTED", "Order", orderId, {
    folio: order.folio,
  });

  return labelData;
}

/**
 * Formats label data for thermal printer (ZPL format example)
 */
export function formatLabelForPrinter(data: LabelData): string {
  // TODO: Implement actual ZPL or printer format
  // This is a placeholder example
  return `
^XA
^FO50,50^A0N,50,50^FD${data.folio}^FS
^FO50,120^A0N,30,30^FD${data.clientName}^FS
^FO50,160^A0N,25,25^FD${data.colorGroup} - ${data.colorName}^FS
^FO50,200^A0N,25,25^FD${data.liters}L${data.line ? ` - ${data.line}` : ""}^FS
^XZ
  `.trim();
}

/**
 * Sends label to printer
 */
export async function printLabel(orderId: string): Promise<boolean> {
  try {
    const labelData = await generateLabel(orderId);
    const zpl = formatLabelForPrinter(labelData);

    // TODO: Send to actual printer
    // Example with network printer:
    // await fetch(process.env.PRINTER_URL, {
    //   method: 'POST',
    //   body: zpl,
    //   headers: { 'Content-Type': 'text/plain' }
    // });

    console.log(`[Printer] Label generated for order ${labelData.folio}`);
    console.log(zpl);

    return true;
  } catch (error) {
    console.error("Error printing label:", error);
    return false;
  }
}
