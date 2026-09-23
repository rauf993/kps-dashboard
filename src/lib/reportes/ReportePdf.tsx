import { Document, Font, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { esResaltada, parsearMarkdown, textoPlano, type Bloque } from "./markdown";

// Documento PDF corporativo de KPS AI. El markdown aporta el contenido;
// este componente define la maquetación y la paginación A4.
// Geometría de la página (A4 595.28pt menos 44pt de margen a cada lado) y
// medidas aproximadas de Hanken Grotesk. Con estos números calculamos anchos de
// columna en PUNTOS: los porcentajes proporcionales dejaban columnas más
// estrechas que su propio contenido, la fila se desbordaba y react-pdf
// terminaba escribiendo una posición corrupta que rompe el render entero.
const ANCHO_UTIL = 595.28 - 88;
const ALTO_UTIL = (841.89 - 88 - 52) * 0.94; // margen de seguridad en la estimación
const INTERLINEA = 12.75; // 8.5pt * 1.5
const ANCHO_CARACTER = 4.8; // ~8.5pt Hanken Grotesk
const PADDING_CELDA = 5;
const TROZO_PALABRA = 8; // una palabra sin espacios se parte en trozos de 8
const RE_TROZO = /.{1,8}/g;
const ANCHO_MINIMO = TROZO_PALABRA * ANCHO_CARACTER + PADDING_CELDA * 2;

// Sin esta partición, una palabra más ancha que su columna no se puede cortar
// y desborda la fila.
Font.registerHyphenationCallback((palabra) =>
  palabra.length > TROZO_PALABRA ? (palabra.match(RE_TROZO) ?? [palabra]) : [palabra]
);

const fuentesRegistradas = new Set<string>();

// Se llama al descargar, con la URL pública del sitio. En las pruebas también
// admite la ruta local de public; registrar una sola vez evita repetir fuentes.
export function registrarFuentesReporte(base: string) {
  if (fuentesRegistradas.has(base)) return;
  Font.register({ family: "Hanken", fonts: [
    { src: `${base}/fonts/pdf/hanken-regular.ttf`, fontWeight: 400 },
    { src: `${base}/fonts/pdf/hanken-bold.ttf`, fontWeight: 700 },
  ] });
  Font.register({ family: "Plex Mono", fonts: [
    { src: `${base}/fonts/pdf/ibm-plex-mono-regular.ttf`, fontWeight: 400 },
    { src: `${base}/fonts/pdf/ibm-plex-mono-semibold.ttf`, fontWeight: 600 },
  ] });
  fuentesRegistradas.add(base);
}

const C = {
  tinta: "#1d2638",
  tinta2: "#526077",
  tinta3: "#8290a5",
  linea: "#d9e1ec",
  lineaSuave: "#ecf0f5",
  superficie: "#f5f8fc",
  acento: "#102c86",
  azulClaro: "#e9effb",
  blanco: "#ffffff",
};

const s = StyleSheet.create({
  pagina: { paddingTop: 88, paddingBottom: 52, paddingHorizontal: 44, fontFamily: "Hanken", fontSize: 9.5, color: C.tinta2, lineHeight: 1.5 },
  paginaPortada: { paddingTop: 48, paddingBottom: 52, paddingHorizontal: 44, fontFamily: "Hanken", fontSize: 9.5, color: C.tinta2, lineHeight: 1.5 },
  portada: { flex: 1 },
  marcaFila: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logo: { width: 115, height: 41, objectFit: "contain" },
  marcaTexto: { fontFamily: "Hanken", fontWeight: 700, fontSize: 14, color: C.acento },
  tipo: { fontFamily: "Plex Mono", fontSize: 7.5, color: C.acento, letterSpacing: 1 },
  lineaAzul: { height: 3, backgroundColor: C.acento, marginTop: 20 },
  portadaCategoria: { marginTop: 80, fontFamily: "Plex Mono", fontSize: 8, color: C.acento, letterSpacing: 1.2 },
  portadaTitulo: { marginTop: 14, fontSize: 30, fontWeight: 700, color: C.tinta, lineHeight: 1.12 },
  portadaSubtitulo: { marginTop: 15, fontSize: 12, color: C.tinta2, lineHeight: 1.45 },
  referencia: { marginTop: 25, fontFamily: "Plex Mono", fontSize: 8, color: C.acento },
  metadatos: { marginTop: 36, paddingTop: 16, flexDirection: "row", borderTopWidth: 1, borderTopColor: C.linea },
  metadato: { flex: 1, paddingRight: 12 },
  metaEtiqueta: { fontFamily: "Plex Mono", fontSize: 7, color: C.tinta3, textTransform: "uppercase", letterSpacing: .6, marginBottom: 5 },
  metaValor: { fontSize: 9, color: C.tinta, fontWeight: 700 },
  contexto: { marginTop: 28, padding: 15, backgroundColor: C.superficie },
  contextoTitulo: { fontFamily: "Plex Mono", fontSize: 7, color: C.acento, letterSpacing: .7, marginBottom: 8 },
  contextoFila: { flexDirection: "row", marginBottom: 4 },
  contextoEtiqueta: { width: 105, fontSize: 8.5, color: C.tinta3 },
  contextoValor: { flex: 1, fontSize: 8.5, color: C.tinta },
  metrics: { flexDirection: "row", marginTop: 28, backgroundColor: C.azulClaro, paddingVertical: 17, paddingHorizontal: 13 },
  metrica: { flex: 1, paddingRight: 9 },
  metricaValor: { fontFamily: "Plex Mono", fontSize: 14.5, fontWeight: 600, color: C.acento },
  metricaUnidad: { fontSize: 8, color: C.tinta2 },
  metricaEtiqueta: { fontFamily: "Plex Mono", fontSize: 6.5, color: C.tinta2, marginTop: 5, textTransform: "uppercase" },
  encabezado: { position: "absolute", top: 27, left: 44, right: 44 },
  encabezadoTitulo: { fontFamily: "Plex Mono", fontSize: 7, color: C.tinta2, textAlign: "right", maxWidth: 320 },
  encabezadoLinea: { height: 1, backgroundColor: C.linea, marginTop: 10 },
  reglaPortada: { height: 1, backgroundColor: C.linea },
  h1: { fontSize: 14, fontWeight: 700, color: C.tinta, marginBottom: 8 },
  h2Fila: { flexDirection: "row", alignItems: "center", marginBottom: 9 },
  h2Numero: { fontFamily: "Plex Mono", fontSize: 9, fontWeight: 600, color: C.acento, width: 27 },
  h2: { fontSize: 12, fontWeight: 700, color: C.tinta },
  h3: { fontSize: 9.5, fontWeight: 700, color: C.tinta, marginBottom: 5 },
  parrafo: { marginBottom: 11 },
  separador: { height: 1, backgroundColor: C.lineaSuave, marginVertical: 12 },
  lista: { marginBottom: 11, paddingLeft: 2 },
  listaItem: { flexDirection: "row", marginBottom: 3 },
  listaVinneta: { width: 14, color: C.acento },
  listaTexto: { flex: 1 },
  tabla: { marginBottom: 18 },
  grupoFilas: { marginBottom: 0 },
  filaEncabezado: { flexDirection: "row", backgroundColor: C.acento },
  row: { flexDirection: "row" },
  filaAlterna: { backgroundColor: C.superficie },
  filaTotal: { backgroundColor: C.azulClaro },
  celdaEncabezado: { paddingVertical: 7, paddingHorizontal: PADDING_CELDA, fontFamily: "Plex Mono", fontSize: 6.6, fontWeight: 600, letterSpacing: .2, color: C.blanco, textTransform: "uppercase" },
  celda: { paddingVertical: 5.5, paddingHorizontal: PADDING_CELDA, fontSize: 8.5, color: C.tinta2 },
  celdaFuerte: { color: C.tinta, fontWeight: 700 },
  grafica: { marginBottom: 20, padding: 14, backgroundColor: C.superficie },
  graficaTitulo: { fontSize: 10, fontWeight: 700, color: C.tinta, marginBottom: 10 },
  graficaFila: { flexDirection: "row", alignItems: "center", marginBottom: 7 },
  graficaEtiqueta: { width: 105, fontSize: 8, color: C.tinta2 },
  graficaPista: { flex: 1, height: 8, flexDirection: "row", backgroundColor: C.azulClaro },
  graficaMitadIzquierda: { flex: 1, flexDirection: "row", justifyContent: "flex-end", borderRightWidth: 1, borderRightColor: C.tinta3 },
  graficaMitadDerecha: { flex: 1 },
  graficaBarra: { height: 8, backgroundColor: C.acento },
  graficaBarraNegativa: { height: 8, backgroundColor: C.tinta2 },
  graficaValor: { width: 76, textAlign: "right", fontFamily: "Plex Mono", fontSize: 7.3, color: C.tinta },
  pie: { position: "absolute", bottom: 24, left: 44, right: 44, fontFamily: "Plex Mono", fontSize: 7, color: C.tinta3 },
  pieFila: { flexDirection: "row", justifyContent: "space-between", paddingTop: 7 },
});

// react-pdf Image no admite alt; el logo se acompaña de la marca en el documento.
function Marca({ logoSrc }: { logoSrc?: string }) {
  // eslint-disable-next-line jsx-a11y/alt-text
  return logoSrc ? <Image src={logoSrc} style={s.logo} /> : <Text style={s.marcaTexto}>GROUP KPS</Text>;
}

function Portada({ bloque, generadoEl, usuario, zonaHoraria, logoSrc }: {
  bloque: Extract<Bloque, { tipo: "portada" }>;
  generadoEl: string;
  usuario: string;
  zonaHoraria: string;
  logoSrc?: string;
}) {
  const { title, subtitle, reference, context, metrics } = bloque.spec;
  return (
    <View style={s.portada}>
      <View style={s.marcaFila}>
        <Marca logoSrc={logoSrc} />
        <Text style={s.tipo}>KPS AI · REPORTE</Text>
      </View>
      <View style={s.lineaAzul} />
      <Text style={s.portadaCategoria}>INFORME GENERADO POR KPS AI</Text>
      <Text style={s.portadaTitulo}>{title}</Text>
      {subtitle ? <Text style={s.portadaSubtitulo}>{subtitle}</Text> : null}
      {reference ? <Text style={s.referencia}>REF. {reference}</Text> : null}
      <View style={s.metadatos}>
        <View style={s.metadato}><Text style={s.metaEtiqueta}>Generado el</Text><Text style={s.metaValor}>{generadoEl}</Text></View>
        <View style={s.metadato}><Text style={s.metaEtiqueta}>Usuario</Text><Text style={s.metaValor}>{usuario}</Text></View>
        <View style={s.metadato}><Text style={s.metaEtiqueta}>Zona horaria</Text><Text style={s.metaValor}>{zonaHoraria}</Text></View>
      </View>
      {context?.length ? (
        <View style={s.contexto}>
          <Text style={s.contextoTitulo}>CONTEXTO DEL REPORTE</Text>
          {context.map((item, i) => <View key={i} style={s.contextoFila}>
            <Text style={s.contextoEtiqueta}>{item.label}</Text>
            <Text style={s.contextoValor}>{item.value}</Text>
          </View>)}
        </View>
      ) : null}
      {metrics?.length ? <View style={s.metrics}>
        {metrics.map((m, i) => <View key={i} style={s.metrica}>
          <Text><Text style={s.metricaValor}>{m.value}</Text>{m.unit ? <Text style={s.metricaUnidad}> {m.unit}</Text> : null}</Text>
          <Text style={s.metricaEtiqueta}>{m.label}</Text>
        </View>)}
      </View> : null}
    </View>
  );
}

function Grafica({ bloque }: { bloque: Extract<Bloque, { tipo: "grafica" }> }) {
  const maximo = Math.max(...bloque.spec.items.map((item) => Math.abs(item.value)), 1);
  return <View style={s.grafica}>
    <Text style={s.graficaTitulo}>{bloque.spec.title}</Text>
    {bloque.spec.items.map((item, i) => <View key={i} style={s.graficaFila}>
      <Text style={s.graficaEtiqueta}>{item.label}</Text>
      <View style={s.graficaPista}>
        <View style={s.graficaMitadIzquierda}>
          {item.value < 0 ? <View style={[s.graficaBarraNegativa, { width: `${Math.abs(item.value) / maximo * 100}%` }]} /> : null}
        </View>
        <View style={s.graficaMitadDerecha}>
          {item.value > 0 ? <View style={[s.graficaBarra, { width: `${item.value / maximo * 100}%` }]} /> : null}
        </View>
      </View>
      <Text style={s.graficaValor}>{item.value.toLocaleString("es-MX")}{bloque.spec.unit ? ` ${bloque.spec.unit}` : ""}</Text>
    </View>)}
  </View>;
}

function Filas({
  bloque,
  desde,
  hasta,
  ancho,
}: {
  bloque: Extract<Bloque, { tipo: "tabla" }>;
  desde: number;
  hasta: number;
  ancho: (i: number) => { width: number };
}) {
  const cols = bloque.encabezados.length;
  return (
    <View style={s.grupoFilas}>
      <View style={s.filaEncabezado}>
        {bloque.encabezados.map((h, i) => (
          <View key={i} style={ancho(i)}>
            <Text style={[s.celdaEncabezado, { textAlign: bloque.alineacion[i] }]}>
              {textoPlano(h)}
            </Text>
          </View>
        ))}
      </View>
      {bloque.filas.slice(desde, hasta).map((row, f) => {
        const esTotal = /^total\b/i.test(textoPlano(row[0] ?? "").trim());
        return (
        <View key={f} style={esTotal ? [s.row, s.filaTotal] : (desde + f) % 2 === 1 ? [s.row, s.filaAlterna] : s.row}>
          {Array.from({ length: cols }, (_, c) => {
            const bruta = row[c] ?? "";
            const fuerte = esTotal || esResaltada(bruta) || c === 0;
            return (
              <View key={c} style={ancho(c)}>
                <Text
                  style={[s.celda, { textAlign: bloque.alineacion[c] }, fuerte ? s.celdaFuerte : {}]}
                >
                  {textoPlano(bruta)}
                </Text>
              </View>
            );
          })}
        </View>
      );})}
    </View>
  );
}

function Tabla({ bloque }: { bloque: Extract<Bloque, { tipo: "tabla" }> }) {
  const cols = bloque.encabezados.length;
  // Anchos en PUNTOS, no en porcentaje: cada columna arranca con un mínimo
  // que garantiza que cabe el trozo de palabra más ancho, y el espacio
  // sobrante se reparte según el contenido (con raíz, para que una columna
  // larga no se coma la tabla). El padding va DENTRO del Text: si va en el
  // mismo nodo que el ancho, se suma por fuera y desborda.
  const minimum = Math.min(ANCHO_MINIMO, ANCHO_UTIL / cols);
  const pesos = bloque.encabezados.map((h, i) =>
    Math.sqrt(
      Math.min(
        Math.max(textoPlano(h).length, ...bloque.filas.map((f) => textoPlano(f[i] ?? "").length), 3),
        60
      )
    )
  );
  const suma = pesos.reduce((a, b) => a + b, 0) || 1;
  const sobrante = Math.max(ANCHO_UTIL - minimum * cols, 0);
  const anchos = pesos.map((peso) => minimum + (peso / suma) * sobrante);
  const ancho = (i: number) => ({ width: anchos[i] ?? ANCHO_UTIL / cols });

  // El reparto en páginas ya troceó la tabla: aquí se pinta entera.
  return (
    <View style={s.tabla}>
      <Filas bloque={bloque} desde={0} hasta={bloque.filas.length} ancho={ancho} />
    </View>
  );
}

function BloqueVista({ bloque }: { bloque: Bloque }) {
  switch (bloque.tipo) {
    case "portada":
      return null;
    case "grafica":
      return <Grafica bloque={bloque} />;
    case "title": {
      if (bloque.nivel === 2) {
        return (
          <View style={s.h2Fila}>
            {bloque.numero ? <Text style={s.h2Numero}>{bloque.numero.replace(/\.$/, "").padStart(2, "0")}</Text> : null}
            <Text style={s.h2} orphans={1} widows={1}>{textoPlano(bloque.texto)}</Text>
          </View>
        );
      }
      const estilo = bloque.nivel === 1 ? s.h1 : s.h3;
      return (
        <Text style={estilo} orphans={1} widows={1}>
          {textoPlano(bloque.texto)}
        </Text>
      );
    }
    case "parrafo":
      return (
        <Text style={s.parrafo} orphans={1} widows={1}>
          {textoPlano(bloque.texto)}
        </Text>
      );
    case "tabla":
      return <Tabla bloque={bloque} />;
    case "lista":
      return (
        <View style={s.lista}>
          {bloque.items.map((it, i) => (
            <View key={i} style={s.listaItem}>
              <Text style={s.listaVinneta}>{bloque.numeros?.[i] === null ? "" : bloque.ordenada ? `${bloque.numeros?.[i] ?? i + 1}.` : "—"}</Text>
              <Text style={s.listaTexto}>{textoPlano(it)}</Text>
            </View>
          ))}
        </View>
      );
    case "separador":
      return <View style={s.separador} />;
  }
}

type Anchos = number[];

// Estimación de alturas. No hace falta que sea exacta: se aplica un margen
// del 6% al alto de página, y todo lo que se calcula de más solo deja aire.
function anchosDe(bloque: Extract<Bloque, { tipo: "tabla" }>): Anchos {
  const cols = bloque.encabezados.length;
  const minimum = Math.min(ANCHO_MINIMO, ANCHO_UTIL / cols);
  const pesos = bloque.encabezados.map((h, i) =>
    Math.sqrt(
      Math.min(
        Math.max(textoPlano(h).length, ...bloque.filas.map((f) => textoPlano(f[i] ?? "").length), 3),
        60
      )
    )
  );
  const suma = pesos.reduce((a, b) => a + b, 0) || 1;
  const sobrante = Math.max(ANCHO_UTIL - minimum * cols, 0);
  return pesos.map((peso) => minimum + (peso / suma) * sobrante);
}

function lineas(texto: string, ancho: number): number {
  const porLinea = Math.max(Math.floor(ancho / ANCHO_CARACTER), 1);
  return Math.max(Math.ceil(textoPlano(texto).length / porLinea), 1);
}

function altoFila(row: string[], anchos: Anchos): number {
  const max = Math.max(
    ...anchos.map((a, c) => lineas(row[c] ?? "", a - PADDING_CELDA * 2)),
    1
  );
  return max * INTERLINEA + 11;
}

const ALTO_ENCABEZADO = 24;

function altoBloque(b: Bloque): number {
  switch (b.tipo) {
    case "portada":
      return 0;
    case "grafica":
      return 45 + b.spec.items.length * 24;
    case "title":
      return (b.nivel === 1 ? 25 : b.nivel === 2 ? 22 : 17);
    case "parrafo":
      return lineas(b.texto, ANCHO_UTIL) * 14.25 + 11;
    case "lista":
      return b.items.reduce((t, i) => t + lineas(i, ANCHO_UTIL - 16) * 14.25 + 3, 11);
    case "separador":
      return 25;
    case "tabla": {
      const anchos = anchosDe(b);
      return ALTO_ENCABEZADO + b.filas.reduce((t, f) => t + altoFila(f, anchos), 0) + 18;
    }
  }
}

/**
 * Reparte los bloques en páginas. Lo hacemos nosotros en vez de dejar que
 * react-pdf pagine: su cálculo de cortes produce coordenadas corruptas con
 * documentos de varias secciones y tablas largas, y falla el render entero.
 * Aquí ningún elemento necesita partirse — las tablas se cortan por filas y
 * el encabezado se repite en cada trozo.
 */
// react-pdf no puede paginar con seguridad un solo Text que ocupe varias
// páginas. Cada fragmento conserva el orden del párrafo original.
function dividirParrafo(texto: string): string[] {
  const partes: string[] = [];
  const palabras = texto.split(/\s+/);
  let actual = "";
  for (const palabra of palabras) {
    if (actual && actual.length + palabra.length + 1 > 900) {
      partes.push(actual);
      actual = palabra;
    } else {
      actual = actual ? `${actual} ${palabra}` : palabra;
    }
  }
  if (actual) partes.push(actual);
  return partes;
}

function repartirEnPaginas(bloques: Bloque[]): Bloque[][] {
  const paginas: Bloque[][] = [];
  let actual: Bloque[] = [];
  let usado = 0;

  const nuevaPagina = () => {
    if (actual.length) paginas.push(actual);
    actual = [];
    usado = 0;
  };

  const bloquesPaginables = bloques.flatMap((bloque): Bloque[] =>
    bloque.tipo === "parrafo"
      ? dividirParrafo(bloque.texto).map((texto) => ({ tipo: "parrafo", texto }))
      : [bloque]
  );

  for (const bloque of bloquesPaginables) {
    const alto = altoBloque(bloque);

    if (bloque.tipo === "tabla") {
      const anchos = anchosDe(bloque);
      let row = 0;
      while (row < bloque.filas.length) {
        let disponible = ALTO_UTIL - usado - ALTO_ENCABEZADO - 18;
        if (disponible < INTERLINEA * 3) {
          nuevaPagina();
          disponible = ALTO_UTIL - ALTO_ENCABEZADO - 18;
        }
        const trozo: string[][] = [];
        while (row < bloque.filas.length) {
          const h = altoFila(bloque.filas[row], anchos);
          if (trozo.length && h > disponible) break;
          trozo.push(bloque.filas[row]);
          disponible -= h;
          row++;
        }
        actual.push({ ...bloque, filas: trozo });
        usado = ALTO_UTIL - disponible;
      }
      continue;
    }

    if (bloque.tipo === "lista") {
      // Cada elemento conserva su número al continuar en otra página. Un
      // elemento extenso también puede partirse sin repetir la viñeta.
      const entradas = bloque.items.flatMap((item, i) =>
        dividirParrafo(item).map((texto, parte) => ({
          texto,
          numero: parte === 0 ? i + 1 : null,
        }))
      );
      let indice = 0;
      while (indice < entradas.length) {
        let disponible = ALTO_UTIL - usado - 11;
        if (disponible < INTERLINEA * 3) {
          nuevaPagina();
          disponible = ALTO_UTIL - 11;
        }
        const trozo: typeof entradas = [];
        while (indice < entradas.length) {
          const entrada = entradas[indice];
          const altura = lineas(entrada.texto, ANCHO_UTIL - 16) * 14.25 + 3;
          if (trozo.length && altura > disponible) break;
          trozo.push(entrada);
          disponible -= altura;
          indice++;
        }
        actual.push({
          ...bloque,
          items: trozo.map((entrada) => entrada.texto),
          numeros: trozo.map((entrada) => entrada.numero),
        });
        usado = ALTO_UTIL - disponible;
      }
      continue;
    }

    // Un título al final de la página se lleva a la siguiente con su tabla.
    const reserva = bloque.tipo === "title" ? alto + INTERLINEA * 4 : alto;
    if (usado > 0 && usado + reserva > ALTO_UTIL) nuevaPagina();
    actual.push(bloque);
    usado += alto;
  }

  if (actual.length) paginas.push(actual);
  return paginas.length ? paginas : [[]];
}

export function ReportePdf({
  title,
  markdown,
  generadoEl,
  usuario = "Usuario de KPS",
  zonaHoraria = "America/Mexico_City",
  logoSrc,
}: {
  title: string;
  markdown: string;
  generadoEl: string;
  usuario?: string;
  zonaHoraria?: string;
  logoSrc?: string;
}) {
  const bloques = parsearMarkdown(markdown);
  const portada = bloques[0]?.tipo === "portada"
    ? bloques.shift() as Extract<Bloque, { tipo: "portada" }>
    : { tipo: "portada" as const, spec: { title } };
  const paginas = repartirEnPaginas(bloques);
  const totalPaginas = paginas.length + 1;
  const pie = (numero: number) => <View style={s.pie} fixed>
    <View style={s.reglaPortada} />
    <View style={s.pieFila}>
      <Text>CONFIDENCIAL · USO INTERNO KPS</Text>
      <Text>Pág. {numero} / {totalPaginas}</Text>
    </View>
  </View>;

  return <Document title={title} author="KPS" subject="Reporte generado por KPS AI">
    <Page size="A4" style={s.paginaPortada}>
      <Portada bloque={portada} generadoEl={generadoEl} usuario={usuario} zonaHoraria={zonaHoraria} logoSrc={logoSrc} />
      {pie(1)}
    </Page>
    {paginas.map((pagina, p) => <Page key={p} size="A4" style={s.pagina}>
      <View style={s.encabezado} fixed>
        <View style={s.marcaFila}>
          <Marca logoSrc={logoSrc} />
          <Text style={s.encabezadoTitulo}>{title}</Text>
        </View>
        <View style={s.encabezadoLinea} />
      </View>
      {pagina.map((b, i) => <BloqueVista key={i} bloque={b} />)}
      {pie(p + 2)}
    </Page>)}
  </Document>;
}
