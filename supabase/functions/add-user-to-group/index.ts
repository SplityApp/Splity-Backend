import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";

console.log("[EDGE] add-user-to-group");

Deno.serve(async (req) => {
    if (req.method !== "POST") {
        return new Response(
            JSON.stringify({ message: "Method not allowed" }),
            { status: STATUS_CODE.MethodNotAllowed },
        );
    }

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { groupId } = await req.json();

    if (!token) {
        return new Response(
            JSON.stringify({ message: "Missing token" }),
            { status: STATUS_CODE.Unauthorized },
        );
    } else if (!groupId) {
        return new Response(
            JSON.stringify({ message: "Missing groupId" }),
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

    const { error: groupsProfilesError } = await supabaseService.supabase
        .from("groups_profiles")
        .insert({ user_id: data.user.id, group_id: groupId });

    if (groupsProfilesError) {
        return new Response(
            JSON.stringify({ message: groupsProfilesError.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    }

    return new Response(
        JSON.stringify({ message: "User added to group" }),
        {
            headers: { "Content-Type": "application/json" },
            status: STATUS_CODE.Created,
        },
    );
});
