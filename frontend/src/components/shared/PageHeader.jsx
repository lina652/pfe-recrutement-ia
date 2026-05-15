import { dashboardGlassClass } from "./DashboardOverviewKit"
import hrIllustration from "../../assets/images/hr-human-resources.png"
import hrIllustration2x from "../../assets/images/hr-human-resources@2x.png"
import managerPortalHeader from "../../assets/images/manager-portal-header.png"
import candidatePortalHeader from "../../assets/images/candidate-portal-header.png"
import adminPortalHeader from "../../assets/images/admin-portal-header.png"
import superAdminPortalHeader from "../../assets/images/superadmin-portal-header.png"

/** Common eyebrow labels per role */
export const PAGE_EYEBROWS = {
  recruiter: "Recruiter · Pipeline",
  manager: "Hiring Manager · Workspace",
  candidate: "Candidate · Portal",
  admin: "Administrator · Console",
  superadmin: "Super Admin · Platform",
}

const PORTAL_BANNER_EYEBROWS = new Set([
  PAGE_EYEBROWS.recruiter,
  PAGE_EYEBROWS.manager,
  PAGE_EYEBROWS.admin,
  PAGE_EYEBROWS.candidate,
  PAGE_EYEBROWS.superadmin,
])

/** Fixed height for HR portal page headers (pages 2–6, etc.) */
export const HR_PAGE_HEADER_HEIGHT = "h-[8.5rem]"

/** Left-side text panel gradient (same layout as hiring manager banner) */
const PORTAL_LEFT_GRADIENT = {
  [PAGE_EYEBROWS.recruiter]: "from-emerald-950/95 via-emerald-900/60 to-transparent",
  [PAGE_EYEBROWS.manager]: "from-slate-950/95 via-slate-900/60 to-transparent",
  [PAGE_EYEBROWS.admin]: "from-violet-950/95 via-violet-900/60 to-transparent",
  [PAGE_EYEBROWS.candidate]: "from-slate-950/95 via-cyan-950/60 to-transparent",
  [PAGE_EYEBROWS.superadmin]: "from-slate-950/95 via-blue-950/75 to-transparent",
}

const PORTAL_BANNER_THEME = {
  [PAGE_EYEBROWS.recruiter]: {
    accent: "text-emerald-300",
    btn: "[&_button]:from-emerald-800 [&_button]:to-emerald-500 [&_button]:hover:from-emerald-700 [&_button]:hover:to-emerald-400",
  },
  [PAGE_EYEBROWS.manager]: {
    accent: "text-sky-300",
    btn: "[&_button]:from-sky-800 [&_button]:to-sky-500 [&_button]:hover:from-sky-700 [&_button]:hover:to-sky-400",
  },
  [PAGE_EYEBROWS.admin]: {
    accent: "text-violet-300",
    btn: "[&_button]:from-violet-800 [&_button]:to-violet-500 [&_button]:hover:from-violet-700 [&_button]:hover:to-violet-400",
  },
  [PAGE_EYEBROWS.candidate]: {
    accent: "text-cyan-300",
    btn: "[&_button]:from-cyan-800 [&_button]:to-cyan-500 [&_button]:hover:from-cyan-700 [&_button]:hover:to-cyan-400",
  },
  [PAGE_EYEBROWS.superadmin]: {
    accent: "text-sky-300",
    btn: "[&_button]:from-sky-900 [&_button]:to-cyan-600 [&_button]:hover:from-sky-800 [&_button]:hover:to-cyan-500",
  },
}

function resolvePortalHeaderImage(eyebrow) {
  if (eyebrow === PAGE_EYEBROWS.manager) {
    return { src: managerPortalHeader, srcSet: undefined }
  }
  if (eyebrow === PAGE_EYEBROWS.candidate) {
    return { src: candidatePortalHeader, srcSet: undefined }
  }
  if (eyebrow === PAGE_EYEBROWS.admin) {
    return { src: adminPortalHeader, srcSet: undefined }
  }
  if (eyebrow === PAGE_EYEBROWS.superadmin) {
    return { src: superAdminPortalHeader, srcSet: undefined }
  }
  return {
    src: hrIllustration,
    srcSet: `${hrIllustration} 1024w, ${hrIllustration2x} 2048w`,
  }
}

