"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      title="Sair"
      className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-white"
    >
      <LogOut className="h-5 w-5" />
    </button>
  );
}
