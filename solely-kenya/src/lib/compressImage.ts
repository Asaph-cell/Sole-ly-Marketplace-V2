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
                    let { width, height } = img;

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

                    ctx.drawImage(img, 0, 0, width, height);

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

                            if (blob.size < file.size || mustConvert) {
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

        reader.onerror = () => reject(new Error("Failed to read image file"));
        reader.readAsDataURL(file);
    });
}

/**
 * Compresses multiple image files in parallel.
 */
export async function compressImages(files: File[]): Promise<File[]> {
    return Promise.all(files.map(compressImage));
}
