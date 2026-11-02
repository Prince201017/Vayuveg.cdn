import { NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      tracking_id?: string
      event_type?: string
      page_url?: string
      page_title?: string
      referrer?: string
      language?: string
      screen_size?: string
    }
    const trackingId = body.tracking_id?.trim()
    if (!trackingId) return NextResponse.json({ error: "tracking_id is required" }, { status: 400 })

    const db = createAdminClient()
    const { data: project } = await db.from("projects").select("id").eq("tracking_id", trackingId).maybeSingle()
    if (!project) return NextResponse.json({ error: "Unknown tracking id" }, { status: 404 })

    const forwarded = request.headers.get("x-forwarded-for") ?? "anonymous"
    const visitorHash = createHash("sha256").update(forwarded).digest("hex").slice(0, 32)
    const { error } = await db.from("site_events").insert({
      project_id: project.id,
      event_type: body.event_type?.slice(0, 40) || "pageview",
      page_url: body.page_url?.slice(0, 2048) || null,
      page_title: body.page_title?.slice(0, 256) || null,
      referrer: body.referrer?.slice(0, 2048) || request.headers.get("referer"),
      user_agent: request.headers.get("user-agent")?.slice(0, 512),
      language: body.language?.slice(0, 32) || request.headers.get("accept-language")?.slice(0, 32),
      screen_size: body.screen_size?.slice(0, 32) || null,
      visitor_hash: visitorHash,
    })
    if (error) return NextResponse.json({ error: "Unable to record event" }, { status: 500 })
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: "Invalid tracking payload" }, { status: 400 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type" } })
}
