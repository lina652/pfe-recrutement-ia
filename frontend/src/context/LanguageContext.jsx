import { createContext, useState, useEffect, useContext } from "react"
import translations from "../i18n/translations"

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("lang") || "en")

  useEffect(() => {
    localStorage.setItem("lang", lang)
    document.dir = lang === "ar" ? "rtl" : "ltr"
    document.documentElement.lang = lang
  }, [lang])

  const t = translations[lang] || translations.en
  const isRTL = lang === "ar"

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)
