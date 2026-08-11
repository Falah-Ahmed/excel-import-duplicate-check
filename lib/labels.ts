export type Lang = "en" | "ar";

const FIELD_LABELS: Record<string, { en: string; ar: string }> = {
  main_parent_name: { en: "Full Name", ar: "الاسم" },
  full_name: { en: "Full Name", ar: "الاسم" },
  full_name_ar: { en: "Arabic Name", ar: "الاسم بالعربي" },
  main_parent_passport_number: { en: "Passport Number", ar: "رقم جواز السفر" },
  passport_number: { en: "Passport Number", ar: "رقم جواز السفر" },
  phone_number_egypt: { en: "Phone Number", ar: "رقم الهاتف" },
  phone_number: { en: "Phone Number", ar: "رقم الهاتف" },
  main_parent_id: { en: "ID Number", ar: "رقم الهوية" },
  id_number: { en: "ID Number", ar: "رقم الهوية" },
  name_3: { en: "Family Name", ar: "اسم الفرد" },
  family_name: { en: "Family Name", ar: "اسم الفرد" },
  age: { en: "Age", ar: "العمر" },
  gender: { en: "Gender", ar: "الجنس" },
};

export const UI = {
  title: { en: "Registered People — Details", ar: "الأشخاص المسجلون — التفاصيل" },
  subtitle: {
    en: "Printable PDF view. Hide any field before printing or sharing.",
    ar: "عرض للطباعة. يمكن إخفاء أي معلومة قبل الطباعة أو المشاركة.",
  },
  english: { en: "English", ar: "English" },
  arabic: { en: "العربية", ar: "العربية" },
  print: { en: "Print / Save PDF", ar: "طباعة / حفظ PDF" },
  showAll: { en: "Show all", ar: "إظهار الكل" },
  hideAll: { en: "Hide all extra", ar: "إخفاء التفاصيل الإضافية" },
  identity: { en: "Personal details", ar: "البيانات الشخصية" },
  extra: { en: "More information", ar: "معلومات إضافية" },
  family: { en: "Family members", ar: "أفراد العائلة" },
  member: { en: "Member", ar: "فرد" },
  hide: { en: "Hide", ar: "إخفاء" },
  show: { en: "Show", ar: "إظهار" },
  hidden: { en: "Hidden", ar: "مخفي" },
  noRecord: {
    en: "Open a Registered People record, or add ?name=RECORD-ID to the URL.",
    ar: "افتح سجل شخص مسجل، أو أضف ?name=رقم-السجل إلى الرابط.",
  },
  loading: { en: "Loading record…", ar: "جاري تحميل السجل…" },
  empty: { en: "No value", ar: "لا توجد قيمة" },
  record: { en: "Record", ar: "السجل" },
};

export function fieldLabel(key: string, lang: Lang): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key][lang];
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function t(key: keyof typeof UI, lang: Lang): string {
  return UI[key][lang];
}
