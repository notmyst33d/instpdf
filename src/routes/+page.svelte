<script lang="ts">
    import { tick } from "svelte";
    import { dragHandle, dragHandleZone } from "svelte-dnd-action";
    import { flip } from "svelte/animate";
    let items: any = $state([]);
    let processing = $state(false);

    function randomId(): number {
        return parseInt((Math.random() + 1).toString().replace(".", ""));
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<form
    onsubmit={async () => {
        processing = true;
        const form = new FormData();
        const documents: any[] = [];
        items.forEach((file: any, i: number) => {
            form.append(`file${i}`, file.file);
            let filter: any = {
                type: "nofilter",
            };
            if (file.filterType === "single") {
                filter.type = "single";
                filter.page = file.filterSinglePage;
            } else if (file.filterType === "frompage") {
                filter.type = "frompage";
                filter.page = file.filterFromPage;
            }
            documents.push({
                type: file.file.type,
                field: `file${i}`,
                filter,
            });
        });
        form.append("documents", JSON.stringify(documents));
        const response = await fetch("/api/v1/submit", {
            method: "POST",
            body: form,
        });
        if (response.status === 200) {
            const url = URL.createObjectURL(await response.blob());
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", "out.pdf");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            alert("Неизвестная ошибка");
        }
        processing = false;
    }}
>
    <section
        use:dragHandleZone={{ items, flipDurationMs: 100, dropTargetStyle: {} }}
        onconsider={(e) => (items = e.detail.items)}
        onfinalize={(e) => (items = e.detail.items)}
    >
        {#each items as file (file.id)}
            <div
                class="file-entry row elevation"
                style:border-radius="12px"
                animate:flip={{ duration: 100 }}
            >
                <div class="file-entry-body surface-container">
                    <div class="row" style:align-items="center">
                        <span
                            style:font-weight="700"
                            style:overflow="hidden"
                            style:text-overflow="ellipsis"
                            style:flex-grow="1"
                            style:flex-shrink="1"
                            style:white-space="nowrap">{file.file.name}</span
                        >
                        {#if file.file.type === "application/pdf"}
                            <select
                                style:flex-shrink="2"
                                class="filter-select primary-container"
                                bind:value={file.filterType}
                            >
                                <option value="nofilter">Без фильтра</option>
                                <option value="frompage">Со страницы</option>
                                <option value="single">Одна страница</option>
                            </select>
                        {/if}
                        <input
                            type="button"
                            class="icon-button"
                            value="⨉"
                            onclick={() =>
                                (items = items.filter((f: any) => file !== f))}
                        />
                    </div>
                    {#if file.filterType === "frompage"}
                        <input
                            class="page-input"
                            type="number"
                            min="1"
                            placeholder="Начальная страница"
                            bind:value={file.filterFromPage}
                        />
                    {:else if file.filterType === "single"}
                        <input
                            class="page-input"
                            type="number"
                            min="1"
                            placeholder="Номер страницы"
                            bind:value={file.filterSinglePage}
                        />
                    {/if}
                </div>
                <div use:dragHandle class="handle row tertiary-container">
                    ≡
                </div>
            </div>
        {/each}
    </section>
    <input
        type="button"
        class="add-button tertiary elevation"
        value="+"
        onclick={() => {
            let i = document.createElement("input");
            i.type = "file";
            i.accept = "image/jpeg,application/pdf";
            i.addEventListener("change", (e: any) => {
                items.push({
                    id: randomId(),
                    file: e.target.files[0],
                });
                tick().then(() => {
                    window.scrollTo(0, document.body.scrollHeight);
                });
            });
            i.click();
        }}
    />
    {#if items.length !== 0}
        {#if !processing}
            <input
                class="submit-button primary-container elevation"
                type="submit"
                value="Сделать PDF"
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
</form>

<style>
    @media screen and (width > 640px) {
        form {
            max-width: 640px;
            margin: auto;
        }

        .add-button {
            left: 50%;
            transform: translateX(-50%);
        }
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
        border-style: none;
        border-radius: 20px;
        font-size: 28px;
        cursor: pointer;
    }

    .file-entry + .file-entry {
        margin-top: 12px;
    }

    .file-entry {
        min-height: 72px;
    }

    .file-entry-body {
        flex-grow: 1;
        border-radius: 12px 0px 0px 12px;
        padding: 12px;
        overflow: hidden;
    }

    .tertiary {
        color: #492533;
        background-color: #efb8c9;
    }

    .surface-container {
        background-color: #211f24;
    }

    .tertiary-container {
        color: #ffd9e3;
        background-color: #633b49;
    }

    .primary-container {
        color: #e8ddff;
        background-color: #4c3e76;
    }

    .handle {
        min-width: 72px;
        min-height: 100%;
        text-align: center;
        font-size: 24px;
        align-items: center;
        justify-content: center;
        border-radius: 0px 12px 12px 0px;
    }

    .filter-select {
        min-width: 96px;
        max-width: 192px;
        border-color: transparent;
        border-style: solid;
        border-width: 8px;
        border-radius: 32px;
        padding: 8px;
        margin-left: 12px;
        overflow: hidden;
        font-weight: 500;
        flex-shrink: 0;
    }

    .page-input {
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

    .page-input:hover {
        outline-color: #e5e1e9;
    }

    .page-input:focus {
        outline-color: #c9bfff;
        outline-width: 2px;
    }

    .submit-button {
        width: 100%;
        border: none;
        font-weight: 500;
        padding: 12px;
        border-radius: 32px;
        margin-top: 12px;
        margin-bottom: 112px;
        cursor: pointer;
    }

    .icon-button {
        border: none;
        min-width: 48px;
        min-height: 48px;
        border-radius: 64px;
        background-color: transparent;
        font-weight: 700;
        color: #e5e1e9;
        cursor: pointer;
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
    }

    .upload-icon {
        width: 64px;
        height: 64px;
    }

    .elevation {
        box-shadow: 0px 4px 8px #00000052;
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
