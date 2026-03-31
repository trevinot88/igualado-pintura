interface LabelData {
  folio: string;
  colorName: string;
  colorGroup: string;
  clientName: string;
  liters: number;
  vendedor: string;
  date: string;
  notes?: string;
}

export function generateLabelHTML(data: LabelData): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: 4in 2in; margin: 0; }
  @media print {
    body { margin: 0; padding: 0; }
    .no-print { display: none; }
  }
  body {
    font-family: Arial, sans-serif;
    width: 4in;
    height: 2in;
    margin: 0;
    padding: 6px 10px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px solid #000;
    padding-bottom: 3px;
  }
  .logo { font-weight: bold; font-size: 14px; }
  .folio { font-size: 16px; font-weight: bold; font-family: monospace; }
  .main { flex: 1; display: flex; flex-direction: column; gap: 2px; padding: 4px 0; }
  .color-name { font-size: 18px; font-weight: bold; }
  .row { display: flex; justify-content: space-between; font-size: 11px; }
  .label { color: #555; }
  .footer { border-top: 1px solid #000; padding-top: 2px; font-size: 9px; display: flex; justify-content: space-between; }
</style>
</head>
<body>
  <div class="header">
    <span class="logo">DYRLO</span>
    <span class="folio">${data.folio}</span>
  </div>
  <div class="main">
    <div class="color-name">${data.colorName}</div>
    <div class="row">
      <span><span class="label">Grupo:</span> ${data.colorGroup}</span>
      <span><span class="label">Litros:</span> ${data.liters}L</span>
    </div>
    <div class="row">
      <span><span class="label">Cliente:</span> ${data.clientName}</span>
    </div>
    ${data.notes ? `<div class="row"><span class="label">Nota:</span> ${data.notes}</div>` : ""}
  </div>
  <div class="footer">
    <span>Vendedor: ${data.vendedor}</span>
    <span>${data.date}</span>
  </div>
</body>
</html>`;
}
