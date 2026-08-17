"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, storage } from "@/lib/firebase/client";
import { createListing } from "@/server/actions/listings";
import { Wizard, ChoiceGrid } from "@/components/ui/Wizard";
import { kMaxImages } from "@/lib/constants";
import {
  kAmenities,
  kConditions,
  kPaperwork,
  kPropertyTypes,
  kRoomCodes,
  kTransactionTypes,
  kLandPropertyTypes,
  kBuiltInTransactionUnits,
  unitIsRental,
  options,
  type TransactionType,
} from "@/lib/enums";
import { getCommunes, kWilayas } from "@/lib/geo";
import { shrinkImage } from "@/lib/image";

type Img = { url: string; w: number; h: number };

const field =
  "rounded-input border-border w-full border bg-white px-4 py-3.5 text-base outline-none focus:border-primary";
const label = "mb-1.5 block text-sm font-bold";

const kSteps = 5;

/**
 * Publishing an ad, five screens deep.
 *
 * It used to be seven sections and eighteen fields on one scroll, with the
 * submit button below all of it — on a phone, a wall. The fields are the same
 * ones and the payload is byte-for-byte what it was; what changed is that only
 * one question is on screen at a time and the button is always under the thumb.
 *
 * Step 4 is entirely optional and says so with a «تخطّى» button. Six specs
 * between a seller and their ad is where people give up, and every one of them
 * can be added later from the dashboard.
 */
