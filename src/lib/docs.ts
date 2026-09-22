/**
 * Office documents. When the user asks for a Word / Excel / PowerPoint / PDF
 * deliverable, the model emits a <doc> block with structured content and the
 * Files tab turns it into a real, downloadable file in the browser. Uploaded
 * images are referenced by __ASSET_n__ tokens and embedded into the file.
 */

export type DocFormat = "docx" | "pdf" | "xlsx" | "pptx";

export const DOC_FORMATS: DocFormat[] = ["docx", "pdf", "xlsx", "pptx"];

export type DocTable = { headers: string[]; rows: string[][] };

export type DocSection = {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: DocTable;
  /** __ASSET_n__ token or image URL shown inside this section. */
  image?: string;
  imageCaption?: string;
};

export type DocSpec = {
  id: string;
  /** File name without extension. */
  name: string;
  formats: DocFormat[];
  title: string;
  subtitle?: string;
  /** __ASSET_n__ token for a logo / cover image on the first page. */
  logo?: string;
  sections: DocSection[];
};

export type DocAsset = { token: string; url: string };

/** Turns an __ASSET_n__ token inside a document into the real uploaded image. */
export function resolveDocImage(value: string | undefined, assets: DocAsset[]): string | null {
  if (!value) return null;
  const asset = assets.find((item) => value.includes(item.token));
  if (asset) return asset.url;
  return /^(data:|https?:)/.test(value) ? value : null;
}

const DOC_BLOCK = /<doc>([\s\S]*?)<\/doc>/g;

function slug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "document"
  );
}

/** Parses <doc> blocks out of a (possibly still streaming) model response. */
export function parseDocs(text: string): DocSpec[] {
  const docs: DocSpec[] = [];
  DOC_BLOCK.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = DOC_BLOCK.exec(text)) !== null) {
    try {
      const raw = JSON.parse((match[1] ?? "").trim()) as Partial<DocSpec>;
      if (!raw.title && !raw.name) continue;
      const title = String(raw.title ?? raw.name);
      const formats = (Array.isArray(raw.formats) ? raw.formats : ["pdf"])
        .map((f) => String(f).toLowerCase() as DocFormat)
        .filter((f) => DOC_FORMATS.includes(f));
      docs.push({
        id: slug(String(raw.name ?? title)),
        name: slug(String(raw.name ?? title)),
        title,
        ...(raw.subtitle ? { subtitle: String(raw.subtitle) } : {}),
        ...(raw.logo ? { logo: String(raw.logo) } : {}),
        formats: formats.length > 0 ? formats : ["pdf"],
        sections: Array.isArray(raw.sections) ? (raw.sections as DocSection[]) : [],
      });
    } catch {
      /* block still streaming or malformed — ignore */
    }
  }

  return docs;
}

export const DOC_LABEL: Record<DocFormat, string> = {
  docx: "Word",
  pdf: "PDF",
  xlsx: "Excel",
  pptx: "PowerPoint",
};

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

type LoadedImage = {
  dataUrl: string;
  bytes: Uint8Array;
  width: number;
  height: number;
  /** "png" | "jpg" */
  ext: "png" | "jpg";
};

/** Loads an image (data URL or remote) and normalises it for the file writers. */
async function loadImage(source: string, maxWidth = 520): Promise<LoadedImage | null> {
  try {
    const response = await fetch(source);
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsDataURL(blob);
    });

    const size = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: maxWidth, height: maxWidth * 0.6 });
      img.src = dataUrl;
    });

    const scale = Math.min(1, maxWidth / Math.max(1, size.width));
    const buffer = await blob.arrayBuffer();

    return {
      dataUrl,
      bytes: new Uint8Array(buffer),
      width: Math.round(size.width * scale),
      height: Math.round(size.height * scale),
      ext: blob.type.includes("png") ? "png" : "jpg",
    };
  } catch {
    return null;
  }
}

