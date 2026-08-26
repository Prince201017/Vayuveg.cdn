import { Wind } from "lucide-react";
export function Logo({compact=false}:{compact?:boolean}){return <div className="flex items-center gap-2.5 font-semibold tracking-tight"><span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Wind size={18}/></span>{!compact&&<span>vayuveg<span className="text-primary">.cdn</span></span>}</div>}
