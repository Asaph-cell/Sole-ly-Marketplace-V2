/**
 * Compresses an image file using the browser Canvas API.
 * Resizes large images and reduces quality to keep file sizes manageable
 * for upload, without noticeable quality loss for product photos.
 */

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1920;
const QUALITY = 0.8; // JPEG quality (0-1)
const MAX_FILE_SIZE_MB = 5;

// What the share-card/OG renderer (Satori + Resvg) can actually decode.
// Anything else has to be converted at upload time or the product simply
// has no shareable image.
const RENDERABLE_TYPES = new Set(["image/jpeg", "image/png"]);

// ── Trim blank margins ───────────────────────────────────────────────────────
// Many product photos arrive with a wide white border baked in, so the product
// ends up small in the middle of its card. We find the product's bounding box
// and crop to it. Only near-white borders are touched (a coloured backdrop may
// be deliberate), and a photo is never cut by more than TRIM_MAX_SIDE per side
// so a white product on a white background can't be cropped away.
// Off: sellers found it altered their photos. Flip to true to trim blank borders again.
const TRIM_ENABLED = false;

const SCAN_SIZE = 400;       // scan a small copy, not the full-size photo
const BG_TOLERANCE = 18;     // a pixel is background if no channel differs from the backdrop by more than this
const BG_MIN_BRIGHT = 170;   // only light backdrops (white, grey, cream) are trimmed, not dark or vivid ones
const RING_UNIFORM = 0.9;    // this share of the border must match the backdrop for it to count as a backdrop
const TRIM_MIN_GAIN = 0.08;  // skip unless trimming removes >= 8% of a side
const TRIM_MAX_SIDE = 0.35;  // never remove more than 35% from one side
const TRIM_PADDING = 0.04;   // breathing room kept around the product

interface Box { sx: number; sy: number; sw: number; sh: number }

function findContentBox(img: HTMLImageElement): Box | null {
    if (!TRIM_ENABLED) return null;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return null;

    const scale = Math.min(1, SCAN_SIZE / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.fillStyle = "#fff"; // transparent areas count as white
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, cw, ch);
    const { data } = ctx.getImageData(0, 0, cw, ch);

    // The backdrop is the typical colour around the edge. Studio shots are
    // rarely pure white (240 grey, cream, a faint gradient), so comparing to
    // 255 would see a backdrop that is not there and never trim.
    const ring: number[] = [];
    for (let x = 0; x < cw; x++) { ring.push((x) * 4, ((ch - 1) * cw + x) * 4); }
    for (let y = 0; y < ch; y++) { ring.push((y * cw) * 4, (y * cw + cw - 1) * 4); }
    const median = (k: number) => {
        const v = ring.map((i) => data[i + k]).sort((a, b) => a - b);
        return v[Math.floor(v.length / 2)];
    };
    const bg = [median(0), median(1), median(2)];
    if (Math.min(bg[0], bg[1], bg[2]) < BG_MIN_BRIGHT) return null;
    const near = (i: number) =>
        Math.abs(data[i] - bg[0]) <= BG_TOLERANCE && Math.abs(data[i + 1] - bg[1]) <= BG_TOLERANCE && Math.abs(data[i + 2] - bg[2]) <= BG_TOLERANCE;
    if (ring.filter(near).length / ring.length < RING_UNIFORM) return null; // edges are the photo itself

    const isContent = (x: number, y: number) => !near((y * cw + x) * 4);

    // A row or column counts as content when a few pixels in it are, so stray
    // JPEG specks on a clean border don't stop the trim.
    const MIN_HITS = 2;
    const rowHas = (y: number) => { let n = 0; for (let x = 0; x < cw; x++) if (isContent(x, y) && ++n >= MIN_HITS) return true; return false; };
    const colHas = (x: number) => { let n = 0; for (let y = 0; y < ch; y++) if (isContent(x, y) && ++n >= MIN_HITS) return true; return false; };

    let top = 0; while (top < ch && !rowHas(top)) top++;
    if (top >= ch) return null; // blank image
    let bottom = ch - 1; while (bottom > top && !rowHas(bottom)) bottom--;
    let left = 0; while (left < cw && !colHas(left)) left++;
    let right = cw - 1; while (right > left && !colHas(right)) right--;

    // Margins as a share of each side, capped, then padded back a little.
    const clamp = (v: number) => Math.min(TRIM_MAX_SIDE, Math.max(0, v));
    const pad = TRIM_PADDING * Math.max(right - left + 1, bottom - top + 1) / Math.max(cw, ch);
    const m = {
        top: clamp(top / ch - pad),
        bottom: clamp((ch - 1 - bottom) / ch - pad),
        left: clamp(left / cw - pad),
        right: clamp((cw - 1 - right) / cw - pad),
    };
    if (Math.max(m.top + m.bottom, m.left + m.right) < TRIM_MIN_GAIN) return null;

    return {
        sx: Math.round(m.left * w),
        sy: Math.round(m.top * h),
        sw: Math.round(w * (1 - m.left - m.right)),
        sh: Math.round(h * (1 - m.top - m.bottom)),
    };
}

