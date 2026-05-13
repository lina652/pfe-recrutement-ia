import { useEffect, useState } from "react"
import CandidateLayout from "../../components/candidate/CandidateLayout"
import { getCandidateProfile } from "../../api/authApi"

export default function MyProfile() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCandidateProfile()
      .then((res) => setProfile(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <CandidateLayout>
      <div className="flex justify-center mt-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
      </div>
    </CandidateLayout>
  )

  return (
    <CandidateLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
        <p className="text-gray-500 mt-1">Your information extracted from your CV</p>
      </div>

      <div className="max-w-2xl space-y-4">

        {/* Personal Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Personal Information
          </h2>
          <div className="space-y-3">

            <div className="flex justify-between border-b border-gray-100 pb-3">
              <span className="text-sm text-gray-500">Full Name</span>
              <span className="text-sm font-medium text-gray-800">
                {profile?.first_name} {profile?.last_name}
              </span>
            </div>

            <div className="flex justify-between border-b border-gray-100 pb-3">
              <span className="text-sm text-gray-500">Email</span>
              <span className="text-sm font-medium text-gray-800">
                {profile?.email}
              </span>
            </div>

            <div className="flex justify-between border-b border-gray-100 pb-3">
              <span className="text-sm text-gray-500">Phone</span>
              <span className="text-sm font-medium text-gray-800">
                {profile?.phone || "Not provided"}
              </span>
            </div>

            {profile?.linkedin_url && (
  <div className="flex justify-between border-b border-gray-100 pb-3">
    <span className="text-sm text-gray-500">LinkedIn</span>
    <a // <--- You were missing this opening 'a' tag
      href={profile.linkedin_url}
      className="text-sm text-blue-600 hover:underline"
      target="_blank"
      rel="noreferrer"
    >
      View Profile
    </a>
  </div>
)}

          </div>
        </div>

        {/* Skills */}
        {profile?.skills?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Skills Detected by AI
            </h2>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill, i) => (
                <span
                  key={i}
                  className="bg-blue-50 text-blue-700 text-sm px-3 py-1 rounded-full font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Info box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm text-blue-700">
            💡 Your profile was automatically created from your CV.
            More details will be added after the AI pipeline processes your application.
          </p>
        </div>

      </div>
    </CandidateLayout>
  )
}