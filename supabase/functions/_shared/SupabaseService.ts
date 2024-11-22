import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js";

export class SupabaseService {
    public supabase: SupabaseClient;
    private supabaseUrl: string | undefined;
    private supabaseKey: string | undefined;

    constructor(token?: string) {
        this.supabaseUrl = Deno.env.get("SUPABASE_URL");
        this.supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");

        if (!this.supabaseUrl || !this.supabaseKey) {
            throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
        }

        const headers = token
            ? { Authorization: `Bearer ${token}` }
            : undefined;

        this.supabase = createClient(
            this.supabaseUrl,
            this.supabaseKey,
            {
                global: {
                    headers,
                },
            },
        );
    }

    async getUser(token: string) {
        return await this.supabase.auth.getUser(token);
    }

    async getSession(refreshToken: string) {
        const { data: getSessionData, error: _errorSessionData } = await this
            .supabase.auth
            .getSession();

        if (!getSessionData.session) {
            const { data: refreshData, error: errorRefreshData } = await this
                .supabase.auth
                .refreshSession({
                    refresh_token: refreshToken,
                });

            if (errorRefreshData || !refreshData || !refreshData.session) {
                return null;
            }
            return refreshData.session;
        }
        return getSessionData.session;
    }
}