export function PostForm({
  transactionOptions,
  propertyOptions,
  initialDeal,
  defaultPhone = "",
}: {
  /**
   * The site's live categories. Passed in from the page rather than read from
   * the enums here: an admin can rename them and add new ones, and this is a
   * client component. Falls back to the code lists when a caller has not been
   * updated, so the form always renders something publishable.
   */
  transactionOptions?: Array<{
    value: string;
    label: string;
    rental?: boolean;
  }>;
  propertyOptions?: Array<{ value: string; label: string }>;
  /** The deal the visitor picked on the funnel, so it is not asked twice. */
  initialDeal?: string | null;
  /** Their phone from sign-up, so the last screen is usually just a glance. */
  defaultPhone?: string;
}) {
  const router = useRouter();

  const deals = transactionOptions?.length
    ? transactionOptions
    : options(kTransactionTypes).map((o) => ({
        value: String(o.value),
        label: o.label,
        rental: unitIsRental(
          kBuiltInTransactionUnits[o.value as TransactionType] ?? "total",
        ),
      }));
  const propertyChoices = propertyOptions?.length
    ? propertyOptions
    : options(kPropertyTypes).map((o) => ({
        value: String(o.value),
        label: o.label,
      }));

  const [step, setStep] = useState(1);

  const [transactionType, setTransactionType] = useState<string>(
    initialDeal && deals.some((d) => d.value === initialDeal)
      ? initialDeal
      : (deals[0]?.value ?? "vente"),
  );
  const [propertyType, setPropertyType] = useState<string>("");
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
  const [contactPhone, setContactPhone] = useState(defaultPhone);
  const [allowWhatsapp, setAllowWhatsapp] = useState(true);
  const [images, setImages] = useState<Img[]>([]);

  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLand = kLandPropertyTypes.includes(propertyType);
  const rental =
    deals.find((d) => d.value === transactionType)?.rental === true;

  const communes = useMemo(() => {
    const w = kWilayas.find((x) => x.slug === wilayaSlug);
    return w ? getCommunes(w.code) : [];
  }, [wilayaSlug]);

  // The rent unit is dinars and the sale unit is ملايين — that is simply how
  // Algerians quote each, and defaulting wrong is a 10 000× typo waiting to
  // happen. Picked here rather than in an effect so it never fights a choice
  // the seller has already made on the price screen.
  function chooseDeal(value: string) {
    setTransactionType(value);
    // Rent is quoted in dinars, a sale in ملايين. Which one this deal is comes
    // from the taxonomy — an admin can add deals, and a pair of hard-coded
    // slugs here would default a new rental to ملايين: a 10 000× typo.
    const rental = deals.find((d) => d.value === value)?.rental === true;
    setPriceUnitInput(rental ? "dzd" : "million");
  }

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
        const { blob, w, h } = await shrinkImage(file, { quality: 0.82 });
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

  async function submit() {
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
      router.push(`/merci?type=annonce&state=${result.state}`);
      router.refresh();
    } else {
      setError(result.error);
      setBusy(false);
    }
  }

  const back = () => {
    setError(null);
    setStep((s) => s - 1);
  };
  const next = () => {
    setError(null);
    setStep((s) => s + 1);
  };

  const alert = error && (
    <p
      role="alert"
      className="rounded-input bg-danger/10 text-danger mt-4 px-4 py-3 text-sm font-semibold"
    >
      {error}
    </p>
  );

  // ── 1. WHAT ────────────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <Wizard
        step={1}
        total={kSteps}
        title="واش عندك؟"
        canGoNext={propertyType !== ""}
        onNext={next}
      >
        <p className={label}>نوع العملية</p>
        <ChoiceGrid
          options={deals.map((d) => ({ value: d.value, label: d.label }))}
          value={transactionType}
          onChange={chooseDeal}
        />

        <p className={`${label} mt-6`}>نوع العقار</p>
        <ChoiceGrid
          options={propertyChoices.map((p) => ({
            value: p.value,
            label: p.label,
          }))}
          value={propertyType}
          onChange={setPropertyType}
        />
        {alert}
      </Wizard>
    );
  }

  // ── 2. WHERE ───────────────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <Wizard
        step={2}
        total={kSteps}
        title="وين راه؟"
        canGoNext={wilayaSlug !== "" && communeSlug !== ""}
        onBack={back}
        onNext={next}
      >
        <label htmlFor="wilaya" className={label}>
          الولاية
        </label>
        <select
          id="wilaya"
          value={wilayaSlug}
          onChange={(e) => {
            setWilayaSlug(e.target.value);
            setCommuneSlug("");
          }}
          className={`${field} font-semibold`}
        >
          <option value="">اختر الولاية</option>
          {kWilayas.map((w) => (
            <option key={w.slug} value={w.slug}>
              {String(w.code).padStart(2, "0")} — {w.nameAr}
            </option>
          ))}
        </select>

        <label htmlFor="commune" className={`${label} mt-4`}>
          البلدية
        </label>
        <select
          id="commune"
          value={communeSlug}
          onChange={(e) => setCommuneSlug(e.target.value)}
          disabled={!wilayaSlug}
          className={`${field} font-semibold disabled:opacity-50`}
        >
          <option value="">اختر البلدية</option>
          {communes.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.nameAr}
            </option>
          ))}
        </select>
        {alert}
      </Wizard>
    );
  }

  // ── 3. HOW MUCH ────────────────────────────────────────────────────────────
  if (step === 3) {
    return (
      <Wizard
        step={3}
        total={kSteps}
        title="بشحال؟"
        canGoNext={priceOnRequest || priceAmount.trim() !== ""}
        onBack={back}
        onNext={next}
      >
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            dir="ltr"
            disabled={priceOnRequest}
            value={priceAmount}
            onChange={(e) => setPriceAmount(e.target.value)}
            placeholder={rental ? "45000" : "800"}
            aria-label="السعر"
            className={`${field} ltr-nums text-start text-xl font-black disabled:opacity-50`}
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
            className={`${field} w-28 shrink-0 font-bold disabled:opacity-50`}
          >
            <option value="million">مليون</option>
            <option value="dzd">دج</option>
          </select>
        </div>

        {/* These two used to read almost identically ("بالاتفاق" vs "قابل
            للتفاوض"), and ticking the first silently threw away a price the
            seller had already typed. Now the first says plainly that the price
            will be hidden, and a warning appears when it would discard input. */}
        <div className="mt-5 space-y-3">
          <label className="flex items-start gap-2.5 text-sm font-semibold">
            <input
              type="checkbox"
              checked={isNegotiable}
              onChange={(e) => setIsNegotiable(e.target.checked)}
              className="mt-0.5 size-5 shrink-0"
            />
            <span>
              السعر قابل للتفاوض
              <span className="text-dim block text-xs font-normal">
                يظهر السعر، مع إشارة أنه قابل للنقاش.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2.5 text-sm font-semibold">
            <input
              type="checkbox"
              checked={priceOnRequest}
              onChange={(e) => setPriceOnRequest(e.target.checked)}
              className="mt-0.5 size-5 shrink-0"
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
              السعر اللي كتبت (<span className="ltr-nums">{priceAmount}</span>)
              ما راح يتسجّلش. حيّد العلامة إذا تحب يظهر.
            </p>
          )}
        </div>
        {alert}
      </Wizard>
    );
  }

  // ── 4. SPECS (optional) ────────────────────────────────────────────────────
  if (step === 4) {
    return (
      <Wizard
        step={4}
        total={kSteps}
        title="تفاصيل العقار"
        hint="كلها اختيارية — تقدر تزيدها من بعد. لكن إعلان مفصّل يجيب زبائن أكثر."
        canGoNext
        onBack={back}
        onNext={next}
        onSkip={next}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {!isLand && (
            <div>
              <label htmlFor="ab" className={label}>
                المساحة المبنية (م²)
              </label>
              <input
                id="ab"
                type="number"
                min={0}
                inputMode="numeric"
                dir="ltr"
                value={areaBuilt}
                onChange={(e) => setAreaBuilt(e.target.value)}
                className={`${field} ltr-nums text-start`}
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
              inputMode="numeric"
              dir="ltr"
              value={areaLand}
              onChange={(e) => setAreaLand(e.target.value)}
              className={`${field} ltr-nums text-start`}
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
                  inputMode="numeric"
                  dir="ltr"
                  value={bathrooms}
                  onChange={(e) => setBathrooms(e.target.value)}
                  className={`${field} ltr-nums text-start`}
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
                  inputMode="numeric"
                  dir="ltr"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className={`${field} ltr-nums text-start`}
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

        <fieldset className="mt-5">
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
                  className={`rounded-input min-h-11 border px-3.5 py-2 text-xs font-bold transition-colors ${
                    on
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border text-muted bg-white"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </fieldset>
        {alert}
      </Wizard>
    );
  }

  // ── 5. PHOTOS, WORDS, CONTACT ──────────────────────────────────────────────
  const ready =
    title.trim().length >= 10 &&
    description.trim().length >= 20 &&
    contactPhone.trim() !== "";

  return (
    <Wizard
      step={5}
      total={kSteps}
      title="صوّرو واحكي عليه"
      canGoNext={ready}
      nextLabel="انشر الإعلان"
      busy={busy || uploading}
      onBack={back}
      onNext={submit}
    >
      <p className="text-dim mb-3 text-xs leading-relaxed">
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

      <label htmlFor="title" className={`${label} mt-5`}>
        العنوان
      </label>
      <input
        id="title"
        minLength={10}
        maxLength={90}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="شقة F3 للكراء في باب الزوار"
        className={field}
      />

      <label htmlFor="desc" className={`${label} mt-4`}>
        الوصف
      </label>
      <textarea
        id="desc"
        minLength={20}
        maxLength={3000}
        rows={5}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="اشرح العقار: الموقع، الحالة، ما هو قريب منه، وأي تفصيل يهمّ الزبون."
        className={`${field} resize-none`}
      />

      <label htmlFor="phone" className={`${label} mt-4`}>
        رقم الهاتف للتواصل
      </label>
      <input
        id="phone"
        dir="ltr"
        inputMode="tel"
        autoComplete="tel"
        value={contactPhone}
        onChange={(e) => setContactPhone(e.target.value)}
        placeholder="0555 00 00 00"
        className={`${field} ltr-nums text-start`}
      />
      <label className="mt-3 flex items-center gap-2.5 text-sm font-semibold">
        <input
          type="checkbox"
          checked={allowWhatsapp}
          onChange={(e) => setAllowWhatsapp(e.target.checked)}
          className="size-5"
        />
        نقبل التواصل عبر واتساب
      </label>

      <p className="text-dim mt-4 text-xs leading-relaxed">
        الإعلان يمرّ على المراجعة قبل ما يظهر للعموم.
      </p>
      {alert}
    </Wizard>
  );
}
