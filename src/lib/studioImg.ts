import { supabase } from "@/lib/chantan-db"

// Réduit une image (max 1024 px) et la renvoie en data URL JPEG
export function blobToDataUrl(b: Blob, max = 1024): Promise<string> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(b)
    const img = new Image()
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement("canvas")
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s)
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      res(c.toDataURL("image/jpeg", 0.85))
    }
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Image illisible")) }
    img.src = url
  })
}
export async function urlToDataUrl(u: string) {
  const r = await fetch(u)
  return blobToDataUrl(await r.blob())
}
// Envoie une image (File ou data URL) dans l'espace public et renvoie son lien
export async function uploadStudioImage(src: Blob | string, folder: string): Promise<string> {
  const blob = typeof src === "string" ? await (await fetch(src)).blob() : src
  const ext = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg"
  const path = `studio/${folder}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from("chantan-public").upload(path, blob, { contentType: blob.type || "image/jpeg" })
  if (error) throw new Error(error.message)
  return supabase.storage.from("chantan-public").getPublicUrl(path).data.publicUrl
}