/** Re-encodes any image as a JPEG data URL (PDF writer is picky about PNGs). */
async function toJpeg(dataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) return resolve(null);
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function buildDocx(spec: DocSpec, assets: DocAsset[]): Promise<Blob> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    ImageRun,
    HeadingLevel,
    AlignmentType,
    Table,
    TableRow,
    TableCell,
    WidthType,
  } = await import("docx");

  const children: unknown[] = [];

  const logo = await loadImage(resolveDocImage(spec.logo, assets) ?? "", 180);
  if (logo) {
    children.push(
      new Paragraph({
        children: [
          new ImageRun({
            type: logo.ext === "png" ? "png" : "jpg",
            data: logo.bytes,
            transformation: { width: logo.width, height: logo.height },
            altText: { title: spec.title, description: spec.title, name: spec.title },
          }),
        ],
      }),
    );
  }

  children.push(new Paragraph({ text: spec.title, heading: HeadingLevel.TITLE }));
  if (spec.subtitle) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: spec.subtitle, italics: true })] }),
    );
  }

  for (const section of spec.sections) {
    if (section.heading) {
      children.push(new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_1 }));
    }
    for (const text of section.paragraphs ?? []) children.push(new Paragraph({ text }));
    for (const text of section.bullets ?? []) {
      children.push(new Paragraph({ text, bullet: { level: 0 } }));
    }

    const picture = await loadImage(resolveDocImage(section.image, assets) ?? "");
    if (picture) {
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              type: picture.ext === "png" ? "png" : "jpg",
              data: picture.bytes,
              transformation: { width: picture.width, height: picture.height },
              altText: {
                title: section.imageCaption ?? section.heading ?? "Image",
                description: section.imageCaption ?? section.heading ?? "Image",
                name: section.imageCaption ?? section.heading ?? "Image",
              },
            }),
          ],
        }),
      );
      if (section.imageCaption) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text: section.imageCaption, italics: true, size: 18 })],
          }),
        );
      }
    }

    if (section.table) {
      const { headers, rows } = section.table;
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headers, ...rows].map(
            (row, index) =>
              new TableRow({
                children: row.map(
                  (cell) =>
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [new TextRun({ text: String(cell), bold: index === 0 })],
                        }),
                      ],
                    }),
                ),
              }),
          ),
        }),
      );
      children.push(new Paragraph({ text: "" }));
    }
  }

  const doc = new Document({ sections: [{ children: children as never }] });
  return Packer.toBlob(doc);
}

