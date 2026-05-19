export const MIN_MATCH_PERCENTAGE = 40

/** Score bands for semantic matching (display + filter). */
export const MATCH_CATEGORY_KEYS = ["all", "high", "medium", "low"]

export const MATCH_CATEGORY_META = {
  all: {
    labelKey: "matchAllJobs",
    rangeLabel: "40–100%",
    dotColor: "#7B5AC8",
    minScore: 40,
    maxScore: 100,
  },
  high: {
    labelKey: "matchHigh",
    rangeLabel: "80–100%",
    dotColor: "#10b981",
    minScore: 80,
    maxScore: 100,
  },
  medium: {
    labelKey: "matchMedium",
    rangeLabel: "60–79%",
    dotColor: "#0284c7",
    minScore: 60,
    maxScore: 79,
  },
  low: {
    labelKey: "matchLow",
    rangeLabel: "40–59%",
    dotColor: "#d97706",
    minScore: 40,
    maxScore: 59,
  },
}

export function getMatchCategoryKey(score) {
  if (typeof score !== "number") return null
  if (score >= 80) return "high"
  if (score >= 60) return "medium"
  if (score >= 40) return "low"
  return "toobad"
}

export function getMatchCategoryStyle(key) {
  const map = {
    high: {
      bg: "linear-gradient(135deg, #ecfdf5, #d1fae5)",
      border: "#6ee7b7",
      text: "#059669",
      labelKey: "matchHigh",
    },
    medium: {
      bg: "linear-gradient(135deg, #ecfeff, #cffafe)",
      border: "#67e8f9",
      text: "#0891b2",
      labelKey: "matchMedium",
    },
    low: {
      bg: "linear-gradient(135deg, #fef3c7, #fde68a)",
      border: "#fcd34d",
      text: "#d97706",
      labelKey: "matchLow",
    },
    toobad: {
      bg: "linear-gradient(135deg, #fee2e2, #fecaca)",
      border: "#fca5a5",
      text: "#dc2626",
      labelKey: "matchTooBad",
    },
  }
  return map[key] || map.low
}

/** Keep only jobs at or above the minimum relevance threshold. */
export function filterRelevantRankedJobs(jobs) {
  return (jobs || []).filter(
    (j) => typeof j.match_percentage === "number" && j.match_percentage >= MIN_MATCH_PERCENTAGE
  )
}

export function filterJobsByCategory(jobs, categoryKey) {
  const relevant = filterRelevantRankedJobs(jobs)
  if (categoryKey === "all") return relevant
  const band = MATCH_CATEGORY_META[categoryKey]
  if (!band) return relevant
  return relevant.filter(
    (j) => j.match_percentage >= band.minScore && j.match_percentage <= band.maxScore
  )
}

export function countJobsByCategory(jobs) {
  const relevant = filterRelevantRankedJobs(jobs)
  return {
    all: relevant.length,
    high: relevant.filter((j) => j.match_percentage >= 80).length,
    medium: relevant.filter((j) => j.match_percentage >= 60 && j.match_percentage < 80).length,
    low: relevant.filter((j) => j.match_percentage >= 40 && j.match_percentage < 60).length,
    hidden: (jobs || []).filter((j) => typeof j.match_percentage === "number" && j.match_percentage < MIN_MATCH_PERCENTAGE).length,
  }
}
