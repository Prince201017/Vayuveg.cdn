"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { redis } from "@/lib/redis";
import { slugify } from "@/lib/utils";

async function requireUser() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/auth");
  return { db, user };
}

function refresh(projectId?: string) {
  revalidatePath("/dashboard");
  if (projectId) revalidatePath(`/dashboard/projects/${projectId}`);
}

/* ---------- projects ---------- */

export async function createProject(form: FormData) {
  const { db, user } = await requireUser();
  const name = String(form.get("name") || "").trim();
  const slug = slugify(String(form.get("slug") || name));
  const serviceType = String(form.get("service_type") || "stream");
  if (name.length < 2 || slug.length < 2) return;
  await db.from("projects").insert({
    owner_id: user.id, name, slug,
    description: String(form.get("description") || ""),
    service_type: ["file", "origin", "stream"].includes(serviceType) ? serviceType : "stream",
  });
  refresh();
}

export async function renameProject(form: FormData) {
  const { db } = await requireUser();
  const id = String(form.get("id"));
  const name = String(form.get("name") || "").trim();
  if (!id || name.length < 2) return;
  await db.from("projects").update({ name, updated_at: new Date().toISOString() }).eq("id", id);
  refresh(id);
}

export async function deleteProject(form: FormData) {
  const { db } = await requireUser();
  const id = String(form.get("id"));
  if (!id) return;
  await db.from("projects").delete().eq("id", id);
  refresh();
  redirect("/dashboard");
}

