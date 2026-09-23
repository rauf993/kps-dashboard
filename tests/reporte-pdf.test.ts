import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const auth = vi.hoisted(() => ({ requireModule: vi.fn() }));
const database = vi.hoisted(() => ({ connectDB: vi.fn() }));
const users = vi.hoisted(() => ({ findById: vi.fn() }));

vi.mock("@/lib/auth/guards", () => ({ requireModule: auth.requireModule }));
vi.mock("@/lib/db", () => ({ connectDB: database.connectDB }));
vi.mock("@/models/User", () => ({ User: { findById: users.findById } }));

import { POST } from "@/app/api/ai/reportes/pdf/route";
import { parsearMarkdown } from "@/lib/reportes/markdown";

const markdown = `\`\`\`portada
{"title":"Reporte de prueba","metrics":[{"value":"2","label":"Cadenas"}]}
\`\`\`

## Ventas

| Cadena | Importe |
|---|---:|
| Walmart | 120 |
| San Pablo | -30 |

\`\`\`grafica
{"title":"Variación","unit":"MXN","items":[{"label":"Walmart","value":120},{"label":"San Pablo","value":-30}]}
\`\`\``;

const popplerDisponible = ["pdfinfo", "pdftotext"].every(
  (comando) => spawnSync(comando, ["-v"]).status === 0
);

describe("descarga del reporte PDF", () => {
  beforeEach(() => {
    auth.requireModule.mockResolvedValue({ id: "usuario-prueba" });
    database.connectDB.mockResolvedValue(undefined);
    users.findById.mockReturnValue({
      select: () => ({ lean: async () => ({ name: "Usuario de prueba", active: true }) }),
    });
  });

  it("conserva los valores negativos en la gráfica", () => {
    const grafica = parsearMarkdown(markdown).find((bloque) => bloque.tipo === "grafica");
    expect(grafica?.tipo === "grafica" ? grafica.spec.items.map((item) => item.value) : []).toEqual([120, -30]);
  });

  it.skipIf(!popplerDisponible)("numera las páginas reales de listas largas", async () => {
    const carpeta = mkdtempSync(join(tmpdir(), "kps-pdf-test-"));
    try {
      for (const ordenada of [false, true]) {
      const lista = Array.from({ length: 55 }, (_, i) =>
        `${ordenada ? `${i + 1}.` : "-"} Sucursal ${i + 1}: revisar disponibilidad y ajustar pedidos según las ventas observadas.`
      ).join("\n");
      const contenido = `## Observaciones\n\n${lista}\n\n| Cadena | Importe |\n|---|---:|\n| KPS | 100 |`;
      const request = new Request("http://localhost/api/ai/reportes/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Observaciones", markdown: contenido, zonaHoraria: "America/Monterrey" }),
      }) as NextRequest;
      const response = await POST(request);
      expect(response.status).toBe(200);
      const bytes = Buffer.from(await response.arrayBuffer());
      const ruta = join(carpeta, `reporte-${ordenada ? "ordenado" : "vinyetas"}.pdf`);
      writeFileSync(ruta, bytes);
      const infoResultado = spawnSync("pdfinfo", [ruta], { encoding: "utf8" });
      const textoResultado = spawnSync("pdftotext", ["-layout", ruta, "-"], { encoding: "utf8" });
      expect(infoResultado.status).toBe(0);
      expect(textoResultado.status).toBe(0);
      const info = infoResultado.stdout;
      const texto = textoResultado.stdout;
      const paginas = Number(/Pages:\s+(\d+)/.exec(info)?.[1]);
      const pies = [...texto.matchAll(/Pág\. (\d+) \/ (\d+)/g)];
      expect(paginas).toBeGreaterThan(1);
      expect(pies.map((pie) => [Number(pie[1]), Number(pie[2])])).toEqual(
        Array.from({ length: paginas }, (_, i) => [i + 1, paginas])
      );
      expect(texto).toContain("Sucursal 55");
      if (ordenada) expect(texto).toContain("55. Sucursal 55");
      }
    } finally {
      rmSync(carpeta, { recursive: true, force: true });
    }
  });

  it("genera un PDF real desde la ruta autenticada", async () => {
    const request = new Request("http://localhost/api/ai/reportes/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Reporte de prueba", markdown, zonaHoraria: "America/Monterrey" }),
    }) as NextRequest;

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(10_000);
    expect(auth.requireModule).toHaveBeenCalledWith("cronos-ia");
  });
});
