import { useState } from "react"
import { AlertTriangle, Ban, Copy, History, Shield, UserMinus, Unlock, X } from "lucide-react"
import Modal from "./Modal"
import {
  useBanMemberMutation,
  useCreateInviteMutation,
  useGetAuditLogsQuery,
  useGetInvitesQuery,
  useGetModerationActionsQuery,
  useGetServerByIdQuery,
  useRemoveMemberMutation,
  useRevokeInviteMutation,
  useSetMemberRoleMutation,
  useUnbanMemberMutation,
  useWarnMemberMutation,
} from "../features/servers/server.api"
import { copyToClipboard } from "../utils/commonTools"
import type { ServerMember } from "../features/types"
import { useAuth } from "../features/auth/useAuth"

type Props = { serverId: string; open: boolean; onClose: () => void }
const getMemberName = (member: ServerMember | null | undefined) => member?.username || "unknown user"

export default function ServerManagementPanel({ serverId, open, onClose }: Props) {
  const { data: server, refetch } = useGetServerByIdQuery(serverId)
  const { user } = useAuth()
  const canManage = Boolean(server && server.role !== "member")
  const { data: invites = [] } = useGetInvitesQuery(serverId, { skip: !canManage })
  const { data: moderationActions = [] } = useGetModerationActionsQuery(serverId, { skip: !canManage })
  const { data: auditLogs = [] } = useGetAuditLogsQuery(serverId, { skip: !canManage })
  const [createInvite] = useCreateInviteMutation()
  const [revokeInvite] = useRevokeInviteMutation()
  const [setRole] = useSetMemberRoleMutation()
  const [removeMember] = useRemoveMemberMutation()
  const [warnMember] = useWarnMemberMutation()
  const [banMember] = useBanMemberMutation()
  const [unbanMember] = useUnbanMemberMutation()
  const [moderationTarget, setModerationTarget] = useState<ServerMember | null>(null)
  const [moderationKind, setModerationKind] = useState<"warning" | "temporary_ban">("warning")
  const [reason, setReason] = useState("")
  const [durationMinutes, setDurationMinutes] = useState("60")

  if (!server || !canManage) return null

  const inviteUrl = (code: string) => `${window.location.origin}/server/join-server/${serverId}?invite=${encodeURIComponent(code)}`
  const members = [...server.moderators, ...server.members].filter((member) => server.role === "owner" || member._id !== user?._id)
  const activeBanFor = (memberId: string) => moderationActions.find((action) =>
    action.targetUser?._id === memberId && action.type === "temporary_ban" && !action.revokedAt && action.expiresAt && new Date(action.expiresAt).getTime() > Date.now()
  )

  const openModeration = (member: ServerMember, kind: "warning" | "temporary_ban") => {
    setModerationTarget(member)
    setModerationKind(kind)
    setReason("")
    setDurationMinutes("60")
  }

  const submitModeration = async () => {
    if (!moderationTarget || !reason.trim()) return
    if (moderationKind === "warning") await warnMember({ serverId, memberId: moderationTarget._id, reason: reason.trim() })
    else {
      const duration = Number(durationMinutes)
      if (!Number.isInteger(duration) || duration < 1 || duration > 43200) return
      await banMember({ serverId, memberId: moderationTarget._id, durationMinutes: duration, reason: reason.trim() })
      await refetch()
    }
    setModerationTarget(null)
  }

  return (
    <Modal open={open} onClose={onClose} title={`Manage ${server.name}`}>
      <div className="space-y-5 text-sm">
        {moderationTarget && <section className="rounded-xl border soft-border bg-ink p-4">
          <div className="mb-3 flex items-center justify-between"><h3 className="font-medium">{moderationKind === "warning" ? "Warn" : "Temporarily ban"} @{moderationTarget.username}</h3><button className="icon-button" onClick={() => setModerationTarget(null)} aria-label="Cancel"><X size={15}/></button></div>
          <label className="mb-3 block text-xs text-[#899493]">Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={500} placeholder="Explain what happened" className="field mt-1 resize-none" /></label>
          {moderationKind === "temporary_ban" && <label className="mb-3 block text-xs text-[#899493]">Duration in minutes<input value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} type="number" min={1} max={43200} className="field mt-1" /></label>}
          <div className="flex justify-end gap-2"><button className="secondary-button" onClick={() => setModerationTarget(null)}>Cancel</button><button className="primary-button" disabled={!reason.trim()} onClick={() => void submitModeration()}>{moderationKind === "warning" ? "Send warning" : "Apply ban"}</button></div>
        </section>}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-medium">Invites</h3>
            <button className="primary-button text-sm" onClick={async () => {
              const invite = await createInvite({ serverId, expiresInHours: 24, maxUses: 25 }).unwrap()
              copyToClipboard(inviteUrl(invite.code))
            }}>Create & copy invite</button>
          </div>
          <div className="space-y-2">
            {invites.filter((invite) => !invite.revokedAt).slice(0, 4).map((invite) => (
              <div className="flex items-center justify-between rounded-lg border soft-border bg-ink p-3" key={invite._id}>
                <span className="text-[#aeb9b8]">{invite.uses}/{invite.maxUses ?? "∞"} uses · {invite.expiresAt ? "expires in 24h" : "no expiry"}</span>
                <span><button className="icon-button" onClick={() => copyToClipboard(inviteUrl(invite.code))}><Copy size={15} /></button><button className="ml-1 text-xs text-red-300" onClick={() => revokeInvite({ serverId, inviteId: invite._id })}>Revoke</button></span>
              </div>
            ))}
            {!invites.length && <p className="text-[#899493]">No active invites yet.</p>}
          </div>
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-2 font-medium"><Shield size={16} /> Members & moderation</h3>
          <div className="max-h-60 space-y-1 overflow-y-auto scrollbar">
            {members.map((member) => {
              const isModerator = server.moderators.some((mod) => mod._id === member._id)
              const activeBan = activeBanFor(member._id)
              return <div className="flex items-center justify-between rounded-lg p-2 hover:bg-white/5" key={member._id}>
                <span>@{member.username}{isModerator && <span className="ml-2 text-xs text-accent">Moderator</span>}{activeBan && <span className="ml-2 text-xs text-red-300">Banned</span>}</span>
                <span className="flex items-center gap-1">
                  {server.role === "owner" && <button className="icon-button" title={isModerator ? "Demote" : "Promote"} onClick={async () => { await setRole({ serverId, memberId: member._id, role: isModerator ? "member" : "moderator" }); await refetch() }}><Shield size={15} /></button>}
                  <button className="icon-button text-amber-300" title="Warn member" onClick={() => openModeration(member, "warning")}><AlertTriangle size={15} /></button>
                  {activeBan ? <button className="icon-button text-emerald-300" title="Unban member" onClick={async () => { await unbanMember({ serverId, memberId: member._id }); await refetch() }}><Unlock size={15} /></button> : <button className="icon-button text-red-300" title="Temporary ban" onClick={() => openModeration(member, "temporary_ban")}><Ban size={15} /></button>}
                  <button className="icon-button text-red-300" title="Remove member" onClick={async () => { if (window.confirm(`Remove @${member.username}?`)) { await removeMember({ serverId, memberId: member._id }); await refetch() } }}><UserMinus size={15} /></button>
                </span>
              </div>
            })}
          </div>
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-2 font-medium"><History size={16} /> Recent moderation history</h3>
          <div className="max-h-44 space-y-2 overflow-y-auto scrollbar">
            {[...moderationActions, ...auditLogs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 12).map((entry: any) => (
              <div className="rounded-lg border soft-border bg-ink p-2 text-xs text-[#aeb9b8]" key={`${entry._id}-${entry.action || entry.type}`}>
                <span className="text-white">{entry.action || (entry.type === "temporary_ban" ? "temporary ban" : "warning")}</span> · @{getMemberName(entry.actor)} {entry.targetUser && <>→ @{getMemberName(entry.targetUser)}</>} · {new Date(entry.createdAt).toLocaleString()}
                {entry.reason && <div className="mt-1 text-[#899493]">{entry.reason}</div>}
              </div>
            ))}
            {!moderationActions.length && !auditLogs.length && <p className="text-[#899493]">No moderation activity yet.</p>}
          </div>
        </section>
      </div>
    </Modal>
  )
}

