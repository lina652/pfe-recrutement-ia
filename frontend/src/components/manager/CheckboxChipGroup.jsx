import { formFieldClass, FORM_LABEL_INVALID } from "../../utils/formValidation"

/**
 * Multi-select chips for manager job requirement forms.
 */
export default function CheckboxChipGroup({
  label,
  required = false,
  options,
  selected,
  onChange,
  otherSelected = false,
  otherValue = "",
  onOtherChange,
  otherPlaceholder = "Specify other…",
  error,
  otherError,
}) {
  const invalid = Boolean(error || otherError)

  const toggle = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  return (
    <div className={invalid && error ? "rounded-xl ring-2 ring-red-500/20 ring-offset-2 ring-offset-transparent" : ""}>
      <label className={`mb-2 block text-sm font-medium ${invalid && error ? FORM_LABEL_INVALID : "text-gray-700"}`}>
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const value = typeof opt === "string" ? opt : opt.value
          const text = typeof opt === "string" ? opt : opt.label
          const active = selected.includes(value)
          return (
            <button
              key={value}
              type="button"
              onClick={() => toggle(value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "border-violet-400 bg-violet-100 text-violet-900"
                  : "border-slate-200 bg-white/60 text-slate-600 hover:border-violet-200 hover:bg-violet-50/80"
              }`}
            >
              {text}
            </button>
          )
        })}
      </div>
      {error ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-red-600" role="alert">
          <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden />
          {error}
        </p>
      ) : null}
      {otherSelected && onOtherChange && (
        <input
          type="text"
          value={otherValue}
          onChange={(e) => onOtherChange(e.target.value)}
          className={formFieldClass(Boolean(otherError), "mt-2")}
          placeholder={otherPlaceholder}
          aria-invalid={otherError ? "true" : undefined}
        />
      )}
      {otherError ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-red-600" role="alert">
          <span className="mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden />
          {otherError}
        </p>
      ) : null}
    </div>
  )
}
