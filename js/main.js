function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

const state = {
    files: [], // {file, url, width, height, imgEl, cardEl, convertedBlob, outputName}
    outputType: "image/jpeg",
    quality: 0.8,
    keepAspect: true,
    resizeW: null,
    resizeH: null,
    maxDim: null
};

const formatGroup = document.getElementById("formatGroup");
const quality = document.getElementById("quality");
const qualityVal = document.getElementById("qualityVal");
const keepAspect = document.getElementById("keepAspect");
const resizeWidth = document.getElementById("resizeWidth");
const resizeHeight = document.getElementById("resizeHeight");
const maxDim = document.getElementById("maxDim");

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const browseBtn = document.getElementById("browseBtn");

const grid = document.getElementById("previewGrid");
const cardTpl = document.getElementById("cardTemplate");

const convertAllBtn = document.getElementById("convertAll");
const downloadAllBtn = document.getElementById("downloadAll");
const progressWrap = document.getElementById("progressWrap");
const progressBar = document.getElementById("progressBar");

formatGroup.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    formatGroup.querySelectorAll(".chip").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.outputType = btn.dataset.format;
});

quality.addEventListener("input", () => {
    state.quality = parseFloat(quality.value);
    qualityVal.textContent = Math.round(state.quality * 100) + "%";
});

keepAspect.addEventListener("change", () => {
    state.keepAspect = keepAspect.checked;
});

resizeWidth.addEventListener("input", () => {
    const v = resizeWidth.value ? parseInt(resizeWidth.value, 10) : null;
    state.resizeW = v;
    if (state.keepAspect && v && currentImageNatural) {
        const ratio = currentImageNatural.height / currentImageNatural.width;
        resizeHeight.value = Math.round(v * ratio);
        state.resizeH = parseInt(resizeHeight.value, 10);
    }
});
resizeHeight.addEventListener("input", () => {
    const v = resizeHeight.value ? parseInt(resizeHeight.value, 10) : null;
    state.resizeH = v;
    if (state.keepAspect && v && currentImageNatural) {
        const ratio = currentImageNatural.width / currentImageNatural.height;
        resizeWidth.value = Math.round(v * ratio);
        state.resizeW = parseInt(resizeWidth.value, 10);
    }
});
maxDim.addEventListener("input", () => {
    state.maxDim = maxDim.value ? parseInt(maxDim.value, 10) : null;
});

let currentImageNatural = null;

browseBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
    if (fileInput.files?.length) handleFiles([...fileInput.files]);
});

["dragenter", "dragover"].forEach(ev => dropzone.addEventListener(ev, (e) => {
    e.preventDefault(); e.stopPropagation();
    dropzone.classList.add("drag");
}));
["dragleave", "drop"].forEach(ev => dropzone.addEventListener(ev, (e) => {
    e.preventDefault(); e.stopPropagation();
    if (ev === "drop") {
        const dt = e.dataTransfer;
        const files = [...(dt?.files || [])].filter(f => f.type.startsWith("image/"));
        if (files.length) handleFiles(files);
    }
    dropzone.classList.remove("drag");
}));

function handleFiles(files) {
    files.forEach((file, idx) => {
        const url = URL.createObjectURL(file);
        const card = cardTpl.content.firstElementChild.cloneNode(true);
        const imgEl = card.querySelector(".thumb");
        const nameEl = card.querySelector(".name");
        const dimsEl = card.querySelector(".dims");
        const sizeEl = card.querySelector(".size");
        const convertBtn = card.querySelector(".convert");
        const downloadA = card.querySelector(".download");
        const status = card.querySelector(".status");

        nameEl.textContent = file.name;
        nameEl.title = file.name;
        sizeEl.textContent = formatBytes(file.size);
        status.textContent = "آماده";
        status.className = "status idle";

        imgEl.src = url;
        imgEl.onload = () => {
            dimsEl.textContent = `${imgEl.naturalWidth}×${imgEl.naturalHeight}`;
            if (idx === 0) {
                currentImageNatural = { width: imgEl.naturalWidth, height: imgEl.naturalHeight };
            }
        }

        convertBtn.addEventListener("click", async () => {
            convertBtn.disabled = true;
            status.textContent = "در حال تبدیل...";
            status.className = "status warn";
            try {
                const { blob, outW, outH } = await convertImage(file, imgEl.naturalWidth, imgEl.naturalHeight);
                const outName = makeOutputName(file.name, state.outputType);
                const urlOut = URL.createObjectURL(blob);
                downloadA.href = urlOut;
                downloadA.download = outName;
                downloadA.classList.add("ready");
                status.textContent = `آماده (${outW}×${outH})`;
                status.className = "status ok";

                const entry = state.files.find(f => f.file === file);
                if (entry) {
                    entry.convertedBlob = blob;
                    entry.outputName = outName;
                }
            } catch (err) {
                console.error(err);
                status.textContent = "خطا در تبدیل";
                status.className = "status err";
            } finally {
                convertBtn.disabled = false;
            }
        });

        grid.prepend(card);

        state.files.push({ file, url, imgEl, cardEl: card, convertedBlob: null, outputName: null });
    });
}

