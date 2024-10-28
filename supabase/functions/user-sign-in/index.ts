import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../../../utils/SupabaseService.ts";

console.log("[EDGE] User-sign-in");

Deno.serve(async (req) => {
    const { password, email } = await req.json();

    const supabaseService = new SupabaseService();

    const { data, error } = await supabaseService.supabase.auth
        .signInWithPassword({
            email: email,
            password: password,
        });

    if (error) {
        return new Response(
            JSON.stringify({ message: error.message }),
            { status: STATUS_CODE.Unauthorized },
        );
    }

    return new Response(
        JSON.stringify({
            token: data.session.access_token,
        }),
        { headers: { "Content-Type": "application/json" } },
    );
});
