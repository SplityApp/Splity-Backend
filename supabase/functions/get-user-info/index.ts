import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";
import { GetUserInfoResponse } from "../_shared/apiTypes.ts";

console.info("[EDGE] Get-user-info");

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

    const response: GetUserInfoResponse = {
        id: data.user.id,
        email: data.user.user_metadata.email,
        phone_number: data.user.user_metadata.phoneNumber,
        username: data.user.user_metadata.username,
        created_at: data.user.created_at,
        char_image: data.user.user_metadata.charImage
    }

    return new Response(
        JSON.stringify(response),
        {
            headers: { "Content-Type": "application/json" },
            status: STATUS_CODE.OK,
        },
    );
});
