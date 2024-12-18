import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";
import {
    type ChangeUserInfoRequest,
    type GetUserInfoResponse,
} from "../_shared/apiTypes.ts";
import type { Profile } from "../_shared/dbTypes.ts";
import { logPayload } from "../_shared/helpers.ts";

console.info("[EDGE] change-user-info");

/**
 * @see ChangeUserInfoRequest
 * @see GetUserInfoResponse
 */
Deno.serve(async (req) => {
    if (req.method !== "PATCH") {
        return new Response(
            JSON.stringify({ message: "Method not allowed" }),
            { status: STATUS_CODE.MethodNotAllowed },
        );
    }
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const refreshToken = req.headers.get("Refresh-Token")?.replace(
        "Bearer ",
        "",
    );

    const body = await req.json() as ChangeUserInfoRequest;
    logPayload(body);
    const { username, char_image, email } = body;

    if (!token) {
        return new Response(
            JSON.stringify({ message: "Missing token" }),
            { status: STATUS_CODE.Unauthorized },
        );
    } else if (!refreshToken) {
        return new Response(
            JSON.stringify({ message: "Missing refresh token" }),
            { status: STATUS_CODE.Unauthorized },
        );
    } else if (
        !username?.trim()?.length && !char_image?.trim()?.length &&
        !email?.trim()?.length
    ) {
        return new Response(
            JSON.stringify({ message: "Missing fields" }),
            { status: STATUS_CODE.BadRequest },
        );
    }

    const supabaseService = new SupabaseService(token);

    const session = await supabaseService.getSession(refreshToken);
    if (!session) {
        return new Response(
            JSON.stringify({ message: "Invalid refresh token" }),
            { status: STATUS_CODE.Unauthorized },
        );
    }

    const { data, error } = await supabaseService.supabase.auth.updateUser({
        email: email.trim(),
    });

    if (error) {
        return new Response(
            JSON.stringify({ message: error.message }),
            { status: STATUS_CODE.Unauthorized },
        );
    }

    const { data: profileData, error: updateError } = await supabaseService
        .supabase
        .from("profiles")
        .update({
            username: username.trim(),
            char_image: char_image.trim(),
            email: email.trim(),
        })
        .eq("id", data.user.id)
        .select("*");

    if (updateError) {
        return new Response(
            JSON.stringify({ message: updateError.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    }

    const actualProfileData = profileData[0] as Profile;

    const response: GetUserInfoResponse = {
        id: actualProfileData.id,
        username: actualProfileData.username,
        email: actualProfileData.email,
        phone_number: actualProfileData.phone_number,
        char_image: actualProfileData.char_image,
        allowed_notifications: actualProfileData.allowed_notifications,
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
