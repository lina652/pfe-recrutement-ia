export const LOCATION_TYPES = [
  { value: "REMOTE", label: "Remote" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "ON_SITE", label: "On-site" },
]

export const EXPERIENCE_LEVELS = [
  { value: "ENTRY", label: "Entry" },
  { value: "MID_SENIOR", label: "Mid-Senior" },
  { value: "INTERN", label: "Intern" },
  { value: "DIRECTOR", label: "Director" },
]

export const LANGUAGES = [
  { value: "FRENCH", label: "French" },
  { value: "ENGLISH", label: "English" },
  { value: "ARABIC", label: "Arabic" },
  { value: "OTHER", label: "Other" },
]

export const SOFT_SKILLS = [
  "Leadership",
  "Teamwork",
  "Communication",
  "Problem Solving",
  "Adaptability",
  "Time Management",
  "Critical Thinking",
  "Creativity",
  "Conflict Resolution",
  "Emotional Intelligence",
  "Negotiation",
  "Presentation",
  "Active Listening",
  "Decision Making",
  "OTHER",
]

export const CERTIFICATIONS = [
  "AWS",
  "Azure",
  "Google Cloud",
  "CISSP",
  "PMP",
  "PRINCE2",
  "Scrum Master",
  "ITIL",
  "Cisco CCNA",
  "CompTIA Security+",
  "Oracle Certified",
  "SAP",
  "Six Sigma",
  "OTHER",
]

export function joinList(values) {
  if (!values?.length) return null
  return values.join(",")
}

export function parseList(value) {
  if (!value) return []
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}
