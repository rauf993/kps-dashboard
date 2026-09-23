"use client";

import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import type { ResultadoReporte } from "@/lib/reportes/crear-reporte";
import { fetchConSesion } from "@/components/lib/api-client";

// El PDF se arma al descargar desde un endpoint autenticado. En el chat solo
// viaja el markdown; no se guardan archivos y la CSP del navegador no necesita
// permitir workers ni conexiones data/blob.
export function ReporteCard({ reporte }: { reporte: ResultadoReporte }) {
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!reporte.ok) {
    return (
      <div className="cr-reporte cr-reporte--error">
        <FileText size={15} aria-hidden />
        <span>No se pudo generar el reporte: {reporte.error}</span>
      </div>
    );
  }

  const descargar = async () => {
    setGenerando(true);
    setError(null);
    try {
      const zonaHoraria = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Mexico_City";
      const respuesta = await fetchConSesion("/api/ai/reportes/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: reporte.title ?? "Reporte",
          markdown: reporte.markdown ?? "",
          zonaHoraria,
        }),
      });
      if (!respuesta.ok) {
        const cuerpo = await respuesta.json().catch(() => null);
        throw new Error(cuerpo?.error?.message ?? "No se pudo generar el PDF");
      }
      const blob = await respuesta.blob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reporte.fileName ?? "reporte"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      // Red de seguridad: si el PDF falla, al menos entregamos el contenido
      // en markdown en vez de dejar al usuario sin nada.
      setError(
        `${e instanceof Error ? e.message : "No se pudo generar el PDF"} — se descargó el contenido en .md`
      );
      const md = new Blob([reporte.markdown ?? ""], { type: "text/markdown" });
      const url = URL.createObjectURL(md);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reporte.fileName ?? "reporte"}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div className="cr-reporte">
      <div className="cr-reporte__icono" aria-hidden>
        <FileText size={16} />
      </div>
      <div className="cr-reporte__cuerpo">
        <p className="cr-reporte__titulo">{reporte.title}</p>
        {reporte.summary ? <p className="cr-reporte__resumen">{reporte.summary}</p> : null}
        <p className="cr-reporte__meta">
          PDF · {reporte.tablas} {reporte.tablas === 1 ? "tabla" : "tablas"}
        </p>
        {error ? (
          <p className="cr-reporte__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <button type="button" className="cr-reporte__boton" onClick={descargar} disabled={generando}>
        {generando ? (
          <Loader2 size={13} className="cr-reporte__spin" aria-hidden />
        ) : (
          <Download size={13} aria-hidden />
        )}
        {generando ? "Generando…" : "Descargar"}
      </button>
    </div>
  );
}
