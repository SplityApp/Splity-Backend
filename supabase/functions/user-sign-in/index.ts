import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";
import { UserSignInRequest, UserSignInResponse } from "../_shared/apiTypes.ts";
import { logPayload } from "../_shared/helpers.ts";

console.info("[EDGE] User-sign-in");

/**
 * @see UserSignInRequest
 * @see UserSignInResponse
 */
Deno.serve(async (req) => {
    const body = await req.json() as UserSignInRequest;
    logPayload(body);
    const { password, email } = body;

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
            refresh_token: data.session.refresh_token,
        } as UserSignInResponse),
        { headers: { "Content-Type": "application/json" } },
    );
});
