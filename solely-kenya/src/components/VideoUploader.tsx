import { useState, useRef, useCallback } from "react";
import { Upload, X, Play, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VideoUploaderProps {
    vendorId: string;
    videoUrl: string | null;
    onVideoChange: (url: string | null) => void;
}

const MIN_DURATION = 4; // seconds
const MAX_DURATION = 12; // seconds
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB in bytes
const ACCEPTED_TYPES = ["video/mp4", "video/webm"];

export const VideoUploader = ({ vendorId, videoUrl, onVideoChange }: VideoUploaderProps) => {
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [validating, setValidating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoPreviewRef = useRef<HTMLVideoElement>(null);

    const validateVideoDuration = (file: File): Promise<number> => {
        return new Promise((resolve, reject) => {
            const video = document.createElement("video");
            video.preload = "metadata";

            video.onloadedmetadata = () => {
                URL.revokeObjectURL(video.src);
                resolve(video.duration);
            };

            video.onerror = () => {
                URL.revokeObjectURL(video.src);
                reject(new Error("Could not load video. Please try a different format (MP4 or WebM)."));
            };

            video.src = URL.createObjectURL(file);
        });
    };

    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);
        setValidating(true);

        try {
            // Validate file type
            if (!ACCEPTED_TYPES.includes(file.type)) {
                throw new Error("Please upload an MP4 or WebM video.");
            }

            // Validate file size
            if (file.size > MAX_FILE_SIZE) {
                throw new Error(`Video must be under 15MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`);
            }

            // Validate duration
            const duration = await validateVideoDuration(file);

            if (duration < MIN_DURATION) {
                throw new Error(`Video must be at least ${MIN_DURATION} seconds. Your video is ${duration.toFixed(1)}s.`);
            }

            if (duration > MAX_DURATION) {
                throw new Error(`Video must be under ${MAX_DURATION} seconds. Your video is ${duration.toFixed(1)}s.`);
            }

            setValidating(false);

            // Start upload
            await uploadVideo(file);

        } catch (err: any) {
            setError(err.message);
            setValidating(false);
        }

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, [vendorId]);

    const uploadVideo = async (file: File) => {
        setUploading(true);
        setUploadProgress(0);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${vendorId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

            // Simulate progress (Supabase doesn't provide upload progress for small files)
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => Math.min(prev + 10, 90));
            }, 200);

            const { error: uploadError } = await supabase.storage
                .from('product-videos')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            clearInterval(progressInterval);

            if (uploadError) {
                throw uploadError;
            }

            setUploadProgress(100);

            const { data: { publicUrl } } = supabase.storage
                .from('product-videos')
                .getPublicUrl(fileName);

            onVideoChange(publicUrl);
            toast.success("Video uploaded successfully!");

        } catch (err: any) {
            console.error("Video upload error:", err);
            setError(err.message || "Failed to upload video. Please try again.");
            toast.error("Video upload failed");
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    const removeVideo = () => {
        onVideoChange(null);
        setError(null);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                    Product Video (Optional)
                </label>
                <span className="text-xs text-muted-foreground">
                    4-12 seconds, max 15MB
                </span>
            </div>

            {/* Current Video Preview */}
            {videoUrl && (
                <div className="relative rounded-lg overflow-hidden border bg-black aspect-video">
                    <video
                        ref={videoPreviewRef}
                        src={videoUrl}
                        className="w-full h-full object-contain"
                        muted
                        loop
                        playsInline
                        autoPlay
                    />
                    <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={removeVideo}
                    >
                        <X size={16} strokeWidth={1.5}  />
                    </Button>
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-green-500/90 text-white text-xs px-2 py-1 rounded">
                        <CheckCircle strokeWidth={1.5} className="h-3 w-3" />
                        Video ready
                    </div>
                </div>
            )}

            {/* Upload Area */}
            {!videoUrl && !uploading && (
                <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer hover:border-primary hover:bg-muted/50 ${error ? "border-destructive bg-destructive/5" : "border-muted-foreground/25"
                        }`}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/mp4,video/webm"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                    {validating ? (
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 strokeWidth={1.5} className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Validating video...</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            <Upload strokeWidth={1.5} className="h-8 w-8 text-muted-foreground" />
                            <p className="text-sm font-medium">Click to upload a video</p>
                            <p className="text-xs text-muted-foreground">MP4 or WebM, 4-12 seconds</p>
                        </div>
                    )}
                </div>
            )}

            {/* Upload Progress */}
            {uploading && (
                <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Uploading video...</span>
                        <span className="text-muted-foreground">{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                    <p className="text-xs text-muted-foreground">Please wait, do not close this page</p>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <AlertCircle size={16} strokeWidth={1.5} className=" mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <p className="text-xs text-muted-foreground">
                🎬 <strong>Tip:</strong> Short videos showing the product from different angles help buyers make confident purchases!
            </p>
        </div>
    );
};
