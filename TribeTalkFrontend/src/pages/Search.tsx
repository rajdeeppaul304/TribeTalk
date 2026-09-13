import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useLazySearchMessagesQuery } from "../features/search/search.api"

export default function Search() {
  const [query, setQuery] = useState("")
  const [searchMessages, { data: results = [], isFetching, error }] = useLazySearchMessagesQuery()
  const navigate = useNavigate()

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (query.trim().length >= 2) searchMessages({ query: query.trim() })
  }

  return (
    <main className="min-h-screen bg-gray-900 p-6 text-white">
      <section className="mx-auto max-w-3xl">
        <Link to="/home" className="text-sm text-blue-300 hover:text-blue-200">← Back to chat</Link>
        <h1 className="mt-5 text-3xl font-bold">Search messages</h1>
        <p className="mt-1 text-gray-400">Searches only messages in channels you can access.</p>
        <form onSubmit={submit} className="mt-6 flex gap-2">
          <input value={query} onChange={(event) => setQuery(event.target.value)} minLength={2} placeholder="Search message content" className="min-w-0 flex-1 rounded bg-gray-800 p-3 text-white" />
          <button type="submit" disabled={isFetching || query.trim().length < 2} className="rounded bg-blue-600 px-5 font-medium hover:bg-blue-500 disabled:opacity-50">{isFetching ? "Searching..." : "Search"}</button>
        </form>
        {error && <p className="mt-4 text-red-300">Search is unavailable. Make sure Elasticsearch is running, then try again.</p>}
        <div className="mt-6 space-y-3">
          {results.map((result) => (
            <button key={result.messageId} onClick={() => navigate(`/home?channelId=${result.channelId}`)} className="block w-full rounded-lg bg-gray-800 p-4 text-left hover:bg-gray-700">
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
