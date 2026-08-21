"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wizard, ChoiceGrid } from "@/components/ui/Wizard";
import { createRequest } from "@/server/actions/requests";
import { getCommunes, kWilayas } from "@/lib/geo";
import { kRequestIntents } from "@/lib/enums";
import { kIntentParam } from "@/lib/funnel";

const kTitle = { min: 6, max: 90 };
const kBody = { min: 10, max: 600 };

/**
 * Posting a demand, three screens deep.
 *
 * Deliberately shorter than the listing wizard: a demand is a sentence about
 * what someone wants, and every field past that is a reason not to finish. The
 * intent arrives already chosen from the funnel button they pressed, so the
 * first screen opens on a question they have not been asked yet.
 */
export function RequestWizard({ initialIntent }: { initialIntent: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  const [intent, setIntent] = useState(
    initialIntent in kRequestIntents ? initialIntent : "vente",
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [wilayaSlug, setWilayaSlug] = useState("");
  const [communeSlug, setCommuneSlug] = useState("");

  const communes = useMemo(() => {
    const w = kWilayas.find((x) => x.slug === wilayaSlug);
    return w ? getCommunes(w.code) : [];
  }, [wilayaSlug]);

  const field =
    "rounded-input border-border focus:border-primary w-full border bg-white px-4 py-3.5 text-base outline-none";

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createRequest({
        intent,
        title,
        description,
        wilayaSlug,
        communeSlug,
      });
      if (res.ok) {
        router.push(`/merci?type=demande&state=${res.state ?? "review"}`);
        router.refresh();
      } else {
        setError(res.error);
        setNeedsAuth(res.needsAuth === true);
      }
    });
  }

  const back = () => {
    setError(null);
    setNeedsAuth(false);
    setStep((s) => s - 1);
  };
  const next = () => {
    setError(null);
    setNeedsAuth(false);
    setStep((s) => s + 1);
  };

  // The intent they picked rides back through sign-up, so the wizard reopens on
  // their own answer instead of asking for it a second time.
  const returnPath = `/demandes/nouvelle?${kIntentParam}=${intent}`;

  const alert = error && (
    <div
      role="alert"
      className="rounded-input bg-danger/10 text-danger mt-4 px-4 py-3 text-sm font-semibold"
    >
      {error}
      {/* Two buttons rather than a sentence about needing an account. This is
          the end of the wizard, which is the moment somebody has said enough
          about what they want to have a reason to register. */}
      {needsAuth && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/inscription?next=${encodeURIComponent(returnPath)}`}
            className="bg-accent rounded-input px-4 py-2 text-sm font-bold text-white"
          >
            حساب جديد
          </Link>
          <Link
            href={`/connexion?next=${encodeURIComponent(returnPath)}`}
            className="rounded-input border-border border bg-white px-4 py-2 text-sm font-bold"
          >
            عندي حساب
          </Link>
        </div>
      )}
    </div>
  );

  if (step === 1) {
    return (
      <Wizard
        step={1}
        total={3}
        title="واش تحوّس عليه؟"
        canGoNext={title.trim().length >= kTitle.min}
        onNext={next}
      >
        <ChoiceGrid
          options={Object.entries(kRequestIntents).map(([value, label]) => ({
            value,
            label,
          }))}
          value={intent}
          onChange={setIntent}
        />

        <label
          htmlFor="req-title"
          className="mt-6 mb-2 block text-sm font-bold"
        >
          اكتبها في سطر
        </label>
        <input
          id="req-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={kTitle.max}
          autoFocus
          placeholder={
            intent === "vente"
              ? "نشري شقة F3 في باب الزوار"
              : "نكري شقة F2 مفروشة في حيدرة"
          }
          className={field}
        />
        <p className="text-dim mt-1.5 text-xs">
          {kTitle.min} حروف على الأقل — هذا اللي يقراوه الناس الأوّل.
        </p>
        {alert}
      </Wizard>
    );
  }

  if (step === 2) {
    return (
      <Wizard
        step={2}
        total={3}
        title="زيد شوية تفاصيل"
        hint="الميزانية، عدد الغرف، الطابق، وقتاش تحتاجه — كل ما تكون واضح، كل ما جاوبوك ناس أكثر."
        canGoNext={description.trim().length >= kBody.min}
        onBack={back}
        onNext={next}
      >
        <textarea
          id="req-body"
          rows={6}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={kBody.max}
          autoFocus
          placeholder="مثلاً: ميزانيتي 4 ملايين في الشهر، نحتاجها من أوّل الشهر الجاي، ونفضّل قرب الترامواي."
          className={`${field} resize-none`}
        />
        <p className="text-dim ltr-nums mt-1.5 text-xs">
          {description.trim().length} / {kBody.max}
        </p>
        <p className="text-dim mt-3 text-xs leading-relaxed">
          الروابط ممنوعة في الطلبات — رقم الهاتف يتبادل في التعليقات.
        </p>
        {alert}
      </Wizard>
    );
  }

  return (
    <Wizard
      step={3}
      total={3}
      title="وين؟"
      hint="البلدية اختيارية — خلّيها فارغة إذا كل الولاية تنفعك."
      canGoNext={wilayaSlug !== ""}
      nextLabel="انشر الطلب"
      busy={pending}
      onBack={back}
      onNext={submit}
    >
      <label htmlFor="req-wilaya" className="mb-2 block text-sm font-bold">
        الولاية
      </label>
      <select
        id="req-wilaya"
        value={wilayaSlug}
        onChange={(e) => {
          setWilayaSlug(e.target.value);
          // A commune from the previous wilaya would be refused by the server;
          // clearing it is the only sane reading of the change.
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

      <label
        htmlFor="req-commune"
        className="mt-4 mb-2 block text-sm font-bold"
      >
        البلدية
      </label>
      <select
        id="req-commune"
        value={communeSlug}
        onChange={(e) => setCommuneSlug(e.target.value)}
        disabled={!wilayaSlug}
        className={`${field} font-semibold disabled:opacity-50`}
      >
        <option value="">كل بلديات الولاية</option>
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
