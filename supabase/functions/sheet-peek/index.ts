// chantan:public
Deno.serve(async () => {
  const id = "1AtXn7SZiBNehbb2TVV55cvvNLkRRoQcOqmwYVmsHh4c"
  const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=0`, { redirect: "follow" })
  const t = await r.text()
  return new Response(JSON.stringify({ status: r.status, len: t.length, head: t.slice(0, 1500) }), { headers: { "Content-Type": "application/json" } })
})