import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";
import { CreateGroupRequest } from "../_shared/apiTypes.ts";
import { logPayload } from "../_shared/helpers.ts";

console.info("[EDGE] create-group");

/**
 * @see CreateGroupRequest
 * No response body for this endpoint.
 */
Deno.serve(async (req) => {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const body = await req.json() as CreateGroupRequest;
    logPayload(body);
    const { name, currency } = body;

    if (!token) {
        return new Response(
            JSON.stringify({ message: "Missing token" }),
            {
                status: STATUS_CODE.Unauthorized,
                headers: { "Content-Type": "application/json" },
            },
        );
    }

    if (!name) {
        return new Response(
            JSON.stringify({ message: "Missing group name" }),
            {
                status: STATUS_CODE.BadRequest,
                headers: { "Content-Type": "application/json" },
            },
        );
    }
    if (!currency) {
        return new Response(
            JSON.stringify({ message: "Missing currency" }),
            { status: STATUS_CODE.BadRequest },
        );
    }

    const supabaseService = new SupabaseService(token);

    const { data: userData, error: userError } = await supabaseService
        .getUser(token);

    if (userError) {
        return new Response(
            JSON.stringify({ error: userError.message }),
            { status: STATUS_CODE.Unauthorized },
        );
    }

    const { data: group, error: groupError } = await supabaseService.supabase
        .from("groups")
        .insert({
            name,
            currency,
        }).select();

    if (groupError) {
        return new Response(
            JSON.stringify({ message: groupError.message }),
            {
                status: STATUS_CODE.InternalServerError,
                headers: { "Content-Type": "application/json" },
            },
        );
    }

    if (!group) {
        return new Response(
            JSON.stringify({ message: "Group not created" }),
            { status: STATUS_CODE.InternalServerError },
        );
    }

    const { error: groupsProfilesError } = await supabaseService.supabase
        .from("groups_profiles")
        .insert({ user_id: userData.user.id, group_id: group[0].id });

    if (groupsProfilesError) {
        return new Response(
            JSON.stringify({ message: groupsProfilesError.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    }

    return new Response(null, { status: STATUS_CODE.Created });
});
