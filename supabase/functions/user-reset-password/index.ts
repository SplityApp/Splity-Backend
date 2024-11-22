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
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");

    if (!token) {
        return new Response(
            JSON.stringify({ message: "Missing token" }),
            { status: STATUS_CODE.Unauthorized },
        );
    }

    const supabaseService = new SupabaseService(token);

    const { data: userData, error: userError } = await supabaseService.supabase
        .auth.getUser(token);
    if (userError) {
        return new Response(
            JSON.stringify({ message: userError.message }),
            { status: STATUS_CODE.Unauthorized },
        );
    } else if (!userData.user.email) {
        return new Response(
            JSON.stringify({ message: "Email not found" }),
            { status: STATUS_CODE.BadRequest },
        );
    }

    const { data: _data, error } = await supabaseService.supabase.auth
        .resetPasswordForEmail(userData.user.email, {
            redirectTo: "http://localhost:3000/reset-password",
        });
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