function portalImagePositionClass(eyebrow) {
  if (eyebrow === PAGE_EYEBROWS.manager) return "object-[70%_center] sm:object-[right_center]"
  if (eyebrow === PAGE_EYEBROWS.candidate) return "object-[center_45%] sm:object-[right_center]"
  if (eyebrow === PAGE_EYEBROWS.recruiter) return "object-[center_42%]"
  if (eyebrow === PAGE_EYEBROWS.admin) return "object-[55%_center] sm:object-[62%_center]"
  if (eyebrow === PAGE_EYEBROWS.superadmin) return "object-[52%_35%] sm:object-[55%_30%]"
  return "object-center"
}

const portalLeftOverlayClass = (eyebrow) =>
  `pointer-events-none absolute inset-y-0 left-0 w-[min(100%,20rem)] bg-gradient-to-r ${
    PORTAL_LEFT_GRADIENT[eyebrow] ?? PORTAL_LEFT_GRADIENT[PAGE_EYEBROWS.recruiter]
  } sm:w-[min(48%,28rem)]`

const hrBannerButtonClass =
  "[&_button]:!rounded-full [&_button]:!border-0 [&_button]:!bg-gradient-to-r [&_button]:!px-5 [&_button]:!py-2 [&_button]:!text-sm [&_button]:!font-semibold [&_button]:!text-white [&_button]:!shadow-md [&_button]:!transition"

/**
 * Page title block — glass card, or HR banner (photo + dark overlay + white text).
 */
export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  count,
  countLabel,
  children,
  className = "",
  maxWidth = "max-w-6xl",
  showHrArt,
  titleAccent,
}) {
  const usePortalBanner = showHrArt ?? (eyebrow ? PORTAL_BANNER_EYEBROWS.has(eyebrow) : false)
  const theme = eyebrow ? PORTAL_BANNER_THEME[eyebrow] ?? PORTAL_BANNER_THEME[PAGE_EYEBROWS.recruiter] : null
  const { src: headerImage, srcSet: headerSrcSet } = eyebrow
    ? resolvePortalHeaderImage(eyebrow)
    : { src: hrIllustration, srcSet: undefined }

  if (!usePortalBanner) {
    return (
      <div
        className={`relative mx-auto mb-5 min-h-[7.5rem] overflow-hidden !rounded-2xl !p-0 ${dashboardGlassClass} ${maxWidth} ${className}`}
      >
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            {eyebrow ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-800/75">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
            {count != null && countLabel ? (
              <p className="page-glass-pill mt-2.5 inline-flex w-fit items-center gap-2 rounded-full px-3.5 py-1 text-sm font-medium">
                <span className="text-base font-bold tabular-nums text-violet-700">{count}</span>
                <span className="text-slate-500">{countLabel}</span>
              </p>
            ) : subtitle ? (
              <p className="mt-2 text-sm font-medium text-slate-500">{subtitle}</p>
            ) : null}
          </div>
          {children ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
          ) : null}
        </div>
      </div>
    )
  }

  const metaLine =
    count != null && countLabel
      ? `${count} ${countLabel}`
      : subtitle

  return (
    <div
      className={`relative mx-auto mb-5 overflow-hidden rounded-2xl ${HR_PAGE_HEADER_HEIGHT} shadow-lg ${maxWidth} ${className}`}
    >
      <img
        src={headerImage}
        srcSet={headerSrcSet}
        sizes={headerSrcSet ? "(max-width: 1280px) 100vw, 1152px" : undefined}
        alt=""
        className={`absolute inset-0 h-full w-full object-cover ${portalImagePositionClass(eyebrow)}`}
        style={{ transform: "translate3d(0,0,0)", backfaceVisibility: "hidden" }}
        fetchPriority="high"
        decoding="async"
        aria-hidden
      />
      <div className={portalLeftOverlayClass(eyebrow)} aria-hidden />

      <div
        className={`relative z-10 flex h-full flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6 ${hrBannerButtonClass} ${theme.btn}`}
      >
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-0.5 text-xl font-bold leading-tight text-white sm:text-2xl">
            {titleAccent ? (
              <>
                {title}
                {", "}
                <span className={theme.accent}>{titleAccent}</span>
              </>
            ) : (
              title
            )}
          </h1>
          {metaLine ? (
            <p
              className={`mt-1 text-sm font-medium text-white/90 ${
                count != null && countLabel ? "" : "line-clamp-2"
              }`}
            >
              {metaLine}
            </p>
          ) : null}
        </div>
        {children ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
        ) : null}
      </div>
    </div>
  )
}
