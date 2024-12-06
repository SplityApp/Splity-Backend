import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";
import {
    type ChangeNotificationsRequest,
    type ChangeNotificationsResponse,
} from "../_shared/apiTypes.ts";
import { logPayload } from "../_shared/helpers.ts";

console.info("[EDGE] change-notifications");

/**
 * @see ChangeNotificationsRequest
 * @see AllowedNotificationsResponse
 */
Deno.serve(async (req) => {
    if (req.method !== "PATCH") {
        return new Response(
            JSON.stringify({ message: "Method not allowed" }),
            { status: STATUS_CODE.MethodNotAllowed },
        );
    }

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const body = await req.json() as ChangeNotificationsRequest;
    logPayload(body);
    const { allowed_notifications } = body;

    if (!token) {
        return new Response(
            JSON.stringify({ message: "Missing token" }),
            { status: STATUS_CODE.Unauthorized },
        );
    } else if (allowed_notifications === undefined) {
        return new Response(
            JSON.stringify({ message: "Missing allowed_notifications" }),
            { status: STATUS_CODE.BadRequest },
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

    const { error: updateError } = await supabaseService
        .supabase
        .from("profiles")
        .update({ allowed_notifications })
        .eq("id", data.user.id);

    if (updateError) {
        return new Response(
            JSON.stringify({ message: updateError.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    }

    const response: ChangeNotificationsResponse = {
        allowed_notifications,
    };

    return new Response(
        JSON.stringify(response),
        {
            headers: { "Content-Type": "application/json" },
            status: STATUS_CODE.OK,
        },
    );
});
