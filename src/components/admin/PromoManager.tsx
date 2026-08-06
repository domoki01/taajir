"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  ImagePlus,
  Trash2,
} from "lucide-react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase/client";
import {
  createPromo,
  deletePromo,
  movePromo,
  setPromoActive,
  updatePromo,
} from "@/server/actions/promos";
import type { Promo } from "@/types/promo";

/**
 * Same downscale the listing form uses. A banner is a wide image an agency
 * exports at whatever their designer had open, and a 5 MB PNG in the first
 * viewport is the single easiest way to make the home page feel slow.
 */
async function shrink(
  file: File,
): Promise<{ blob: Blob; w: number; h: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.85),
  );
  if (!blob) throw new Error("encode failed");
  return { blob, w, h };
}

type Upload = { url: string; path: string; w: number; h: number };

export function PromoManager({ promos }: { promos: Promo[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [upload, setUpload] = useState<Upload | null>(null);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  // Edits are inline, one row at a time.
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editLink, setEditLink] = useState("");

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      setError(null);
      const res = await work();
      if (res.ok) router.refresh();
      else setError(res.error ?? "وقع مشكل");
    });
  }

  async function onPickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const { blob, w, h } = await shrink(file);
      const path = `promos/${crypto.randomUUID()}.webp`;
      const snap = await uploadBytes(ref(storage, path), blob, {
        contentType: "image/webp",
      });
      setUpload({ url: await getDownloadURL(snap.ref), path, w, h });
    } catch (e) {
      console.error(e);
      setError("ما نجحش رفع الصورة. تأكّد من الاتصال وعاود.");
    } finally {
      setUploading(false);
    }
  }

  function onCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!upload) {
      setError("ارفع صورة الإشهار");
      return;
    }
    run(async () => {
      const res = await createPromo({
        imageUrl: upload.url,
        storagePath: upload.path,
        width: upload.w,
        height: upload.h,
        title,
        linkUrl,
      });
      if (res.ok) {
        setUpload(null);
        setTitle("");
        setLinkUrl("");
      }
      return res;
    });
  }

  const field =
    "rounded-input border-border focus:border-primary w-full border bg-white px-4 py-2.5 text-sm outline-none";
  const iconButton =
    "rounded-input border-border hover:border-primary grid size-9 place-items-center border bg-white transition-colors disabled:opacity-40";

  return (
    <div className="space-y-8">
      {/* ── NEW BANNER ───────────────────────────────────────────────────── */}
      <form
        onSubmit={onCreate}
        className="rounded-card border-border bg-surface space-y-3 border p-4"
      >
        <p className="text-sm font-extrabold">زيد إشهار جديد</p>

        <label className="rounded-input border-border hover:border-primary flex cursor-pointer items-center justify-center gap-2 border border-dashed bg-white py-6 text-sm font-bold transition-colors">
          <ImagePlus className="size-5" />
          {uploading ? "جاري الرفع…" : upload ? "بدّل الصورة" : "اختر صورة"}
          <input
            type="file"
            accept="image/*"
            onChange={onPickImage}
            className="hidden"
          />
        </label>

        {upload && (
          <div className="rounded-input relative aspect-[16/5] w-full overflow-hidden">
            <Image
              src={upload.url}
              alt=""
              fill
              sizes="720px"
              className="object-cover"
            />
          </div>
        )}

        <p className="text-dim text-xs leading-relaxed">
          أحسن مقاس عريض (مثلاً 1600×500). الصورة تتقصّ من الأطراف باش تملأ
          البلاصة، خلّي النص في الوسط.
        </p>

        <div>
          <label
            htmlFor="promo-title"
            className="mb-1.5 block text-sm font-bold"
          >
            وصف الإشهار
          </label>
          <input
            id="promo-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="وكالة الأمل العقارية — عروض الخريف"
            className={field}
          />
          <p className="text-dim mt-1 text-xs">
            يظهر للي ما تحمّلتلوش الصورة، وللي يستعمل قارئ الشاشة.
          </p>
        </div>

        <div>
          <label
            htmlFor="promo-link"
            className="mb-1.5 block text-sm font-bold"
          >
            الرابط
          </label>
          <input
            id="promo-link"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            dir="ltr"
            placeholder="https://example.com  ولا  /vente/appartement/alger"
            className={`${field} text-start`}
          />
        </div>

        {error && (
          <p role="alert" className="text-danger text-sm font-bold">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || uploading || !upload}
          className="bg-accent rounded-input px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pending ? "…" : "زيد الإشهار"}
        </button>
      </form>

      {/* ── EXISTING ─────────────────────────────────────────────────────── */}
      <div>
        <p className="mb-3 text-sm font-extrabold">
          الإشهارات الحالية
          <span className="text-dim ltr-nums ms-2 text-xs">
            ({promos.length})
          </span>
        </p>

        {promos.length === 0 ? (
          <p className="text-muted text-sm">
            ما كاش إشهارات. الكاروسال ما يبانش في الصفحة الرئيسية حتى تزيد واحد.
          </p>
        ) : (
          <ul className="space-y-3">
            {promos.map((promo, i) => (
              <li
                key={promo.id}
                className={`rounded-card border-border bg-surface border p-3 ${
                  promo.isActive ? "" : "opacity-60"
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-input relative h-16 w-28 shrink-0 overflow-hidden">
                    <Image
                      src={promo.imageUrl}
                      alt={promo.title}
                      fill
                      sizes="112px"
                      className="object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{promo.title}</p>
                    <p
                      dir="ltr"
                      className="text-dim truncate text-start text-xs"
                    >
                      {promo.linkUrl}
                    </p>
                    {!promo.isActive && (
                      <p className="text-dim mt-1 text-xs font-bold">مخفي</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label="طلّعه"
                      disabled={pending || i === 0}
                      onClick={() => run(() => movePromo(promo.id, "up"))}
                      className={iconButton}
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="نزّله"
                      disabled={pending || i === promos.length - 1}
                      onClick={() => run(() => movePromo(promo.id, "down"))}
                      className={iconButton}
                    >
                      <ArrowDown className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={promo.isActive ? "خبّيه" : "بيّنه"}
                      disabled={pending}
                      onClick={() =>
                        run(() => setPromoActive(promo.id, !promo.isActive))
                      }
                      className={iconButton}
                    >
                      {promo.isActive ? (
                        <Eye className="size-4" />
                      ) : (
                        <EyeOff className="size-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label="امسحه"
                      disabled={pending}
                      onClick={() => {
                        if (!confirm(`تمسح إشهار «${promo.title}»؟`)) return;
                        run(() => deletePromo(promo.id));
                      }}
                      className={`${iconButton} hover:border-danger hover:text-danger`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                {editing === promo.id ? (
                  <div className="mt-3 space-y-2">
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      aria-label="وصف الإشهار"
                      className={field}
                    />
                    <input
                      value={editLink}
                      onChange={(e) => setEditLink(e.target.value)}
                      dir="ltr"
                      aria-label="رابط الإشهار"
                      className={`${field} text-start`}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          run(async () => {
                            const res = await updatePromo(promo.id, {
                              title: editTitle,
                              linkUrl: editLink,
                            });
                            if (res.ok) setEditing(null);
                            return res;
                          })
                        }
                        className="bg-accent rounded-input px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
                      >
                        سجّل
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="rounded-input border-border border bg-white px-4 py-2 text-xs font-bold"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(promo.id);
                      setEditTitle(promo.title);
                      setEditLink(promo.linkUrl);
                    }}
                    className="text-primary mt-2 text-xs font-bold underline"
                  >
                    عدّل الوصف والرابط
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