async function buildPdf(spec: DocSpec, assets: DocAsset[]): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  let y = margin + 8;

  const nextPage = (needed = 24) => {
    if (y + needed > pdf.internal.pageSize.getHeight() - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  const write = (text: string, size: number, style: "normal" | "bold" | "italic") => {
    pdf.setFont("helvetica", style);
    pdf.setFontSize(size);
    for (const line of pdf.splitTextToSize(text, width) as string[]) {
      nextPage(size + 6);
      pdf.text(line, margin, y);
      y += size + 5;
    }
  };

  const place = async (source: string | null, maxWidth: number) => {
    const image = await loadImage(source ?? "", maxWidth);
    if (!image) return;
    // jsPDF cannot decode every PNG variant, so re-encode through a canvas.
    const jpeg = await toJpeg(image.dataUrl);
    if (!jpeg) return;
    const w = Math.min(maxWidth, width);
    const h = (image.height / Math.max(1, image.width)) * w;
    nextPage(h + 12);
    pdf.addImage(jpeg, "JPEG", margin, y, w, h);
    y += h + 12;
  };

  await place(resolveDocImage(spec.logo, assets), 140);
  write(spec.title, 22, "bold");
  if (spec.subtitle) write(spec.subtitle, 12, "italic");
  y += 8;

  for (const section of spec.sections) {
    if (section.heading) {
      y += 10;
      write(section.heading, 15, "bold");
    }
    for (const text of section.paragraphs ?? []) {
      write(text, 11, "normal");
      y += 4;
    }
    for (const text of section.bullets ?? []) write(`•  ${text}`, 11, "normal");

    await place(resolveDocImage(section.image, assets), 360);
    if (section.image && section.imageCaption) write(section.imageCaption, 9, "italic");

    if (section.table) {
      nextPage(80);
      autoTable(pdf, {
        head: [section.table.headers],
        body: section.table.rows,
        startY: y + 6,
        margin: { left: margin, right: margin },
        styles: { fontSize: 10, cellPadding: 6 },
        headStyles: { fillColor: [24, 24, 27] },
      });
      y =
        ((pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) +
        14;
    }
  }

  return pdf.output("blob");
}

async function buildXlsx(spec: DocSpec, assets: DocAsset[]): Promise<Blob> {
  const mod = (await import("exceljs")) as unknown as {
    default?: { Workbook: new () => never };
    Workbook?: new () => never;
  };
  const ExcelJS = (mod.default ?? mod) as { Workbook: new () => never };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workbook: any = new ExcelJS.Workbook();

  const addImage = async (sheet: unknown, source: string | null, row: number) => {
    const image = await loadImage(source ?? "", 260);
    if (!image) return;
    const id = workbook.addImage({
      base64: image.dataUrl,
      extension: image.ext === "png" ? "png" : "jpeg",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sheet as any).addImage(id, {
      tl: { col: 0, row },
      ext: { width: image.width, height: image.height },
    });
  };

  const tables = spec.sections.filter((section) => section.table);

  if (tables.length > 0) {
    for (const [index, section] of tables.entries()) {
      const sheet = workbook.addWorksheet((section.heading ?? `Sheet ${index + 1}`).slice(0, 28));
      const table = section.table!;
      const header = sheet.addRow(table.headers);
      header.font = { bold: true };
      header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
      for (const row of table.rows) sheet.addRow(row);
      sheet.columns.forEach((column: { width?: number }) => {
        column.width = 24;
      });
      await addImage(sheet, resolveDocImage(section.image, assets), table.rows.length + 3);
    }
    const first = workbook.worksheets[0];
    if (first) await addImage(first, resolveDocImage(spec.logo, assets), 0);
  } else {
    const sheet = workbook.addWorksheet("Document");
    sheet.addRow([spec.title]).font = { bold: true, size: 14 };
    if (spec.subtitle) sheet.addRow([spec.subtitle]);
    for (const section of spec.sections) {
      sheet.addRow([]);
      if (section.heading) sheet.addRow([section.heading]).font = { bold: true };
      for (const text of section.paragraphs ?? []) sheet.addRow([text]);
      for (const text of section.bullets ?? []) sheet.addRow([`• ${text}`]);
    }
    sheet.columns.forEach((column: { width?: number }) => {
      column.width = 60;
    });
    await addImage(sheet, resolveDocImage(spec.logo, assets), sheet.rowCount + 2);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

async function buildPptx(spec: DocSpec, assets: DocAsset[]): Promise<Blob> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pptx: any = new (PptxGenJS as unknown as new () => never)();
  pptx.layout = "LAYOUT_16x9";

  const cover = pptx.addSlide();
  cover.background = { color: "111827" };
  const logo = await loadImage(resolveDocImage(spec.logo, assets) ?? "", 200);
  if (logo) {
    const w = 1.6;
    cover.addImage({ data: logo.dataUrl, x: 0.6, y: 0.5, w, h: (logo.height / logo.width) * w });
  }
  cover.addText(spec.title, {
    x: 0.6,
    y: 2.0,
    w: 8.8,
    fontSize: 40,
    bold: true,
    color: "FFFFFF",
  });
  if (spec.subtitle) {
    cover.addText(spec.subtitle, { x: 0.6, y: 3.2, w: 8.8, fontSize: 18, color: "9CA3AF" });
  }

  for (const section of spec.sections) {
    const slide = pptx.addSlide();
    slide.addText(section.heading ?? spec.title, {
      x: 0.6,
      y: 0.5,
      w: 8.8,
      fontSize: 28,
      bold: true,
      color: "111827",
    });

    const picture = await loadImage(resolveDocImage(section.image, assets) ?? "", 480);
    const textWidth = picture ? 4.9 : 8.8;

    const body = [
      ...(section.paragraphs ?? []).map((text) => ({ text, options: { bullet: false } })),
      ...(section.bullets ?? []).map((text) => ({ text, options: { bullet: true } })),
    ];
    if (body.length > 0) {
      slide.addText(body, { x: 0.6, y: 1.5, w: textWidth, h: 3.6, fontSize: 16, color: "374151" });
    }
    if (picture) {
      const w = 3.6;
      slide.addImage({
        data: picture.dataUrl,
        x: 5.7,
        y: 1.5,
        w,
        h: Math.min(3.6, (picture.height / picture.width) * w),
      });
    }
    if (section.table) {
      slide.addTable([section.table.headers, ...section.table.rows], {
        x: 0.6,
        y: body.length > 0 ? 3.4 : 1.5,
        w: textWidth,
        fontSize: 12,
        border: { pt: 1, color: "E5E7EB" },
      });
    }
  }

  return (await pptx.write({ outputType: "blob" })) as Blob;
}

/** Builds the real office file in the browser and downloads it. */
export async function downloadDoc(spec: DocSpec, format: DocFormat, assets: DocAsset[] = []) {
  const blob =
    format === "docx"
      ? await buildDocx(spec, assets)
      : format === "pdf"
        ? await buildPdf(spec, assets)
        : format === "xlsx"
          ? await buildXlsx(spec, assets)
          : await buildPptx(spec, assets);

  download(blob, `${spec.name}.${format}`);
}

/** Downloads one of the generated website files. */
export function downloadFile(path: string, content: string) {
  download(
    new Blob([content], { type: "text/plain;charset=utf-8" }),
    path.split("/").pop() ?? path,
  );
}
