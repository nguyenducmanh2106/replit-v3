import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface ExportButtonsProps {
  data: unknown;
  filename?: string;
}

function flattenForSheet(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data !== null && typeof data === "object") {
    const flat: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (v === null || typeof v !== "object") flat[k] = v;
    }
    return [flat];
  }
  return [];
}

async function exportToExcel(data: unknown, filename: string) {
  const XLSX = await import("xlsx");
  const rows = flattenForSheet(data);
  if (rows.length === 0) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Báo cáo");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

async function exportToPDF(data: unknown, filename: string) {
  const { jsPDF } = await import("jspdf");
  const rows = flattenForSheet(data);
  if (rows.length === 0) return;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFont("helvetica");

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 20;

  doc.setFontSize(14);
  doc.text(filename, margin, y);
  y += 10;

  doc.setFontSize(9);
  const keys = Object.keys(rows[0]!);

  for (const row of rows) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    const line = keys.map(k => `${k}: ${String(row[k] ?? "")}`).join("  |  ");
    const wrapped = doc.splitTextToSize(line, pageWidth - margin * 2);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 5 + 3;
  }

  doc.save(`${filename}.pdf`);
}

function exportToCSV(data: unknown, filename: string) {
  const rows = flattenForSheet(data);
  if (rows.length === 0) return;
  const keys = Object.keys(rows[0]!);
  const csvContent =
    keys.join(",") + "\n" +
    rows.map(row => keys.map(k => JSON.stringify(row[k] ?? "")).join(",")).join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportToJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportButtons({ data, filename = "report" }: ExportButtonsProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      <Button variant="outline" size="sm" onClick={() => exportToExcel(data, filename)}>
        <Download className="w-4 h-4 mr-1" />
        Excel
      </Button>
      <Button variant="outline" size="sm" onClick={() => exportToPDF(data, filename)}>
        <Download className="w-4 h-4 mr-1" />
        PDF
      </Button>
      <Button variant="outline" size="sm" onClick={() => exportToCSV(data, filename)}>
        <Download className="w-4 h-4 mr-1" />
        CSV
      </Button>
      <Button variant="outline" size="sm" onClick={() => exportToJSON(data, filename)}>
        <Download className="w-4 h-4 mr-1" />
        JSON
      </Button>
    </div>
  );
}
