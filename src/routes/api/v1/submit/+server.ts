import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { once } from "events";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

function error(message: string): Response {
    return new Response(`{"message": "${message}"}`, {
        status: 400, headers: {
            "content-type": "application/json",
        }
    });
}

export async function POST({ request }) {
    const data = await request.formData();
    const documentsData = data.get("documents");
    if (documentsData === null || typeof documentsData != "string") {
        return error("documents_data_not_present");
    }

    const tempdir = await mkdtemp(join(tmpdir(), "instpdf-"));
    const documents = JSON.parse(documentsData);
    for (const document of documents) {
        const uuid = randomUUID();
        document.uuid = uuid;
        const file = data.get(document.field);
        if (file === null || !(file instanceof File)) {
            return error("file_not_present");
        }

        if (document.type === "image/jpeg") {
            const filePath = join(tempdir, `${uuid}.jpg`);
            const filePathOutput = join(tempdir, `${uuid}.pdf`);
            await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
            let args = [filePath, "-resize", "2480x3508!", "-page", "A4"];
            if (document.enhance) {
                args = [...args, "-brightness-contrast", "25%x0%", "-channel", "RGB", "-threshold", "90%"];
            }
            const process = spawn("magick", [...args, filePathOutput]);
            await once(process, "close");
        } else if (document.type === "application/pdf") {
            const filePath = join(tempdir, `${uuid}.pdf`);
            if (document.filter.type !== "nofilter") {
                const filePathTemp = join(tempdir, `${uuid}_temp.pdf`);
                await writeFile(filePathTemp, Buffer.from(await file.arrayBuffer()));
                if (typeof document.filter.page !== "number") {
                    return error("invalid_filter_arguments");
                }
                let args = [`-dFirstPage=${document.filter.page}`];
                if (document.filter.type === "single") {
                    args = [`-dFirstPage=${document.filter.page}`, `-dLastPage=${document.filter.page}`];
                }
                const process = spawn("gs", ["-dBATCH", "-sDEVICE=pdfwrite", "-o", filePath, ...args, filePathTemp]);
                await once(process, "close");
            } else {
                await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
            }
        }
    }

    const finalPdf = join(tempdir, "out.pdf")
    const files = documents.map((document: any) => join(tempdir, `${document.uuid}.pdf`));
    const process = spawn("gs", ["-dBATCH", "-sDEVICE=pdfwrite", "-o", finalPdf, ...files]);
    await once(process, "close");

    const pdfData = await readFile(finalPdf);
    await rm(tempdir, { recursive: true });

    return new Response(pdfData, {
        headers: {
            "content-type": "application/pdf",
            "content-disposition": "attachment; filename=\"out.pdf\"",
        }
    });
}