import fs from "fs"
import path from "path"

const pagesDir = path.join("src", "pages")
const importLine =
  'import PageHeader, { PAGE_EYEBROWS } from "../../components/shared/PageHeader"'

const configs = [
  {
    file: "manager/JobRequirements.jsx",
    layoutLine: 'import ManagerLayout from "../../components/manager/ManagerLayout"',
    old: `      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Job Requirements</h1>
        <p className="text-gray-500 mt-1">Create a job request, then HR will approve or reject it.</p>
      </motion.div>`,
    new: `      <PageHeader
        eyebrow={PAGE_EYEBROWS.manager}
        title="Job Requirements"
        subtitle="Create a job request, then HR will approve or reject it."
      />`,
  },
]

// fix typo in first config - use </motion.div> wrong - use </div>
