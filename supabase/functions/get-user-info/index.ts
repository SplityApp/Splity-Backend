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

    const { data: profileData, error: profileError } = await supabaseService
        .supabase
        .from("profiles")
        .select(`*`)
        .eq("id", data.user.id)
        .single();

    if (profileError) {
        return new Response(
            JSON.stringify({ message: profileError.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    }

    const response: GetUserInfoResponse = {
        id: profileData.id,
        email: data.user.email ?? profileData.email,
        phone_number: profileData.phone_number,
        username: profileData.username,
        char_image: profileData.char_image,
        allowed_notifications: profileData.allowed_notifications,
        created_at: data.user.created_at,
    };

    return new Response(
        JSON.stringify(response),
        {
            headers: { "Content-Type": "application/json" },
            status: STATUS_CODE.OK,
        },
    );
});
