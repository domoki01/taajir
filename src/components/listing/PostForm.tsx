"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, storage } from "@/lib/firebase/client";
import { createListing } from "@/server/actions/listings";
import { kMaxImages } from "@/lib/constants";
import {
  kAmenities,
  kConditions,
  kPaperwork,
  kPropertyTypes,
  kRoomCodes,
  kTransactionTypes,
  kLandPropertyTypes,
  options,
  type PropertyType,
  type TransactionType,
} from "@/lib/enums";
import { getCommunes, kWilayas } from "@/lib/geo";

type Img = { url: string; w: number; h: number };

const field =
  "rounded-input border-border w-full border bg-white px-4 py-3 text-base outline-none focus:border-primary";
const label = "mb-1.5 block text-sm font-bold";

/**
 * Downscale in the browser before upload. A phone photo is 4-8 MB; at 1600px
 * WebP it lands around 200 KB. On an Algerian mobile connection that is the
 * difference between an ad that posts and one that times out.
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
    canvas.toBlob(resolve, "image/webp", 0.82),
  );
  if (!blob) throw new Error("encode failed");
  return { blob, w, h };
}

export function PostForm() {
  const router = useRouter();

  const [transactionType, setTransactionType] =
    useState<TransactionType>("vente");
  const [propertyType, setPropertyType] = useState<PropertyType>("appartement");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceAmount, setPriceAmount] = useState("");
  const [priceUnitInput, setPriceUnitInput] = useState<"dzd" | "million">(
    "million",
  );
  const [priceOnRequest, setPriceOnRequest] = useState(false);
  const [isNegotiable, setIsNegotiable] = useState(false);
  const [areaBuilt, setAreaBuilt] = useState("");
  const [areaLand, setAreaLand] = useState("");
  const [roomsCode, setRoomsCode] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [floor, setFloor] = useState("");
  const [condition, setCondition] = useState("");
  const [paperwork, setPaperwork] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [wilayaSlug, setWilayaSlug] = useState("");
  const [communeSlug, setCommuneSlug] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [allowWhatsapp, setAllowWhatsapp] = useState(true);
  const [images, setImages] = useState<Img[]>([]);

  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLand = kLandPropertyTypes.includes(propertyType);
  const rental =
    transactionType === "location" || transactionType === "vacances";

  const communes = useMemo(() => {
    const w = kWilayas.find((x) => x.slug === wilayaSlug);
    return w ? getCommunes(w.code) : [];
  }, [wilayaSlug]);

  async function onPickImages(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    const user = auth.currentUser;
    if (!user) {
      setError("لازم تسجّل الدخول باش ترفع صور");
      return;
    }
    if (images.length + files.length > kMaxImages) {
      setError(`أقصى عدد صور هو ${kMaxImages}`);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const uploaded: Img[] = [];
      for (const file of files) {
        const { blob, w, h } = await shrink(file);
        // The path is pinned under the uploader's own uid; storage.rules
        // rejects a write anywhere else.
        const path = `listings/${user.uid}/draft/${crypto.randomUUID()}.webp`;
        const snap = await uploadBytes(ref(storage, path), blob, {
          contentType: "image/webp",
        });
        uploaded.push({ url: await getDownloadURL(snap.ref), w, h });
      }
      setImages((prev) => [...prev, ...uploaded]);
    } catch (e) {
      console.error(e);
      setError("ما نجحش رفع الصور. تأكّد من الاتصال وعاود.");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || uploading) return;
    setBusy(true);
    setError(null);

    const num = (v: string) => (v.trim() === "" ? null : Number(v));

    const result = await createListing({
      transactionType,
      propertyType,
      title,
      description,
      priceAmount: Number(priceAmount || 0),
      priceUnitInput,
      priceOnRequest,
      isNegotiable,
      areaBuilt: isLand ? null : num(areaBuilt),
      areaLand: num(areaLand),
      roomsCode: roomsCode || null,
      bathrooms: num(bathrooms),
      floor: num(floor),
      condition: condition || null,
      paperwork: paperwork || null,
      amenities,
      wilayaSlug,
      communeSlug,
      contactPhone,
      allowWhatsapp,
      images,
    });

    if (result.ok) {
      router.push("/tableau-de-bord/annonces?nouveau=1");
      router.refresh();
    } else {
      setError(result.error);
      setBusy(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {error && (
        <p
          role="alert"
          className="rounded-input bg-danger/10 text-danger px-4 py-3 text-sm font-semibold"
        >
          {error}
        </p>
      )}

      {/* ── DEAL ─────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-base font-extrabold">نوع الإعلان</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="tx" className={label}>
              المعاملة
            </label>
            <select
              id="tx"
              value={transactionType}
              onChange={(e) =>
                setTransactionType(e.target.value as TransactionType)
              }
              className={field}
            >
              {options(kTransactionTypes).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pt" className={label}>
              نوع العقار
            </label>
            <select
              id="pt"
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value as PropertyType)}
              className={field}
            >
              {options(kPropertyTypes).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* ── LOCATION ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-base font-extrabold">الموقع</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="wilaya" className={label}>
              الولاية
            </label>
            <select
              id="wilaya"
              required
              value={wilayaSlug}
              onChange={(e) => {
                setWilayaSlug(e.target.value);
                setCommuneSlug("");
              }}
              className={field}
            >
              <option value="">اختر الولاية</option>
              {kWilayas.map((w) => (
                <option key={w.slug} value={w.slug}>
                  {String(w.code).padStart(2, "0")} — {w.nameAr}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="commune" className={label}>
              البلدية
            </label>
            <select
              id="commune"
              required
              disabled={!wilayaSlug}
              value={communeSlug}
              onChange={(e) => setCommuneSlug(e.target.value)}
              className={`${field} disabled:opacity-50`}
            >
              <option value="">
                {wilayaSlug ? "اختر البلدية" : "اختر الولاية الأول"}
              </option>
              {communes.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.nameAr}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* ── PRICE ────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-base font-extrabold">السعر</h2>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            dir="ltr"
            disabled={priceOnRequest}
            required={!priceOnRequest}
            value={priceAmount}
            onChange={(e) => setPriceAmount(e.target.value)}
            placeholder={rental ? "45000" : "800"}
            aria-label="السعر"
            className={`${field} text-start disabled:opacity-50`}
          />
          {/* Algerians quote sales in ملايين and rents in dinars; the toggle
              defaults accordingly and the server stores dinars either way. */}
          <select
            value={priceUnitInput}
            onChange={(e) =>
              setPriceUnitInput(e.target.value as "dzd" | "million")
            }
            disabled={priceOnRequest}
            aria-label="وحدة السعر"
            className={`${field} w-32 disabled:opacity-50`}
          >
            <option value="million">مليون</option>
            <option value="dzd">دج</option>
          </select>
        </div>
        {/* These two used to read almost identically ("بالاتفاق" vs "قابل
            للتفاوض"), and ticking the first silently threw away a price the
            seller had already typed. Now the first says plainly that the price
            will be hidden, and a warning appears when it would discard input. */}
        <div className="mt-3 space-y-2">
          <label className="flex items-start gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={isNegotiable}
              onChange={(e) => setIsNegotiable(e.target.checked)}
              className="mt-0.5 size-4 shrink-0"
            />
            <span>
              السعر قابل للتفاوض
              <span className="text-dim block text-xs font-normal">
                يظهر السعر، مع إشارة أنه قابل للنقاش.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={priceOnRequest}
              onChange={(e) => setPriceOnRequest(e.target.checked)}
              className="mt-0.5 size-4 shrink-0"
            />
            <span>
              لا تعرض السعر إطلاقاً
              <span className="text-dim block text-xs font-normal">
                يظهر «السعر بالاتفاق» بدل الرقم، والزبون لازم يتصل بيك.
              </span>
            </span>
          </label>

          {priceOnRequest && priceAmount.trim() !== "" && (
            <p className="rounded-input bg-warning/10 text-warning px-3 py-2 text-xs font-bold">
              السعر اللي كتبت ({priceAmount}) ما راح يتسجّلش. حيّد العلامة إذا
              تحب يظهر.
            </p>
          )}
        </div>
      </section>

      {/* ── SPECS ────────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-base font-extrabold">المواصفات</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {!isLand && (
            <div>
              <label htmlFor="ab" className={label}>
                المساحة المبنية (م²)
              </label>
              <input
                id="ab"
                type="number"
                min={0}
                dir="ltr"
                value={areaBuilt}
                onChange={(e) => setAreaBuilt(e.target.value)}
                className={`${field} text-start`}
              />
            </div>
          )}
          <div>
            <label htmlFor="al" className={label}>
              مساحة الأرض (م²)
            </label>
            <input
              id="al"
              type="number"
              min={0}
              dir="ltr"
              value={areaLand}
              onChange={(e) => setAreaLand(e.target.value)}
              className={`${field} text-start`}
            />
          </div>
          {!isLand && (
            <>
              <div>
                <label htmlFor="rooms" className={label}>
                  عدد الغرف
                </label>
                <select
                  id="rooms"
                  value={roomsCode}
                  onChange={(e) => setRoomsCode(e.target.value)}
                  className={field}
                >
                  <option value="">غير محدّد</option>
                  {options(kRoomCodes).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="bath" className={label}>
                  عدد الحمّامات
                </label>
                <input
                  id="bath"
                  type="number"
                  min={0}
                  dir="ltr"
                  value={bathrooms}
                  onChange={(e) => setBathrooms(e.target.value)}
                  className={`${field} text-start`}
                />
              </div>
              <div>
                <label htmlFor="floor" className={label}>
                  الطابق (0 = أرضي)
                </label>
                <input
                  id="floor"
                  type="number"
                  min={0}
                  dir="ltr"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className={`${field} text-start`}
                />
              </div>
              <div>
                <label htmlFor="cond" className={label}>
                  الحالة
                </label>
                <select
                  id="cond"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  className={field}
                >
                  <option value="">غير محدّدة</option>
                  {options(kConditions).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div className={isLand ? "" : "sm:col-span-2"}>
            <label htmlFor="paper" className={label}>
              الوثائق
            </label>
            <select
              id="paper"
              value={paperwork}
              onChange={(e) => setPaperwork(e.target.value)}
              className={field}
            >
              <option value="">غير محدّدة</option>
              {options(kPaperwork).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-dim mt-1.5 text-xs">
              أول حاجة يسأل عليها المشتري.
            </p>
          </div>
        </div>

        <fieldset className="mt-4">
          <legend className={label}>المرافق</legend>
          <div className="flex flex-wrap gap-2">
            {options(kAmenities).map((o) => {
              const on = amenities.includes(o.value as string);
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setAmenities((prev) =>
                      on
                        ? prev.filter((a) => a !== o.value)
                        : [...prev, o.value as string],
                    )
                  }
                  className={`rounded-input border px-3 py-2 text-xs font-bold transition-colors ${
                    on
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-white"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      </section>

      {/* ── CONTENT ──────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-base font-extrabold">وصف الإعلان</h2>
        <div className="space-y-3">
          <div>
            <label htmlFor="title" className={label}>
              العنوان
            </label>
            <input
              id="title"
              required
              minLength={10}
              maxLength={90}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="شقة F3 للكراء في باب الزوار"
              className={field}
            />
          </div>
          <div>
            <label htmlFor="desc" className={label}>
              الوصف
            </label>
            <textarea
              id="desc"
              required
              minLength={20}
              maxLength={3000}
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="اشرح العقار: الموقع، الحالة، ما هو قريب منه، وأي تفصيل يهمّ الزبون."
              className={field}
            />
          </div>
        </div>
      </section>

      {/* ── PHOTOS ───────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-1 text-base font-extrabold">الصور</h2>
        <p className="text-dim mb-3 text-xs">
          الإعلان بصور يجيب زبائن أكثر بكثير. أول صورة هي اللي تظهر في القائمة.
        </p>

        {images.length > 0 && (
          <ul className="mb-3 flex flex-wrap gap-2">
            {images.map((img, i) => (
              <li key={img.url} className="relative">
                <div className="rounded-input bg-surface-soft relative size-24 overflow-hidden">
                  <Image
                    src={img.url}
                    alt=""
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </div>
                <button
                  type="button"
                  aria-label="حذف الصورة"
                  onClick={() =>
                    setImages((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="bg-danger absolute -end-1.5 -top-1.5 grid size-6 place-items-center rounded-full text-white"
                >
                  <X className="size-3.5" strokeWidth={3} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <label className="rounded-input border-border hover:border-primary flex cursor-pointer items-center justify-center gap-2 border border-dashed bg-white px-4 py-6 text-sm font-bold transition-colors">
          {uploading ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              جاري الرفع…
            </>
          ) : (
            <>
              <ImagePlus className="size-5" />
              زيد صور
            </>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            disabled={uploading}
            onChange={onPickImages}
          />
        </label>
      </section>

      {/* ── CONTACT ──────────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-base font-extrabold">التواصل</h2>
        <div>
          <label htmlFor="phone" className={label}>
            رقم الهاتف
          </label>
          <input
            id="phone"
            required
            dir="ltr"
            inputMode="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="+213 555 00 00 00"
            className={`${field} text-start`}
          />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={allowWhatsapp}
            onChange={(e) => setAllowWhatsapp(e.target.checked)}
            className="size-4"
          />
          نقبل التواصل عبر واتساب
        </label>
      </section>

      <div className="border-border sticky bottom-0 -mx-4 border-t bg-white/95 p-4 backdrop-blur sm:mx-0 sm:rounded-b-[20px]">
        <button
          type="submit"
          disabled={busy || uploading}
          className="bg-accent rounded-input w-full py-4 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "جاري النشر…" : "انشر الإعلان"}
        </button>
        <p className="text-dim mt-2 text-center text-xs">
          الإعلان يمرّ على المراجعة قبل ما يظهر للعموم.
        </p>
      </div>
    </form>
  );
}
