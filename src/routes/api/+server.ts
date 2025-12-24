import { spawn } from "child_process";
import { once } from "events";
import { readFile, rm, writeFile } from "fs/promises";
import { Document } from "../../common";
import { decodeArrayStream } from "@msgpack/msgpack";
import { join } from "path";
import { tmpdir } from "os";
import { v4 } from "uuid";

class TemporaryFile {
    path: string;

    constructor(path: string) {
        this.path = path;
    }

    static async acquire(prefix: string, ext: string): Promise<TemporaryFile> {
        const path = join(tmpdir(), `${prefix}-${v4()}.${ext}`);
        return new TemporaryFile(path);
    }

    async free() {
        try {
            await rm(this.path);
        } catch (_) { }
    }
}

class TemporaryFilePool {
    entries: TemporaryFile[] = [];

    async acquire(prefix: string, ext: string): Promise<TemporaryFile> {
        const file = await TemporaryFile.acquire(prefix, ext);
        this.entries.push(file);
        return file;
    }

    async free() {
        for (const entry of this.entries) {
            await entry.free();
        }
    }
}

interface RunOptions {
    stdinData?: Uint8Array | undefined;
}

async function runProcess(path: string, args: string[], options?: RunOptions) {
    const process = spawn(path, args);
    if (options?.stdinData !== undefined) {
        process.stdin.write(options?.stdinData);
    }
    process.stdin.end();
    await once(process, "close");
}

export async function POST({ request }) {
    const data = await request.blob();
    const stream = decodeArrayStream(data.stream());
    const rawDocuments = [];
    for await (const value of stream) {
        rawDocuments.push(value);
    }
    const documents = Document.array().parse(rawDocuments);

    const tempPool = new TemporaryFilePool();
    const concatInputs = [];
    for (const document of documents) {
        const output = await tempPool.acquire("instpdf-intermediate", "pdf");
        concatInputs.push(output);

        if (document.mime === "image/jpeg" || document.mime === "image/png") {
            await runProcess("magick", ["-", "-auto-orient", "-units", "PixelsPerInch", "-resample", "72", "-resize", "2480x3508!", "-page", "a4", output.path], {
                stdinData: document.data,
            });
        } else if (document.mime === "application/pdf") {
            if (document.filter.type !== "none") {
                if (document.filter.page === undefined || document.filter.page === null) {
                    await tempPool.free();
                    return new Response("FILTER_PAGE_EMPTY", { status: 400 });
                }

                const temp = await tempPool.acquire("instpdf-temp", "pdf");
                await writeFile(temp.path, document.data);

                let args = [`-dFirstPage=${document.filter.page}`];
                if (document.filter.type === "single") {
                    args = [`-dFirstPage=${document.filter.page}`, `-dLastPage=${document.filter.page}`];
                }

                await runProcess("gs", ["-dBATCH", "-sDEVICE=pdfwrite", `-sOutputFile=${output.path}`, ...args, temp.path]);
            } else {
                await writeFile(output.path, document.data);
            }
        }
    }

    const output = await tempPool.acquire("instpdf-output", "pdf");
    await runProcess("gs", ["-dBATCH", "-sDEVICE=pdfwrite", `-sOutputFile=${output.path}`, ...concatInputs.map(v => v.path)]);
    const outputData = await readFile(output.path);

    await tempPool.free();

    return new Response(Buffer.from(outputData), {
        headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": "attachment; filename=\"out.pdf\"",
        }
    });
}
