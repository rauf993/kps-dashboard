import { createElement } from "react";
import { join } from "node:path";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError, parseJson } from "@/lib/api";
import { requireModule } from "@/lib/auth/guards";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";

export const runtime = "nodejs";
export const maxDuration = 60;

const cuerpoSchema = z.object({
  title: z.string().trim().min(1).max(200),
  markdown: z.string().min(1).max(30_000),
  zonaHoraria: z.string().min(1).max(80),
});

// El PDF se arma en el servidor para conservar la CSP del navegador.
// El nombre de usuario se obtiene de la sesión, nunca del cuerpo enviado.
export async function POST(request: NextRequest) {
  try {
    const session = await requireModule("cronos-ia");
    const body = await parseJson(request, cuerpoSchema);
    let generadoEl: string;
    try {
      generadoEl = new Intl.DateTimeFormat("es-MX", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: body.zonaHoraria,
      }).format(new Date());
    } catch {
      throw new ApiError(422, "ZONA_HORARIA", "Zona horaria inválida");
    }

    await connectDB();
    const usuario = await User.findById(session.id).select({ name: 1, active: 1 }).lean();
    if (!usuario?.active) throw new ApiError(401, "NO_AUTENTICADO", "Sesión no válida");

    const [{ pdf }, { ReportePdf, registrarFuentesReporte }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("@/lib/reportes/ReportePdf"),
    ]);
    const publicDir = join(process.cwd(), "public");
    registrarFuentesReporte(publicDir);
    const documento = createElement(ReportePdf, {
      title: body.title,
      markdown: body.markdown,
      generadoEl,
      usuario: usuario.name,
      zonaHoraria: body.zonaHoraria,
      logoSrc: join(publicDir, "kps-logo-wide.png"),
    });
    const blob = await pdf(documento).toBlob();
    return new Response(await blob.arrayBuffer(), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="reporte-kps.pdf"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
