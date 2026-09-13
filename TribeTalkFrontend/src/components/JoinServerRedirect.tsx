import { useEffect } from "react";
import { useParams, Navigate, useSearchParams } from "react-router-dom";
import { useJoinServerMutation } from "../features/servers/server.api";
import { useAuth } from "../features/auth/useAuth";


function JoinServerRedirect() {
  const { id } = useParams();
  const [searchParams] = useSearchParams()
  const { isAuthenticated } = useAuth()
  const inviteCode = searchParams.get("invite")
  const [joinServer,{isLoading,isSuccess,isError,error}]=useJoinServerMutation()
  useEffect(()=>{
    if(id && inviteCode && isAuthenticated){
      joinServer({serverId:id, inviteCode})
    }
  },[id, inviteCode, isAuthenticated, joinServer])
  if (!isAuthenticated) return <Navigate to="/login" replace />
 if (isSuccess){
  return <Navigate to="/home" replace />;
 }
  if (!id || !inviteCode) return <p className="p-6">This invite link is invalid.</p>
  if (isError) {
    const message = typeof error === "object" && error && "data" in error
      ? String((error as { data?: { message?: string } }).data?.message ?? "Unable to join this server.")
      : "Unable to join this server."
    return <p className="p-6">{message}</p>
  }
  return <p className="p-6">{isLoading ? "Joining server..." : "Preparing invite..."}</p>
}

export default JoinServerRedirect;
