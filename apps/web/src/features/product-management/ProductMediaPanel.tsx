import { Card } from "@electronic-erp/ui";

export function ProductMediaPanel({
  mode,
  primaryImageUrl,
  imageMedia,
  mediaPreviewUrls,
  media,
  uploading,
  onUploadImage,
  onUploadOther,
}: {
  mode: "create" | "edit";
  primaryImageUrl: string | null;
  imageMedia: Array<Record<string, unknown>>;
  mediaPreviewUrls: Record<string, string>;
  media: Array<Record<string, unknown>>;
  uploading: boolean;
  onUploadImage: (file: File) => void;
  onUploadOther?: (file: File, type: string) => void;
}) {
  return (
    <>
      <Card
        title="Product image"
        description={
          mode === "create"
            ? "Choose a photo now — it uploads automatically when you create the product."
            : "Primary image appears on POS product tiles after save."
        }
      >
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-dashed border-[var(--erp-border)] bg-[var(--erp-surface-muted)]">
            {primaryImageUrl ? (
              <img src={primaryImageUrl} alt="Product" className="h-full w-full object-cover" />
            ) : (
              <span className="px-4 text-center text-sm text-[var(--erp-muted)]">No image yet</span>
            )}
          </div>
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--erp-muted)]">Upload image (JPG, PNG, WebP)</span>
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUploadImage(file);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            {mode === "edit" && imageMedia.length > 1 ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {imageMedia.slice(1).map((item) => {
                  const preview = mediaPreviewUrls[String(item.id)];
                  return (
                    <div
                      key={String(item.id)}
                      className="aspect-square overflow-hidden rounded border border-[var(--erp-border)] bg-[var(--erp-surface-muted)]"
                    >
                      {preview ? (
                        <img src={preview} alt={String(item.file_name)} className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full items-center justify-center px-1 text-xs text-[var(--erp-muted)]">
                          {String(item.file_name)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      {mode === "edit" && onUploadOther ? (
        <Card title="Other media" description="Datasheets, manuals, and videos (optional).">
          <div className="grid gap-3 md:grid-cols-2">
            {(
              [
                ["video", "Product video"],
                ["datasheet", "Datasheet PDF"],
                ["manual", "Installation manual"],
                ["spec_sheet", "Specification sheet"],
              ] as const
            ).map(([type, label]) => (
              <label key={type} className="block text-sm">
                <span className="mb-1 block text-[var(--erp-muted)]">{label}</span>
                <input
                  type="file"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUploadOther(file, type);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            ))}
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {media
              .filter((m) => String(m.media_type) !== "image")
              .map((m) => (
                <li key={String(m.id)}>
                  {String(m.media_type)} — {String(m.file_name)}
                </li>
              ))}
            {!media.some((m) => String(m.media_type) !== "image") ? (
              <li className="text-[var(--erp-muted)]">No documents uploaded yet.</li>
            ) : null}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
