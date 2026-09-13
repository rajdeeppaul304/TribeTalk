import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useGetPublicUserProfileQuery, useUpdateProfileMutation } from "../features/auth/auth.api"
import { useAuth } from "../features/auth/useAuth"
import { useUploadImageMutation } from "../features/uploads/upload.api"

const initials = (name: string) => name.slice(0, 2).toUpperCase()

export default function Profile() {
  const { userId } = useParams()
  const { user, token, setAuth } = useAuth()
  const isOwnProfile = userId === user?._id
  const { data: profile, isLoading, isError, refetch } = useGetPublicUserProfileQuery(userId ?? "", { skip: !userId })
  const [updateProfile, { isLoading: isSaving }] = useUpdateProfileMutation()
  const [uploadImage, { isLoading: isUploading }] = useUploadImageMutation()
  const [displayName, setDisplayName] = useState("")
  const [avatar, setAvatar] = useState("")
  const [bio, setBio] = useState("")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!profile) return
    setDisplayName(profile.displayName || profile.username)
    setAvatar(profile.avatar || "")
    setBio(profile.bio || "")
  }, [profile])

  if (isLoading) return <div className="min-h-screen bg-gray-900 p-8 text-gray-300">Loading profile...</div>
  if (isError || !profile) return <div className="min-h-screen bg-gray-900 p-8 text-red-300">Profile not found.</div>

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    setMessage("")
    try {
      const updatedUser = await updateProfile({ displayName, avatar, bio }).unwrap()
      if (token) setAuth(updatedUser, token)
      await refetch()
      setMessage("Profile saved.")
    } catch {
      setMessage("Could not save your profile. Check the avatar URL and try again.")
    }
  }

  const chooseAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const image = event.target.files?.[0]
    if (!image) return
    setMessage("")
    try {
      const attachment = await uploadImage(image).unwrap()
      setAvatar(attachment.url)
      setMessage("Avatar uploaded. Save your profile to apply it.")
    } catch {
      setMessage("Could not upload this image. Check the file and Cloudinary configuration.")
    } finally {
      event.target.value = ""
    }
  }

  return (
    <main className="min-h-screen bg-gray-900 p-6 text-white">
      <Link to="/home" className="text-sm text-blue-300 hover:text-blue-200">← Back to chat</Link>
      <section className="mx-auto mt-8 max-w-xl rounded-xl bg-gray-800 p-6 shadow-xl">
        <div className="flex items-center gap-4">
          {profile.avatar ? (
            <img src={profile.avatar} alt={`${profile.displayName}'s avatar`} className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold">
              {initials(profile.displayName || profile.username)}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">{profile.displayName || profile.username}</h1>
            <p className="text-gray-400">@{profile.username}</p>
          </div>
        </div>

        {isOwnProfile ? (
          <form onSubmit={saveProfile} className="mt-7 space-y-4">
            <label className="block text-sm">Display name
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={50} className="mt-1 w-full rounded bg-gray-700 p-2 text-white" required />
            </label>
            <label className="block text-sm">Avatar URL
              <input value={avatar} onChange={(event) => setAvatar(event.target.value)} placeholder="https://example.com/avatar.png" className="mt-1 w-full rounded bg-gray-700 p-2 text-white" />
            </label>
            <label className="block text-sm">Or upload an avatar image
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={chooseAvatar} disabled={isUploading} className="mt-1 block w-full text-sm text-gray-300" />
            </label>
            <label className="block text-sm">About me
              <textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={300} rows={4} className="mt-1 w-full rounded bg-gray-700 p-2 text-white" placeholder="Tell your communities a little about yourself." />
            </label>
            {message && <p className={message === "Profile saved." ? "text-green-300" : "text-red-300"}>{message}</p>}
            <button type="submit" disabled={isSaving || isUploading} className="rounded bg-blue-600 px-4 py-2 font-medium hover:bg-blue-500 disabled:opacity-50">
              {isUploading ? "Uploading..." : isSaving ? "Saving..." : "Save profile"}
            </button>
          </form>
        ) : (
          <div className="mt-7 border-t border-gray-700 pt-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">About</h2>
            <p className="mt-2 whitespace-pre-wrap text-gray-200">{profile.bio || "This user has not added an about section yet."}</p>
          </div>
        )}
      </section>
    </main>
  )
}
