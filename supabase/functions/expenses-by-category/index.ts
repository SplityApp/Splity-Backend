import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";
import type { GroupDetails } from "../_shared/dbTypes.ts";
import { type GetExpensesByCategoryResponse } from "../_shared/apiTypes.ts";
import { ExpenseCategory } from "../_shared/enums.ts";

console.info("[EDGE] expenses-by-category");

/**
 * No request body required
 * @see GetExpensesByCategoryResponse
 */
Deno.serve(async (req) => {
    if (req.method !== "GET") {
        return new Response(
            JSON.stringify({ message: "Method not allowed" }),
            { status: STATUS_CODE.MethodNotAllowed },
        );
    }
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");

    if (!token) {
        return new Response(
            JSON.stringify({ message: "Missing token" }),
            { status: STATUS_CODE.Unauthorized },
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
            payments!inner (
                expense_id, 
                user_id, 
                amount, 
                state
            )
        )`)
        .eq("groups_profiles.user_id", data.user.id)
        .eq("expenses.payments.user_id", data.user.id);

    if (groups.error) {
        return new Response(
            JSON.stringify({ message: groups.error.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    } else if (!groups.data.length || !groups.data) {
        const emptyResponse = Object.values(ExpenseCategory).map(
            (value) => ({ category: value, total_amount: 0 }),
        );
        return new Response(
            JSON.stringify(emptyResponse as GetExpensesByCategoryResponse),
            { status: STATUS_CODE.NotFound },
        );
    }

    const groupData = groups.data as unknown as GroupDetails[];

    const expensesByCategory = Object.values(ExpenseCategory).map(
        (value) => {
            const expenses = groupData.flatMap((group) =>
                group?.expenses.filter((expense) => expense.category === value)
            );

            return {
                category: value,
                total_amount: expenses.reduce(
                    (acc, cur) => acc + cur.amount,
                    0,
                ),
            };
        },
    );

    return new Response(
        JSON.stringify(
            expensesByCategory as GetExpensesByCategoryResponse,
        ),
        {
            headers: { "Content-Type": "application/json" },
            status: STATUS_CODE.OK,
        },
    );
});