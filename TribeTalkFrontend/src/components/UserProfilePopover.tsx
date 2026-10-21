import * as Popover from "@radix-ui/react-popover"
import { Link } from "react-router-dom"
import { useGetPublicUserProfileQuery } from "../features/auth/auth.api"

export default function UserProfilePopover({ userId, username, children }: { userId: string; username: string; children: React.ReactNode }) {
  const { data: profile, isFetching } = useGetPublicUserProfileQuery(userId)
  return <Popover.Root><Popover.Trigger asChild>{children}</Popover.Trigger><Popover.Portal><Popover.Content side="top" align="start" className="z-50 w-64 rounded-xl border soft-border bg-panel p-4 text-paper shadow-2xl" onOpenAutoFocus={(event) => event.preventDefault()}><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-accent/15 text-accent">{profile?.avatar?<img src={profile.avatar} alt="" className="h-full w-full object-cover"/>:username.slice(0,1).toUpperCase()}</div><div><p className="font-semibold">{profile?.displayName || username}</p><p className="text-xs text-[#899493]">@{username}</p></div></div>{isFetching?<p className="mt-3 text-xs text-[#899493]">Loading profile…</p>:<p className="mt-3 line-clamp-3 text-sm text-[#c0c8c7]">{profile?.bio || "No bio yet."}</p>}<Link to={`/profile/${userId}`} className="mt-3 inline-block text-xs text-accent hover:underline">Open profile</Link><Popover.Arrow className="fill-panel"/></Popover.Content></Popover.Portal></Popover.Root>
}
