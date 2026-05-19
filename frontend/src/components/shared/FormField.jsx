import { formFieldClass, FORM_LABEL_INVALID } from "../../utils/formValidation"

/**
 * Label + control + inline error for required form fields.
 */
export default function FormField({
  label,
  required = false,
  error,
  hint,
  children,
  className = "",
}) {
  const invalid = Boolean(error)

  return (
    <div className={`${className} ${invalid ? "scroll-mt-4" : ""}`}>
      {label ? (
        <label
          className={`mb-1 block text-sm font-medium ${invalid ? FORM_LABEL_INVALID : "text-gray-700"}`}
        >
          {label}
          {required ? <span className="text-red-500"> *</span> : null}
        </label>
      ) : null}
      {children}
      {invalid ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-red-600" role="alert">
          <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
      ) : null}
    </div>
  )
}

export { formFieldClass }
