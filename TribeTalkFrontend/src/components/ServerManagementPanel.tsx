import { useState } from "react"
import { useCreateInviteMutation, useGetInvitesQuery, useGetServerByIdQuery, useRemoveMemberMutation, useRevokeInviteMutation, useSetMemberRoleMutation } from "../features/servers/server.api"
import { copyToClipboard } from "../utils/commonTools"

export default function ServerManagementPanel({ serverId }: { serverId: string }) {
  const { data: server, refetch } = useGetServerByIdQuery(serverId)
  const { data: invites = [] } = useGetInvitesQuery(serverId, { skip: !server || server.role === "member" })
  const [createInvite] = useCreateInviteMutation(); const [revokeInvite] = useRevokeInviteMutation()
  const [setRole] = useSetMemberRoleMutation(); const [removeMember] = useRemoveMemberMutation()
  const [open, setOpen] = useState(false)
  if (!server || server.role === "member") return null
  const inviteUrl = (code: string) => `${window.location.origin}/server/join-server/${serverId}?invite=${encodeURIComponent(code)}`
  const updateRole = async (memberId: string, role: "member" | "moderator") => { await setRole({ serverId, memberId, role }); refetch() }
  const remove = async (memberId: string) => { if (window.confirm("Remove this member?")) { await removeMember({ serverId, memberId }); refetch() } }
  return <div className="mt-3 border-t border-gray-700 pt-3 text-sm">
    <button onClick={() => setOpen(!open)} className="w-full rounded bg-gray-700 px-2 py-1 text-left hover:bg-gray-600">Manage server</button>
    {open && <div className="mt-2 space-y-2 text-gray-200">
      <button onClick={async () => { const invite = await createInvite({ serverId, expiresInHours: 24, maxUses: 25 }).unwrap(); copyToClipboard(inviteUrl(invite.code)) }} className="w-full rounded bg-blue-700 px-2 py-1 hover:bg-blue-600">Create 24h / 25-use invite</button>
      {invites.filter((invite) => !invite.revokedAt).slice(0, 3).map((invite) => <div key={invite._id} className="rounded bg-gray-900 p-2"><div className="truncate">{invite.uses}/{invite.maxUses ?? "∞"} uses</div><button onClick={() => copyToClipboard(inviteUrl(invite.code))} className="mr-2 text-blue-300">Copy</button><button onClick={() => revokeInvite({ serverId, inviteId: invite._id })} className="text-red-300">Revoke</button></div>)}
      <div className="font-medium">Members</div>
      {[...server.moderators, ...server.members].map((member) => <div key={member._id} className="flex items-center justify-between gap-1"><span className="truncate">{member.username}</span>{server.role === "owner" && <button onClick={() => updateRole(member._id, server.moderators.some((m) => m._id === member._id) ? "member" : "moderator")} className="text-blue-300">{server.moderators.some((m) => m._id === member._id) ? "Demote" : "Promote"}</button>}<button onClick={() => remove(member._id)} className="text-red-300">Remove</button></div>)}
    </div>}
  </div>
}
