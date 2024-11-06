import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";

console.log("[EDGE] create-group");

Deno.serve(async (req) => {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { name, currency } = await req.json();

    if (!token) {
        return new Response(
            JSON.stringify({ message: "Missing token" }),
            { status: STATUS_CODE.Unauthorized },
        );
    }

    const supabaseService = new SupabaseService(token);

    const { data: userData, error: userError } = await supabaseService.getUser(
        token,
    );

    if (userError) {
        return new Response(
            JSON.stringify({ message: userError.message }),
            { status: STATUS_CODE.Unauthorized },
        );
    }

    const { data: group, error: groupError } = await supabaseService.supabase
        .from("groups")
        .insert({
            name,
            currency,
            created_at: new Date(),
            invite_code: crypto.randomUUID().slice(-6),
        }).select();

    if (groupError) {
        return new Response(
            JSON.stringify({ message: groupError.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    }

    if (!group) {
        return new Response(
            JSON.stringify({ message: "Group not created" }),
            { status: STATUS_CODE.InternalServerError },
        );
    }

    const { error: groupsProfilesError } = await supabaseService.supabase.from(
        "groups_profiles",
    )
        .insert({ user_id: userData.user.id, group_id: group[0].id });

    if (groupsProfilesError) {
        return new Response(
            JSON.stringify({ message: groupsProfilesError.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    }

    return new Response(
        JSON.stringify({ group }),
        {
            headers: { "Content-Type": "application/json" },
            status: STATUS_CODE.Created,
        },
    );
});
