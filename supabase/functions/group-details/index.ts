import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";
import type { GroupDetails, Profile } from "../_shared/dbTypes.ts";
import {
    GetGroupDetailsRequest,
    type GetGroupDetailsResponse,
} from "../_shared/apiTypes.ts";

console.info("[EDGE] group-details");

/**
 * @see GetGroupDetailsRequest
 * @see GetGroupExpensesResponse
 */
Deno.serve(async (req) => {
    if (req.method !== "POST") {
        return new Response(
            JSON.stringify({ message: "Method not allowed" }),
            { status: STATUS_CODE.MethodNotAllowed },
        );
    }
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { group_id: groupId }: GetGroupDetailsRequest = await req.json();

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

    const groups = await supabaseService.supabase
        .from("groups")
        .select(`
        id, 
        name, 
        currency, 
        created_at,
        invite_code,
        groups_profiles!inner ( user_id, group_id ),
        profiles!inner ( id, email, phone_number, username, char_image, allowed_notifications )`)
        .eq("id", groupId)
        .eq("groups_profiles.user_id", data.user.id);

    if (groups.error) {
        return new Response(
            JSON.stringify({ message: groups.error.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    } else if (!groups.data.length) {
        return new Response(
            JSON.stringify({ message: "Group not found" }),
            { status: STATUS_CODE.NotFound },
        );
    }

    const { data: lastGroupExpenseData, error: lastGroupExpenseError } =
        await supabaseService
            .supabase
            .from("expenses")
            .select(`group_id, created_at`)
            .eq("group_id", groupId)
            .order("created_at", { ascending: false })
            .limit(1);

    if (lastGroupExpenseError) {
        return new Response(
            JSON.stringify({ message: lastGroupExpenseError.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    }

    const groupData = groups.data[0] as unknown as GroupDetails;
    const lastExpense = lastGroupExpenseData.length === 1
        ? lastGroupExpenseData[0] as unknown as { created_at: string }
        : { created_at: groupData.created_at };

    const groupWithDetails = {
        id: groupData.id,
        name: groupData.name,
        currency: groupData.currency,
        invite_code: groupData.invite_code,
        profiles: groupData.profiles,
        created_at: groupData.created_at,
        updated_at: lastExpense.created_at,
    };

    return new Response(
        JSON.stringify(
            groupWithDetails as GetGroupDetailsResponse,
        ),
        {
            headers: { "Content-Type": "application/json" },
            status: STATUS_CODE.OK,
        },
    );
});