export function isFileTooLarge(file: File): boolean {
    return file.size > MAX_FILE_SIZE_MB * 1024 * 1024;
}

export function getFileSizeMB(file: File): string {
    return (file.size / (1024 * 1024)).toFixed(1);
}

export async function compressImage(file: File): Promise<File> {
    // If it's not an image, return as-is
    if (!file.type.startsWith("image/")) return file;

    // If it's a GIF or SVG, skip compression (canvas can't handle these well)
    if (file.type === "image/gif" || file.type === "image/svg+xml") return file;

    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.onload = () => {
                try {
                    const box = findContentBox(img);
                    const srcW = box ? box.sw : img.width;
                    const srcH = box ? box.sh : img.height;
                    let width = srcW;
                    let height = srcH;

                    // Calculate new dimensions while maintaining aspect ratio
                    if (width > MAX_WIDTH || height > MAX_HEIGHT) {
                        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                    }

                    // Draw to canvas
                    const canvas = document.createElement("canvas");
                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                        resolve(file); // fallback to original
                        return;
                    }

                    ctx.fillStyle = "#fff"; // transparent PNGs would otherwise turn black as JPEG
                    ctx.fillRect(0, 0, width, height);
                    if (box) ctx.drawImage(img, box.sx, box.sy, box.sw, box.sh, 0, 0, width, height);
                    else ctx.drawImage(img, 0, 0, width, height);

                    // Convert to blob
                    canvas.toBlob(
                        (blob) => {
                            if (!blob) {
                                resolve(file); // fallback to original
                                return;
                            }

                            // Keep the JPEG if it saved space, or if the source
                            // format can't be rendered downstream.
                            //
                            // WebP is already well compressed, so a re-encoded
                            // JPEG is usually LARGER and the size check alone
                            // sent the original straight through. That broke
                            // share cards and link previews: the Satori/Resvg
                            // renderer behind generate-og-image only decodes
                            // JPEG and PNG, so a WebP product photo failed the
                            // whole image.
                            const mustConvert = !RENDERABLE_TYPES.has(file.type);

                            if (blob.size < file.size || mustConvert || box) {
                                // Rename to .jpg too - Supabase infers the
                                // stored content-type from the extension, so
                                // keeping a .webp name would mislabel JPEG
                                // bytes and reintroduce the same failure.
                                const jpegName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
                                const compressedFile = new File([blob], jpegName, {
                                    type: "image/jpeg",
                                    lastModified: Date.now(),
                                });
                                resolve(compressedFile);
                            } else {
                                resolve(file);
                            }
                        },
                        "image/jpeg",
                        QUALITY
                    );
                } catch {
                    resolve(file); // fallback on any error
                }
            };

            img.onerror = () => resolve(file); // fallback
            img.src = e.target?.result as string;
        };

        // Unreadable (e.g. a phone revoked access to the picked file): hand it back
        // untouched so the caller decides, instead of failing the whole save.
        reader.onerror = () => resolve(file);
        reader.readAsDataURL(file);
    });
}

/**
 * Compresses multiple image files in parallel.
 */
export async function compressImages(files: File[]): Promise<File[]> {
    return Promise.all(files.map(compressImage));
}