function makeOutputName(name, mime) {
    const base = name.replace(/\.[^.]+$/, "");
    if (mime === "image/jpeg") return base + ".jpg";
    if (mime === "image/png") return base + ".png";
    if (mime === "image/webp") return base + ".webp";
    const ext = mime.split("/")[1] || "img";
    return base + "." + ext;
}

async function convertImage(file, naturalW, naturalH) {
    const img = await fileToImage(file);
    let targetW = state.resizeW || naturalW;
    let targetH = state.resizeH || naturalH;

    if (state.keepAspect) {
        if (state.resizeW && !state.resizeH) {
            targetH = Math.round((state.resizeW / naturalW) * naturalH);
        } else if (state.resizeH && !state.resizeW) {
            targetW = Math.round((state.resizeH / naturalH) * naturalW);
        }
    }

    if (state.maxDim) {
        const maxDim = state.maxDim;
        const scale = Math.min(1, maxDim / Math.max(targetW, targetH));
        targetW = Math.max(1, Math.round(targetW * scale));
        targetH = Math.max(1, Math.round(targetH * scale));
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const isLossyType = (state.outputType === "image/jpeg" || state.outputType === "image/webp");
    const q = isLossyType ? state.quality : 1.0;

    const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error("toBlob failed")), state.outputType, q);
    });
    return { blob, outW: targetW, outH: targetH };
}

function fileToImage(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = url;
    });
}

convertAllBtn.addEventListener("click", async () => {
    if (!state.files.length) return;
    convertAllBtn.disabled = true;
    downloadAllBtn.disabled = true;
    progressWrap.hidden = false;
    progressBar.style.width = "0%";

    let done = 0;
    for (const entry of state.files) {
        const status = entry.cardEl.querySelector(".status");
        const convertBtn = entry.cardEl.querySelector(".convert");
        const downloadA = entry.cardEl.querySelector(".download");
        convertBtn.disabled = true;
        status.textContent = "در حال تبدیل...";
        status.className = "status warn";
        try {
            const { blob, outW, outH } = await convertImage(entry.file, entry.imgEl.naturalWidth, entry.imgEl.naturalHeight);
            const outName = makeOutputName(entry.file.name, state.outputType);
            const urlOut = URL.createObjectURL(blob);
            downloadA.href = urlOut;
            downloadA.download = outName;
            downloadA.classList.add("ready");
            status.textContent = `آماده (${outW}×${outH})`;
            status.className = "status ok";
            entry.convertedBlob = blob;
            entry.outputName = outName;
        } catch (err) {
            console.error(err);
            status.textContent = "خطا";
            status.className = "status err";
        } finally {
            done++;
            const pct = Math.round((done / state.files.length) * 100);
            progressBar.style.width = pct + "%";
        }
    }

    downloadAllBtn.disabled = false;
    convertAllBtn.disabled = false;
});

downloadAllBtn.addEventListener("click", async () => {
    const ready = state.files.filter(f => f.convertedBlob);
    if (!ready.length) {
        alert("ابتدا تصاویر را تبدیل کنید.");
        return;
    }
    ZipName = document.getElementById("zipName").value.trim();
    if (ZipName.length === 0) {
        ZipName = "converted_images";
    }
    ZipName = document.getElementById("zipName").value;
    const zip = new JSZip();
    ready.forEach((f) => zip.file(f.outputName || makeOutputName(f.file.name, state.outputType), f.convertedBlob));
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = ZipName + ".zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
});
