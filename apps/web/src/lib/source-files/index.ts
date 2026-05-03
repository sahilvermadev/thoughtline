import {
  GlobalWorkerOptions,
  getDocument,
  PDFWorker,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextSource } from "@/lib/agents/create-from-text";

GlobalWorkerOptions.workerSrc =
  typeof window === "undefined"
    ? new URL(
        "../../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
        import.meta.url
      ).toString()
    : "/pdf.worker.min.mjs";

export const SUPPORTED_EXTENSIONS = [
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".yaml",
  ".yml",
  ".log",
  ".py",
  ".js",
  ".ts",
  ".tsx",
  ".jsx",
  ".go",
  ".rs",
  ".rb",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".html",
  ".css",
  ".pdf",
] as const;

export const MAX_FILE_BYTES = 2_000_000;
export const MAX_URL_SOURCE_BYTES = 2_000_000;

export class UnsupportedFileError extends Error {
  constructor(filename: string) {
    super(
      `Unsupported file type: ${filename}. Attach a text-like file or a PDF.`
    );
    this.name = "UnsupportedFileError";
  }
}

export class FileTooLargeError extends Error {
  constructor(filename: string, sizeBytes: number) {
    super(
      `File ${filename} is ${sizeBytes} bytes, exceeds limit of ${MAX_FILE_BYTES}`
    );
    this.name = "FileTooLargeError";
  }
}

export class EmptyFileError extends Error {
  constructor(filename: string) {
    super(`File ${filename} is empty`);
    this.name = "EmptyFileError";
  }
}

export class UrlFetchError extends Error {
  constructor(url: string, reason: string) {
    super(`Could not ingest URL ${url}: ${reason}`);
    this.name = "UrlFetchError";
  }
}

export async function extractTextSource(file: File): Promise<TextSource> {
  if (!hasSupportedExtension(file.name)) {
    throw new UnsupportedFileError(file.name);
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new FileTooLargeError(file.name, file.size);
  }

  if (hasPdfExtension(file.name)) {
    return extractPdfTextSource(file);
  }

  const text = await file.text();
  if (text.trim().length === 0) {
    throw new EmptyFileError(file.name);
  }
  return { label: file.name, text };
}

function hasSupportedExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function hasPdfExtension(filename: string): boolean {
  return filename.toLowerCase().endsWith(".pdf");
}

async function extractPdfTextSource(file: File): Promise<TextSource> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const worker = new PDFWorker({ port: null });

  try {
    const document = await getDocument({
      data: bytes,
      worker,
      disableRange: true,
      disableStream: true,
      disableFontFace: true,
      useSystemFonts: true,
      useWorkerFetch: false,
      stopAtErrors: true,
      verbosity: 0,
    }).promise;

    const pages: string[] = [];
    for (let index = 1; index <= document.numPages; index += 1) {
      const page = await document.getPage(index);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (pageText) pages.push(pageText);
    }

    const text = pages.join("\n\n").trim();
    if (!text) {
      throw new EmptyFileError(file.name);
    }

    return { label: file.name, text };
  } catch (error) {
    if (error instanceof EmptyFileError) throw error;
    throw new Error(
      `Could not extract text from PDF ${file.name}: ${formatError(error)}`
    );
  } finally {
    worker.destroy();
  }
}

export async function fetchUrlSource(
  url: string,
  deps: { fetch?: typeof fetch; now?: () => Date } = {}
): Promise<TextSource> {
  const parsed = parseSourceUrl(url);
  const fetchImpl = deps.fetch ?? fetch;
  const response = await fetchImpl(parsed.toString(), {
    headers: {
      accept: "text/html,text/plain,application/xhtml+xml;q=0.9,*/*;q=0.5",
      "user-agent": "ThoughtLine source ingester",
    },
  });

  if (!response.ok) {
    throw new UrlFetchError(parsed.toString(), `HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_URL_SOURCE_BYTES) {
    throw new UrlFetchError(
      parsed.toString(),
      `response is larger than ${MAX_URL_SOURCE_BYTES} bytes`
    );
  }

  const raw = await response.text();
  if (raw.length > MAX_URL_SOURCE_BYTES) {
    throw new UrlFetchError(
      parsed.toString(),
      `response is larger than ${MAX_URL_SOURCE_BYTES} characters`
    );
  }

  const title = extractTitle(raw) ?? parsed.toString();
  const body = contentType.includes("text/plain")
    ? raw
    : extractReadableText(raw);
  const text = body.trim();
  if (!text) throw new UrlFetchError(parsed.toString(), "no readable text found");

  const fetchedAt = (deps.now?.() ?? new Date()).toISOString();
  const metadata = [
    "---",
    `title: "${escapeYaml(title)}"`,
    `url: "${parsed.toString()}"`,
    `fetchedAt: "${fetchedAt}"`,
    `suggestedSourceLabel: "${escapeYaml(parsed.hostname)}"`,
    "---",
    "",
    `# ${title}`,
    "",
  ].join("\n");

  return {
    label: title,
    text: `${metadata}${text}`,
  };
}

function parseSourceUrl(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new UrlFetchError(value, "invalid URL");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new UrlFetchError(value, "only http and https URLs are supported");
  }
  return parsed;
}

function extractReadableText(html: string): string {
  const readable =
    matchFirst(html, /<article\b[^>]*>([\s\S]*?)<\/article>/i) ??
    matchFirst(html, /<main\b[^>]*>([\s\S]*?)<\/main>/i) ??
    matchFirst(html, /<body\b[^>]*>([\s\S]*?)<\/body>/i) ??
    html;

  return decodeEntities(
    readable
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
      .replace(/<svg[\s\S]*?<\/svg>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<aside[\s\S]*?<\/aside>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|blockquote|pre)>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
  )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n\n");
}

function extractTitle(html: string): string | undefined {
  const title =
    matchFirst(
      html,
      /<meta\s+property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i
    ) ??
    matchFirst(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ??
    matchFirst(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const decoded = title ? decodeEntities(stripTags(title)).trim() : "";
  return decoded || undefined;
}

function matchFirst(value: string, pattern: RegExp): string | undefined {
  return value.match(pattern)?.[1];
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "");
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, "-")
    .replace(/&ndash;/g, "-")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function escapeYaml(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
