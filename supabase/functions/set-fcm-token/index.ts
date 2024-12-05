import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";

console.info("[EDGE] set-fcm-token");

/**
 * No request body is required for this endpoint.
 * @see GetUserInfoResponse
 */
Deno.serve(async (req) => {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");

    if (!token) {
        return new Response(
            JSON.stringify({ message: "Missing token" }),
            { status: STATUS_CODE.Unauthorized },
        );
    }

    const supabaseService = new SupabaseService(token);

    const { data, error } = await supabaseService.supabase.auth.getUser(token);

    if (error) {
        return new Response(
            JSON.stringify({ message: error.message }),
            { status: STATUS_CODE.Unauthorized },
        );
    }

    const body: { fcm_token: string } = await req.json();

    if (!body.fcm_token) {
        return new Response(
            JSON.stringify({ message: "Missing fcm_token" }),
            { status: STATUS_CODE.BadRequest },
        );
    }

    await supabaseService.supabase.from("profiles").upsert({
        id: data.user.id,
        fcm_token: body.fcm_token,
    });

    return new Response(
        null,
        {
            headers: { "Content-Type": "application/json" },
            status: STATUS_CODE.OK,
        },
    );
});
