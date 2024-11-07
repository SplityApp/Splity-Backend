import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";
import { AddUserToGroupRequest } from "../_shared/apiTypes.ts";

console.info("[EDGE] add-user-to-group");

/**
 * @see AddUserToGroupRequest
 * No response body for this endpoint.
 */
Deno.serve(async (req) => {
    if (req.method !== "POST") {
        return new Response(
            JSON.stringify({ message: "Method not allowed" }),
            { status: STATUS_CODE.MethodNotAllowed },
        );
    }

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { invite_code: inviteCode }: AddUserToGroupRequest = await req.json();

    if (!token) {
        return new Response(
            JSON.stringify({ message: "Missing token" }),
            { status: STATUS_CODE.Unauthorized },
        );
    } else if (!inviteCode) {
        return new Response(
            JSON.stringify({ message: "Missing inviteCode" }),
            { status: STATUS_CODE.BadRequest },
        );
    }

    const supabaseService = new SupabaseService(token);

    const { data, error } = await supabaseService.getUser(token);

    if (error) {
        return new Response(
            JSON.stringify({ message: error.message }),
            { status: STATUS_CODE.Unauthorized },
        );
    }

    const { data: profileGroups, error: profileError } = await supabaseService
        .supabase
        .from("groups_profiles")
        .select("group_id")
        .eq("user_id", data.user.id);

    if (profileError) {
        return new Response(
            JSON.stringify({ message: profileError.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    }

    const excludedGroupIds = profileGroups.map((profile) => profile.group_id)
        .join(",");

    const { data: group, error: groupError } = await supabaseService.supabase
        .from("groups")
        .select(`id, invite_code, groups_profiles!inner ( user_id, group_id )`)
        .eq("invite_code", inviteCode)
        .not("id", "in", `(${excludedGroupIds})`)
        .maybeSingle();

    if (groupError) {
        return new Response(
            JSON.stringify({ message: groupError.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    } else if (!group) {
        return new Response(
            JSON.stringify({ message: "Group not found" }),
            { status: STATUS_CODE.NotFound },
        );
    }

    const { error: groupsProfilesError } = await supabaseService.supabase
        .from("groups_profiles")
        .insert({ user_id: data.user.id, group_id: group.id });

    if (groupsProfilesError) {
        return new Response(
            JSON.stringify({ message: groupsProfilesError.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    }

    return new Response(null, { status: STATUS_CODE.Created });
});