export async function updateProjectConfig(form: FormData) {
  const { db } = await requireUser();
  const id = String(form.get("id"));
  if (!id) return;
  const domains = String(form.get("allowed_domains") || "")
    .split(/[\n,]/).map((d) => d.trim().toLowerCase()).filter(Boolean);
  await db.from("projects").update({
    default_security: String(form.get("default_security") || "secure"),
    allowed_domains: domains,
    cache_ttl: Math.min(31536000, Math.max(0, Number(form.get("cache_ttl") || 3600))),
    rate_limit: Math.max(1, Number(form.get("rate_limit") || 1000)),
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  refresh(id);
}

export async function updateMetaTags(form: FormData) {
  const { db } = await requireUser();
  const id = String(form.get("id"));
  if (!id) return;
  await db.from("projects").update({
    meta_title: String(form.get("meta_title") || "").slice(0, 160) || null,
    meta_description: String(form.get("meta_description") || "").slice(0, 400) || null,
    meta_keywords: String(form.get("meta_keywords") || "").slice(0, 400) || null,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  refresh(id);
}

/* ---------- streams ---------- */

export async function createStream(form: FormData) {
  const { db, user } = await requireUser();
  const projectId = String(form.get("project_id"));
  const name = String(form.get("name") || "").trim();
  const slug = slugify(String(form.get("slug") || name));
  if (!projectId || slug.length < 1) return;
  await db.from("streams").insert({ project_id: projectId, owner_id: user.id, name, slug });
  refresh(projectId);
}

export async function renameStream(form: FormData) {
  const { db } = await requireUser();
  const id = String(form.get("id")), projectId = String(form.get("project_id"));
  const name = String(form.get("name") || "").trim();
  if (!id || name.length < 1) return;
  await db.from("streams").update({ name, slug: slugify(name) }).eq("id", id);
  refresh(projectId);
}

export async function deleteStream(form: FormData) {
  const { db } = await requireUser();
  const id = String(form.get("id")), projectId = String(form.get("project_id"));
  if (!id) return;
  await db.from("streams").delete().eq("id", id);
  refresh(projectId);
}

/* ---------- buckets ---------- */

export async function createBucketInStream(form: FormData) {
  const { db, user } = await requireUser();
  const projectId = String(form.get("project_id"));
  const streamId = String(form.get("stream_id") || "") || null;
  const name = String(form.get("name") || "").trim();
  const slug = slugify(String(form.get("slug") || name));
  if (!projectId || slug.length < 1) return;
  await db.from("buckets").insert({
    project_id: projectId, owner_id: user.id, stream_id: streamId,
    name, slug, public_title: name,
    delivery_mode: String(form.get("mode") || "public"),
  });
  refresh(projectId);
}

export async function renameBucket(form: FormData) {
  const { db } = await requireUser();
  const id = String(form.get("id")), projectId = String(form.get("project_id"));
  const name = String(form.get("name") || "").trim();
  if (!id || name.length < 1) return;
  await db.from("buckets").update({ name, slug: slugify(name), public_title: name, updated_at: new Date().toISOString() }).eq("id", id);
  refresh(projectId);
}

export async function deleteBucket(form: FormData) {
  const { db } = await requireUser();
  const id = String(form.get("id")), projectId = String(form.get("project_id"));
  if (!id) return;
  await db.from("buckets").delete().eq("id", id);
  refresh(projectId);
}

export async function toggleBucketMode(form: FormData) {
  const { db } = await requireUser();
  const id = String(form.get("id")), projectId = String(form.get("project_id"));
  const mode = String(form.get("mode"));
  if (!id || !["public", "secure"].includes(mode)) return;
  await db.from("buckets").update({ delivery_mode: mode, updated_at: new Date().toISOString() }).eq("id", id);
  refresh(projectId);
}

export async function purgeBucket(form: FormData) {
  const { db } = await requireUser();
  const id = String(form.get("id")), projectId = String(form.get("project_id"));
  if (!id) return;
  const { data: bucket } = await db.from("buckets").select("cache_generation").eq("id", id).maybeSingle();
  if (!bucket) return;
  await db.from("buckets").update({ cache_generation: Number(bucket.cache_generation) + 1, updated_at: new Date().toISOString() }).eq("id", id);
  refresh(projectId);
}

/* ---------- bucket files ---------- */

export async function uploadBucketFile(form: FormData) {
  const { db, user } = await requireUser();
  const bucketId = String(form.get("bucket_id")), projectId = String(form.get("project_id"));
  const file = form.get("file") as File | null;
  const inline = String(form.get("inline_value") || "").trim();
  if (!bucketId) return;
  let storagePath: string | null = null, contentType = "text/plain", byteSize = 0, fileName = String(form.get("file_name") || "content");

  if (file && file.size > 0) {
    contentType = file.type || "application/octet-stream";
    byteSize = file.size;
    fileName = file.name;
    storagePath = `${user.id}/${bucketId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await db.storage.from("vayuveg-origin").upload(storagePath, file, { contentType });
    if (error) return;
  } else if (inline) {
    byteSize = new TextEncoder().encode(inline).length;
  } else return;

  const { data: row } = await db.from("bucket_files").insert({
    bucket_id: bucketId, owner_id: user.id, file_name: fileName,
    file_tag: String(form.get("file_tag") || "") || null,
    content_type: contentType, storage_path: storagePath,
    inline_value: storagePath ? null : inline, byte_size: byteSize,
  }).select("id").single();

  if (row) {
    const { data: bucket } = await db.from("buckets").select("cache_generation").eq("id", bucketId).maybeSingle();
    await db.from("buckets").update({
      active_file_id: row.id, status: "active",
      cache_generation: Number(bucket?.cache_generation ?? 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq("id", bucketId);
  }
  refresh(projectId);
}

export async function activateBucketFile(form: FormData) {
  const { db } = await requireUser();
  const fileId = String(form.get("file_id")), bucketId = String(form.get("bucket_id")), projectId = String(form.get("project_id"));
  if (!fileId || !bucketId) return;
  const { data: bucket } = await db.from("buckets").select("cache_generation").eq("id", bucketId).maybeSingle();
  await db.from("buckets").update({
    active_file_id: fileId, status: "active",
    cache_generation: Number(bucket?.cache_generation ?? 0) + 1,
    updated_at: new Date().toISOString(),
  }).eq("id", bucketId);
  refresh(projectId);
}

export async function deleteBucketFile(form: FormData) {
  const { db } = await requireUser();
  const fileId = String(form.get("file_id")), bucketId = String(form.get("bucket_id")), projectId = String(form.get("project_id"));
  if (!fileId) return;
  const { data: file } = await db.from("bucket_files").select("storage_path").eq("id", fileId).maybeSingle();
  await db.from("bucket_files").delete().eq("id", fileId);
  if (file?.storage_path) await db.storage.from("vayuveg-origin").remove([file.storage_path]);
  refresh(projectId);
}

/* ---------- project cdn files ---------- */

export async function uploadCdnFile(form: FormData) {
  const { db, user } = await requireUser();
  const projectId = String(form.get("project_id"));
  const file = form.get("file") as File | null;
  if (!projectId || !file || file.size === 0) return;
  const slug = String(form.get("slug") || file.name).replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${user.id}/files/${projectId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await db.storage.from("vayuveg-origin").upload(storagePath, file, { contentType: file.type || "application/octet-stream" });
  if (error) return;
  await db.from("cdn_files").upsert({
    project_id: projectId, owner_id: user.id, file_name: file.name, slug,
    content_type: file.type || "application/octet-stream", storage_path: storagePath,
    byte_size: file.size, updated_at: new Date().toISOString(),
  }, { onConflict: "project_id,slug" });
  refresh(projectId);
}

export async function deleteCdnFile(form: FormData) {
  const { db } = await requireUser();
  const id = String(form.get("id")), projectId = String(form.get("project_id"));
  if (!id) return;
  const { data: file } = await db.from("cdn_files").select("storage_path").eq("id", id).maybeSingle();
  await db.from("cdn_files").delete().eq("id", id);
  if (file?.storage_path) await db.storage.from("vayuveg-origin").remove([file.storage_path]);
  refresh(projectId);
}

/* ---------- credentials & cache ---------- */

export async function createCredential(form: FormData) {
  const { db, user } = await requireUser();
  const projectId = String(form.get("project_id"));
  if (!projectId) return;
  const raw = `vv_${crypto.randomUUID().replace(/-/g, "")}`;
  const { createHash } = await import("crypto");
  await db.from("api_credentials").insert({
    project_id: projectId, owner_id: user.id,
    name: String(form.get("name") || "token"),
    token_prefix: raw.slice(0, 8),
    token_hash: createHash("sha256").update(raw).digest("hex"),
  });
  if (redis) await redis.set(`vayuveg:token-reveal:${projectId}`, raw, { ex: 300 });
  refresh(projectId);
}

export async function purgeProjectCache(form: FormData) {
  const { db } = await requireUser();
  const projectId = String(form.get("project_id"));
  if (!projectId) return;
  const { data: buckets } = await db.from("buckets").select("id,cache_generation").eq("project_id", projectId);
  await Promise.all((buckets ?? []).map((b) =>
    db.from("buckets").update({ cache_generation: Number(b.cache_generation) + 1 }).eq("id", b.id)
  ));
  refresh(projectId);
}

/* ---------- legacy ---------- */

export async function createBucket(form: FormData) {
  return createBucketInStream(form);
}

export async function signOut() {
  const db = await createClient();
  await db.auth.signOut();
  redirect("/auth");
}
