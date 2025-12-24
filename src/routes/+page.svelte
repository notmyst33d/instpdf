<script lang="ts">
    import { encode } from "@msgpack/msgpack";
    import { tick } from "svelte";
    import { dragHandle, dragHandleZone } from "svelte-dnd-action";
    import { flip } from "svelte/animate";
    import { Document, DocumentFilter, DocumentMime } from "../common";

    interface DocumentBinding {
        id: number;
        fileData: Uint8Array<ArrayBuffer>;
        fileType: DocumentMime;
        fileName: string;
        fileUrl: string;
        filter: DocumentFilter;
        filterPage?: number;
        imageZoom: boolean;
    }

    let documentBindings: DocumentBinding[] = $state([]);
    let processing = $state(false);
</script>

<svelte:head>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossorigin="anonymous"
    />
    <link
        href="https://fonts.googleapis.com/css2?family=Google+Sans:ital,opsz,wght@0,17..18,400..700;1,17..18,400..700&display=swap"
        rel="stylesheet"
    />
</svelte:head>

<main>
    <section
        use:dragHandleZone={{
            items: documentBindings,
            flipDurationMs: 100,
            dropTargetStyle: {},
        }}
        onconsider={(e) => (documentBindings = e.detail.items)}
        onfinalize={(e) => (documentBindings = e.detail.items)}
    >
        {#each documentBindings as binding, i (binding.id)}
            <div class="file-entry row" animate:flip={{ duration: 100 }}>
                <div class="file-entry-body">
                    <div class="row" style:align-items="center">
                        <span
                            style:font-weight="700"
                            style:overflow="hidden"
                            style:text-overflow="ellipsis"
                            style:flex-shrink="1"
                            style:white-space="nowrap"
                        >
                            {binding.fileName}
                        </span>
                        {#if binding.fileType === "application/pdf"}
                            <select
                                style:flex-shrink="2"
                                bind:value={binding.filter}
                            >
                                <option value="none">Без фильтра</option>
                                <option value="from">Со страницы</option>
                                <option value="single">Одна страница</option>
                            </select>
                        {:else if (binding.fileType === "image/jpeg" || binding.fileType === "image/png") && !binding.imageZoom}
                            <button
                                type="button"
                                class="image-button"
                                style:margin-left="var(--spacing)"
                                onclick={() =>
                                    (binding.imageZoom = !binding.imageZoom)}
                            >
                                <img
                                    style:max-width="64px"
                                    style:max-height="64px"
                                    src={binding.fileUrl}
                                    alt="Input"
                                />
                            </button>
                        {/if}
                        <span style:flex-grow="1"></span>
                        <input
                            type="button"
                            class="icon-button"
                            value="⨉"
                            onclick={() => documentBindings.splice(i, 1)}
                        />
                    </div>
                    {#if binding.imageZoom}
                        <button
                            type="button"
                            class="image-button"
                            onclick={() =>
                                (binding.imageZoom = !binding.imageZoom)}
                        >
                            <img
                                style:width="100%"
                                src={binding.fileUrl}
                                alt="Input"
                            />
                        </button>
                    {/if}
                    {#if binding.filter === "from"}
                        <input
                            type="number"
                            min="1"
                            placeholder="Начальная страница"
                            bind:value={binding.filterPage}
                        />
                    {:else if binding.filter === "single"}
                        <input
                            type="number"
                            min="1"
                            placeholder="Номер страницы"
                            bind:value={binding.filterPage}
                        />
                    {/if}
                </div>
                <div use:dragHandle class="handle row">≡</div>
            </div>
        {/each}
    </section>
    <input
        type="button"
        class="add-button"
        value="+"
        onclick={() => {
            let i = document.createElement("input");
            i.type = "file";
            i.accept = "image/jpeg,image/png,application/pdf";
            i.addEventListener("change", (e) => {
                let id = 0;
                if (documentBindings.length > 0) {
                    id = Math.max(...documentBindings.map((d) => d.id)) + 1;
                }
                const file = (e.target as HTMLInputElement).files![0];
                const reader = new FileReader();
                reader.readAsArrayBuffer(file);
                reader.onload = () => {
                    documentBindings.push({
                        id,
                        fileUrl: URL.createObjectURL(file),
                        fileData: new Uint8Array(reader.result as ArrayBuffer),
                        fileType: file.type as DocumentMime,
                        fileName: file.name,
                        filter: "none",
                        imageZoom: false,
                    });
                    tick().then(() => {
                        window.scrollTo(0, document.body.scrollHeight);
                    });
                };
            });
            i.click();
        }}
    />
    {#if documentBindings.length !== 0}
        {#if !processing}
            <input
                class="submit-button"
                type="submit"
                value="Сделать PDF"
                onclick={async () => {
                    processing = true;
                    const documents: Document[] = [];
                    for (const binding of documentBindings) {
                        documents.push({
                            mime: binding.fileType,
                            data: binding.fileData,
                            filter: {
                                type: binding.filter,
                                page: binding.filterPage,
                            },
                        });
                    }
                    const response = await fetch("/api", {
                        method: "POST",
                        body: encode(documents) as any,
                        headers: {
                            "Content-Type": "application/vnd.msgpack",
                        },
                    });
                    if (response.status === 200) {
                        const url = URL.createObjectURL(await response.blob());
                        const link = document.createElement("a");
                        link.href = url;
                        link.setAttribute("download", "out.pdf");
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    } else if (response.status === 400) {
                        const errorId = await response.text();
                        if (errorId === "FILTER_PAGE_EMPTY") {
                            alert("Фильтр не имеет номера страницы");
                        } else {
                            alert("Внутренняя ошибка сервера");
                        }
                    } else {
                        alert("Внутренняя ошибка сервера");
                    }
                    processing = false;
                }}
            />
        {:else}
            <div
                class="row"
                style:justify-content="center"
                style:margin-top="12px"
            >
                <span class="loader"></span>
            </div>
        {/if}
    {:else}
        <div class="upload-hint column">
            <svg
                class="upload-icon"
                xmlns="http://www.w3.org/2000/svg"
                height="24px"
                viewBox="0 -960 960 960"
                width="24px"
                fill="#ffffff"
                ><path
                    d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"
                /></svg
            >
            <span class="upload-hint-text">Добавьте файлы</span>
        </div>
    {/if}
</main>

<style>
    :root {
        --surface: #141318;
        --on-surface: #e6e1e9;
        --surface-container: #211f24;
        --tertiary: #492533;
        --on-tertiary: #efb8c9;
        --tertiary-container: #ffd9e3;
        --on-tertiary-container: #633b49;
        --primary-container: #4c3e76;
        --on-primary-container: #e8ddff;
        --elevation: 0px 4px 8px #00000052;
        --spacing: 12px;
        --corners: 12px;
    }

    :global(body) {
        color: var(--on-surface);
        background-color: var(--surface);
    }

    :global(*) {
        font-family: "Google Sans", sans-serif, system-ui;
    }

    @media screen and (width > 640px) {
        main {
            max-width: 640px;
            margin: auto;
        }

        .add-button {
            left: 50%;
            transform: translateX(-50%);
        }
    }

    img {
        display: block;
        width: 100%;
    }

    button,
    input[type="button"],
    input[type="submit"] {
        border-style: none;
        cursor: pointer;
    }

    select {
        min-width: 96px;
        max-width: 192px;
        border-color: transparent;
        border-style: solid;
        border-width: 8px;
        border-radius: 64px;
        padding: 8px;
        margin-left: 12px;
        overflow: hidden;
        font-weight: 500;
        flex-shrink: 0;
        color: var(--on-primary-container);
        background-color: var(--primary-container);
    }

    input[type="number"] {
        width: 100%;
        max-width: 256px;
        background-color: transparent;
        color: #e5e1e9;
        outline-color: #938f99;
        outline-width: 1px;
        outline-style: solid;
        border-radius: 4px;
        border-style: none;
        padding: 12px;
        margin-top: 8px;
        box-sizing: border-box;
        appearance: textfield;
        transition:
            outline-width 0.1s,
            outline-color 0.1s;
    }

    input[type="number"]:hover {
        outline-color: #e5e1e9;
    }

    input[type="number"]:focus {
        outline-color: #c9bfff;
        outline-width: 2px;
    }

    .image-button {
        padding: 0px;
        margin: 0px;
        flex-shrink: 1;
    }

    .column {
        display: flex;
        flex-direction: column;
    }

    .row {
        display: flex;
        flex-direction: row;
    }

    .add-button {
        position: fixed;
        right: 16px;
        bottom: 16px;
        width: 80px;
        height: 80px;
        border-radius: var(--corners);
        font-size: 28px;
        box-shadow: var(--elevation);
        background-color: var(--tertiary-container);
        color: var(--on-tertiary-container);
    }

    .file-entry {
        border-radius: var(--corners);
        box-shadow: var(--elevation);
    }

    .file-entry + .file-entry {
        margin-top: var(--spacing);
    }

    .file-entry-body {
        flex-grow: 1;
        border-radius: var(--corners) 0px 0px var(--corners);
        padding: var(--spacing) var(--spacing) var(--spacing)
            calc(var(--spacing) + 12px);
        overflow: hidden;
        color: var(--on-surface);
        background-color: var(--surface-container);
    }

    .handle {
        min-width: 72px;
        min-height: 100%;
        text-align: center;
        font-size: 24px;
        align-items: center;
        justify-content: center;
        border-radius: 0px var(--corners) var(--corners) 0px;
        color: var(--on-tertiary-container);
        background-color: var(--tertiary-container);
    }

    .submit-button {
        width: 100%;
        font-weight: 500;
        min-height: 48px;
        border-radius: 64px;
        padding: var(--spacing);
        margin-top: var(--spacing);
        margin-bottom: 96px;
        background-color: var(--primary-container);
        color: var(--on-primary-container);
        box-shadow: var(--elevation);
    }

    .icon-button {
        min-width: 48px;
        min-height: 48px;
        border-radius: 64px;
        background-color: transparent;
        font-weight: 700;
        color: #e5e1e9;
        margin-left: 8px;
        transition: background-color 0.1s;
    }

    .icon-button:hover {
        background-color: #3a383e;
    }

    .upload-hint {
        position: absolute;
        top: 50%;
        right: 50%;
        transform: translateX(50%) translateY(-50%);
        align-items: center;
        z-index: -1;
    }

    .upload-hint-text {
        font-size: 24px;
        font-weight: 500;
        text-align: center;
    }

    .upload-icon {
        width: 64px;
        height: 64px;
    }

    .loader {
        width: 48px;
        height: 48px;
        border: 5px solid #fff;
        border-bottom-color: transparent;
        border-radius: 50%;
        display: inline-block;
        box-sizing: border-box;
        animation: rotation 1s linear infinite;
    }

    @keyframes rotation {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }
</style>
