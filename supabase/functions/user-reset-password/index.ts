import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";

console.info("[EDGE] user-reset-password");

/**
 * No request body is required for this endpoint.
 * { message: string }
 */
Deno.serve(async (req) => {
    if (req.method !== "PATCH") {
        return new Response(
            JSON.stringify({ message: "Method not allowed" }),
            { status: STATUS_CODE.MethodNotAllowed },
        );
    }
    const { email } = await req.json();
    if (!email?.trim()?.length) {
        return new Response(
            JSON.stringify({ message: "Missing email" }),
            { status: STATUS_CODE.BadRequest },
        );
    }

    const supabaseService = new SupabaseService();

    const { data: _data, error } = await supabaseService.supabase.auth
        .resetPasswordForEmail(email);
    if (error) {
        return new Response(
            JSON.stringify({ message: error.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    }

    return new Response(
        JSON.stringify({ message: "Password reset email sent" }),
        {
            headers: { "Content-Type": "application/json" },
            status: STATUS_CODE.OK,
        },
    );
});
