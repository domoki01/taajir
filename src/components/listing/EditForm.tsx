"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { editListing } from "@/server/actions/moderation";
import { fromDinars } from "@/lib/price";
import type { Listing } from "@/types/listing";

const field =
  "rounded-input border-border w-full border bg-white px-4 py-3 text-base outline-none focus:border-accent";
const label = "mb-1.5 block text-sm font-bold";

export function EditForm({ listing }: { listing: Listing }) {
  const router = useRouter();

  // Sales are quoted in ملايين and rents in dinars, so the form opens in the
  // unit the seller thinks in rather than making them convert.
  const rental =
    listing.transactionType === "location" ||
    listing.transactionType === "vacances";
  const initialUnit: "dzd" | "million" = rental ? "dzd" : "million";

  const [title, setTitle] = useState(listing.title);
  const [description, setDescription] = useState(listing.description);
  const [priceUnitInput, setPriceUnitInput] = useState(initialUnit);
  const [priceAmount, setPriceAmount] = useState(
    listing.priceOnRequest || listing.price <= 0
      ? ""
      : String(fromDinars(listing.price, initialUnit)),
  );
  const [priceOnRequest, setPriceOnRequest] = useState(listing.priceOnRequest);
  const [isNegotiable, setIsNegotiable] = useState(listing.isNegotiable);
  const [contactPhone, setContactPhone] = useState(listing.contactPhone ?? "");
  const [allowWhatsapp, setAllowWhatsapp] = useState(listing.allowWhatsapp);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    const res = await editListing({
      id: listing.id,
      title,
      description,
      priceAmount: Number(priceAmount || 0),
      priceUnitInput,
      priceOnRequest,
      isNegotiable,
      contactPhone,
      allowWhatsapp,
    });

    if (res.ok) {
      router.push("/tableau-de-bord/annonces?modifie=1");
      router.refresh();
    } else {
      setError(res.error);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <p
          role="alert"
          className="rounded-input bg-danger/10 text-danger px-4 py-3 text-sm font-semibold"
        >
          {error}
        </p>
      )}

      <p className="rounded-input bg-surface-soft text-muted px-4 py-3 text-xs leading-relaxed font-semibold">
        الموقع ونوع العقار ما يتبدّلوش من هنا — هوما اللي يحدّدو رابط الإعلان
        والصفحات اللي يظهر فيها. إذا تبدّلو، انشر إعلان جديد.
      </p>

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
          className={field}
        />
      </div>

      <div>
        <span className={label}>السعر</span>
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
            aria-label="السعر"
            className={`${field} text-start disabled:opacity-50`}
          />
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

        <div className="mt-3 space-y-2">
          <label className="flex items-start gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={isNegotiable}
              onChange={(e) => setIsNegotiable(e.target.checked)}
              className="mt-0.5 size-4 shrink-0"
            />
            <span>السعر قابل للتفاوض</span>
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
                يظهر «السعر بالاتفاق» بدل الرقم.
              </span>
            </span>
          </label>
          {priceOnRequest && priceAmount.trim() !== "" && (
            <p className="rounded-input bg-warning/10 text-warning px-3 py-2 text-xs font-bold">
              السعر اللي كتبت ({priceAmount}) ما راح يتسجّلش.
            </p>
          )}
        </div>
      </div>

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
          className={`${field} text-start`}
        />
        <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={allowWhatsapp}
            onChange={(e) => setAllowWhatsapp(e.target.checked)}
            className="size-4"
          />
          نقبل التواصل عبر واتساب
        </label>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="bg-accent rounded-input w-full py-4 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "جاري الحفظ…" : "احفظ التعديلات"}
      </button>

      {listing.status === "published" && (
        <p className="text-dim text-center text-xs">
          الإعلان يرجع للمراجعة بعد التعديل.
        </p>
      )}
    </form>
  );
}
