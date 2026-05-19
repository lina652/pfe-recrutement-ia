import { useEffect } from "react"
import { useParams, useNavigate, useLocation } from "react-router-dom"

/** Legacy route — opens job detail with apply modal. */
export default function Apply() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    navigate(`/jobs/${id}`, {
      replace: true,
      state: {
        openApply: true,
        prefilledFile: location.state?.prefilledFile || null,
      },
    })
  }, [id, navigate, location.state])

  return null
}
