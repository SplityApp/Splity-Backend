import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";
import type { GroupDetailsWithExpenses } from "../_shared/dbTypes.ts";
import {
    GetGroupDetailsRequest,
    type GetGroupExpensesResponse,
} from "../_shared/apiTypes.ts";
import { logPayload } from "../_shared/helpers.ts";

console.info("[EDGE] group-expenses");

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
    const body = await req.json() as GetGroupDetailsRequest;
    logPayload(body);
    const { group_id: groupId } = body;

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
            created_at,
            payer:profiles!paid_by (
                username
            ),
            payments (
                expense_id, 
                user_id, 
                amount
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

    const groupData = groups.data[0] as unknown as GroupDetailsWithExpenses;
    if (!groupData?.expenses?.length) {
        return new Response(
            JSON.stringify([] as GetGroupExpensesResponse),
            { status: STATUS_CODE.NotFound },
        );
    }

    const expenses = groupData.expenses.map((expense) => {
        return {
            id: expense.id,
            description: expense.description,
            category: expense.category,
            amount: expense.amount,
            paid_by: expense.payer.username,
            created_at: expense.created_at,
        };
    });

    expenses.sort((a, b) => {
        return new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime();
    });

    return new Response(
        JSON.stringify(
            expenses as GetGroupExpensesResponse,
        ),
        {
            headers: { "Content-Type": "application/json" },
            status: STATUS_CODE.OK,
        },
    );
});
