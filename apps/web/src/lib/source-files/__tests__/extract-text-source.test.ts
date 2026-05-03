import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  EmptyFileError,
  fetchUrlSource,
  extractTextSource,
  FileTooLargeError,
  MAX_FILE_BYTES,
  UrlFetchError,
  UnsupportedFileError,
} from "../index";

describe("extractTextSource", () => {
  it("reads a plain text file and returns the filename as label", async () => {
    const file = new File(
      ["I value clarity and careful tradeoffs."],
      "values.txt",
      { type: "text/plain" }
    );

    const source = await extractTextSource(file);

    expect(source).toEqual({
      label: "values.txt",
      text: "I value clarity and careful tradeoffs.",
    });
  });

  it("reads a pdf file and extracts selectable text", async () => {
    const pdf = new File(
      [await buildPdfBytes(["Specific judgment beats", "generic summary."])],
      "notes.pdf",
      {
      type: "application/pdf",
      }
    );

    const source = await extractTextSource(pdf);

    expect(source.label).toBe("notes.pdf");
    expect(source.text).toContain("Specific judgment beats");
    expect(source.text).toContain("generic summary.");
  });

  it("rejects files with unsupported extensions", async () => {
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "logo.png", {
      type: "image/png",
    });

    await expect(extractTextSource(file)).rejects.toBeInstanceOf(
      UnsupportedFileError
    );
  });

  it("rejects files larger than MAX_FILE_BYTES", async () => {
    const oversizedText = "x".repeat(MAX_FILE_BYTES + 1);
    const file = new File([oversizedText], "huge.txt", { type: "text/plain" });

    await expect(extractTextSource(file)).rejects.toBeInstanceOf(
      FileTooLargeError
    );
  });

  it("rejects files whose contents are empty or whitespace-only", async () => {
    const file = new File(["   \n\t  "], "blank.txt", { type: "text/plain" });

    await expect(extractTextSource(file)).rejects.toBeInstanceOf(EmptyFileError);
  });
});

async function buildPdfBytes(lines: string[]): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([400, 400]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  lines.forEach((line, index) => {
    page.drawText(line, {
      x: 36,
      y: 320 - index * 32,
      size: 24,
      font,
      color: rgb(0, 0, 0),
    });
  });
  const bytes = await pdf.save();
  return new Uint8Array(bytes).buffer;
}

describe("fetchUrlSource", () => {
  it("fetches a URL and extracts readable article text with metadata", async () => {
    const source = await fetchUrlSource("https://example.com/post", {
      now: () => new Date("2026-05-03T00:00:00.000Z"),
      fetch: async () =>
        new Response(
          `<!doctype html>
          <html>
            <head><title>Example Essay</title></head>
            <body>
              <nav>Skip this</nav>
              <article>
                <h1>Example Essay</h1>
                <p>Specific judgment beats generic summary.</p>
                <p>Use concrete examples &amp; calibrated confidence.</p>
              </article>
              <footer>Skip this too</footer>
            </body>
          </html>`,
          { headers: { "content-type": "text/html" } }
        ),
    });

    expect(source.label).toBe("Example Essay");
    expect(source.text).toContain('url: "https://example.com/post"');
    expect(source.text).toContain('fetchedAt: "2026-05-03T00:00:00.000Z"');
    expect(source.text).toContain("Specific judgment beats generic summary.");
    expect(source.text).toContain("Use concrete examples & calibrated confidence.");
    expect(source.text).not.toContain("Skip this");
  });

  it("rejects non-http URLs", async () => {
    await expect(fetchUrlSource("file:///etc/passwd")).rejects.toBeInstanceOf(
      UrlFetchError
    );
  });
});
