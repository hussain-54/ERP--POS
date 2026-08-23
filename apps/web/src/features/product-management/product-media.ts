import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { catalogApi, notifyCatalogChanged } from "./catalog-api";

export const PRODUCT_MEDIA_BUCKET = "product-media";
const MEDIA_SIGNED_URL_TTL_SEC = 3600;

export async function signedMediaUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .storage.from(PRODUCT_MEDIA_BUCKET)
    .createSignedUrl(storagePath, MEDIA_SIGNED_URL_TTL_SEC);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export function useProductMedia(productId: string | undefined, organizationId: string | null) {
  const [media, setMedia] = useState<Array<Record<string, unknown>>>([]);
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);

  const imageMedia = useMemo(
    () => media.filter((item) => String(item.media_type) === "image"),
    [media],
  );

  const primaryImageUrl = useMemo(() => {
    if (pendingPreview) return pendingPreview;
    const primary = imageMedia.find((item) => item.is_primary) ?? imageMedia[0];
    if (!primary) return null;
    return mediaPreviewUrls[String(primary.id)] ?? null;
  }, [imageMedia, mediaPreviewUrls, pendingPreview]);

  const loadMedia = useCallback(async (id: string) => {
    const mediaRes = await catalogApi.listMedia(id);
    setMedia(mediaRes.items);
  }, []);

  useEffect(() => {
    if (!productId) {
      setMedia([]);
      return;
    }
    void loadMedia(productId).catch(() => {
      setMedia([]);
    });
  }, [loadMedia, productId]);

  useEffect(() => {
    return () => {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    };
  }, [pendingPreview]);

  useEffect(() => {
    if (!imageMedia.length) {
      setMediaPreviewUrls({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        imageMedia.map(async (item) => {
          const storagePath = String(item.storage_path ?? "");
          if (!storagePath) return;
          const url = await signedMediaUrl(storagePath);
          if (url) next[String(item.id)] = url;
        }),
      );
      if (!cancelled) setMediaPreviewUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [imageMedia]);

  const uploadMediaToProduct = useCallback(
    async (id: string, file: File, mediaType: string, options?: { isPrimary?: boolean }) => {
      if (!organizationId) throw new Error("Missing organization context");
      const path = `${organizationId}/${id}/${Date.now()}-${file.name}`;
      const supabase = getSupabase();
      const { error } = await supabase.storage.from(PRODUCT_MEDIA_BUCKET).upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
      if (error) throw error;
      await catalogApi.registerMedia(id, {
        mediaType,
        storagePath: path,
        fileName: file.name,
        mimeType: file.type || undefined,
        fileSize: file.size,
        isPrimary: options?.isPrimary ?? (mediaType === "image" && imageMedia.length === 0),
      });
      await loadMedia(id);
      notifyCatalogChanged({ productId: id });
    },
    [imageMedia.length, loadMedia, organizationId],
  );

  const queuePendingImage = useCallback(
    (file: File) => {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
      setPendingImage(file);
      setPendingPreview(URL.createObjectURL(file));
    },
    [pendingPreview],
  );

  const clearPendingImage = useCallback(() => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingImage(null);
    setPendingPreview(null);
  }, [pendingPreview]);

  const uploadMedia = useCallback(
    async (file: File, mediaType: string) => {
      if (!productId) {
        if (mediaType === "image") {
          queuePendingImage(file);
          return;
        }
        throw new Error("Save the product first");
      }
      setUploading(true);
      try {
        await uploadMediaToProduct(productId, file, mediaType);
      } finally {
        setUploading(false);
      }
    },
    [productId, queuePendingImage, uploadMediaToProduct],
  );

  return {
    media,
    imageMedia,
    mediaPreviewUrls,
    primaryImageUrl,
    uploading,
    pendingImage,
    pendingPreview,
    loadMedia,
    uploadMedia,
    uploadMediaToProduct,
    clearPendingImage,
  };
}
