import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";
import type { GroupDetails } from "../_shared/types.ts";

console.log("[EDGE] group-details");

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

    const groups = await supabaseService.supabase
        .from("groups")
        .select(`
        id, 
        name, 
        currency, 
        created_at,
        invite_code,
        groups_profiles!inner ( user_id, group_id ),
        expenses (
            id,
            description,
            category,
            amount,
            paid_by,
            payments (
                expense_id, 
                user_id, 
                amount, 
                state
            )
        )`)
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

    const groupData = groups.data[0] as GroupDetails;
    const groupWithDetails = {
        id: groupData.id,
        name: groupData.name,
        currency: groupData.currency,
        created_at: groupData.created_at,
        invite_code: groupData.invite_code,
        expenses: groupData.expenses.map((expense) => {
            return {
                expense_id: expense.id,
                description: expense.description,
                category: expense.category,
                amount: expense.amount,
                state: expense.payments.some(
                        (payment) =>
                            payment.state === "pending" &&
                            (payment.user_id === data.user.id ||
                                expense.paid_by === data.user.id),
                    )
                    ? "pending"
                    : "fulfilled",
            };
        }),
    };

    return new Response(
        JSON.stringify({
            group_with_details: groupWithDetails,
        }),
        {
            headers: { "Content-Type": "application/json" },
            status: STATUS_CODE.Created,
        },
    );
});
