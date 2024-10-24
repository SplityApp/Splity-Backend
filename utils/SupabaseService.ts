import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js";

export class SupabaseService {
    public supabase: SupabaseClient;
    private supabaseUrl: string | undefined;
    private supabaseKey: string | undefined;

    constructor() {
        this.supabaseUrl = Deno.env.get("SUPABASE_URL");
        this.supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
        if (!this.supabaseUrl || !this.supabaseKey) {
            throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
        }
        this.supabase = createClient(
            this.supabaseUrl,
            this.supabaseKey,
        );
    }
}
