import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useLazySearchMessagesQuery } from "../features/search/search.api"
import { Skeleton } from "../components/Skeleton"
import { useLazySearchUsersQuery } from "../features/auth/auth.api"

export default function Search() {
  const [query, setQuery] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [hasAttachments, setHasAttachments] = useState(false)
  const [history, setHistory] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem("tribetalk-search-history") || "[]") } catch { return [] } })
  const [searchMessages, { data: results = [], isFetching, error }] = useLazySearchMessagesQuery()
  const [searchUsers, { data: users = [] }] = useLazySearchUsersQuery()
  const navigate = useNavigate()

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (query.trim().length >= 2) {
      const value = query.trim()
      searchMessages({ query: value, from: from ? new Date(from).toISOString() : undefined, to: to ? new Date(to).toISOString() : undefined, hasAttachments: hasAttachments || undefined })
      searchUsers({ q: value })
      setHistory((current) => { const next = [value, ...current.filter((item) => item !== value)].slice(0, 8); localStorage.setItem("tribetalk-search-history", JSON.stringify(next)); return next })
    }
  }

  useEffect(() => { if (query.length >= 2) document.title = `${query} · Search · TribeTalk`; return () => { document.title = "TribeTalk" } }, [query])

  return (
    <main className="min-h-screen bg-gray-900 p-6 text-white">
      <section className="mx-auto max-w-3xl">
        <Link to="/home" className="text-sm text-blue-300 hover:text-blue-200">← Back to chat</Link>
        <h1 className="mt-5 text-3xl font-bold">Search messages</h1>
        <p className="mt-1 text-gray-400">Searches only messages in channels you can access.</p>
        <form onSubmit={submit} className="mt-6 flex gap-2">
          <input aria-label="Search message content" value={query} onChange={(event) => setQuery(event.target.value)} minLength={2} placeholder="Search message content" className="min-w-0 flex-1 rounded bg-gray-800 p-3 text-white" />
          <button type="submit" disabled={isFetching || query.trim().length < 2} className="rounded bg-blue-600 px-5 font-medium hover:bg-blue-500 disabled:opacity-50">{isFetching ? "Searching..." : "Search"}</button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-400">
          <label>From <input type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} className="ml-1 rounded bg-gray-800 p-2 text-white" /></label>
          <label>To <input type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} className="ml-1 rounded bg-gray-800 p-2 text-white" /></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={hasAttachments} onChange={(event) => setHasAttachments(event.target.checked)} /> Has attachments</label>
        </div>
        {history.length > 0 && <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="self-center text-gray-500">Recent:</span>{history.map((item) => <button type="button" key={item} onClick={() => { setQuery(item); searchMessages({ query: item }) }} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-gray-300 hover:bg-white/10">{item}</button>)}</div>}
        {error && <p className="mt-4 text-red-300">Search is unavailable. Make sure Elasticsearch is running, then try again.</p>}
        {users.length > 0 && <section className="mt-6"><h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-400">People</h2><div className="grid gap-2 sm:grid-cols-2">{users.map((person) => <Link key={person._id} to={`/profile/${person._id}`} className="flex items-center gap-3 rounded-lg bg-gray-800 p-3 hover:bg-gray-700"><div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-accent/20 text-accent">{person.avatar?<img src={person.avatar} alt="" className="h-full w-full object-cover"/>:person.username.slice(0,1).toUpperCase()}</div><div><p className="font-medium">{person.displayName || person.username}</p><p className="text-xs text-gray-400">@{person.username}</p></div></Link>)}</div></section>}
        <div className="mt-6 space-y-3">
          {isFetching && <><Skeleton className="h-24 w-full"/><Skeleton className="h-24 w-full"/><Skeleton className="h-24 w-full"/></>}
          {results.map((result) => (
            <button key={result.messageId} onClick={() => navigate(`/home?channelId=${result.channelId}&messageId=${result.messageId}`)} className="block w-full rounded-lg bg-gray-800 p-4 text-left hover:bg-gray-700">
              <p className="font-semibold text-blue-300">{result.senderUsername || "User"}</p>
              <p className="mt-1 whitespace-pre-wrap text-gray-100">{result.content}</p>
              <p className="mt-2 text-xs text-gray-500">{new Date(result.createdAt).toLocaleString()} · Open channel</p>
            </button>
          ))}
          {!isFetching && results.length === 0 && query && <p className="text-gray-500">No results yet.</p>}
        </div>
      </section>
    </main>
  )
}
