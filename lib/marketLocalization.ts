import { Language } from "@/components/i18n/LanguageProvider";

type LocalizedName = {
  name?: string;
  nameKo?: string;
  nameEn?: string;
};

type LocalizedEvent = {
  country?: string;
  countryKo?: string;
  countryEn?: string;
  title?: string;
  titleKo?: string;
  titleEn?: string;
  impact?: string;
  impactKo?: string;
  impactEn?: string;
};

export function getLocalizedAssetName(item: LocalizedName, language: Language) {
  if (language === "ko") return item.nameKo || item.name || item.nameEn || "-";
  return item.nameEn || item.name || item.nameKo || "-";
}

export function getLocalizedEventCountry(item: LocalizedEvent, language: Language) {
  if (language === "ko") return item.countryKo || item.country || item.countryEn || "-";
  return item.countryEn || item.country || item.countryKo || "-";
}

export function getLocalizedEventTitle(item: LocalizedEvent, language: Language) {
  if (language === "ko") return item.titleKo || item.title || item.titleEn || "-";
  return item.titleEn || item.title || item.titleKo || "-";
}

export function getLocalizedImpact(item: LocalizedEvent, language: Language) {
  if (language === "ko") return item.impactKo || item.impact || item.impactEn || "-";
  return item.impactEn || item.impact || item.impactKo || "-";
}
