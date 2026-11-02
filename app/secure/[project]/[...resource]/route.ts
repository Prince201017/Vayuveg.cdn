import { resolveDelivery } from "@/lib/delivery";
export async function GET(request:Request,{params}:{params:Promise<{project:string,resource:string[]}>}){const p=await params;return resolveDelivery(request,p.project,p.resource,true)}
