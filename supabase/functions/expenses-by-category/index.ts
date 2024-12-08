import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";
import type { GroupDetailsWithExpenses } from "../_shared/dbTypes.ts";
import {
    type GetExpensesBetweenDatesRequest,
    type GetExpensesByCategoryResponse,
} from "../_shared/apiTypes.ts";
import { ExpenseCategory } from "../_shared/enums.ts";
import { logPayload } from "../_shared/helpers.ts";

console.info("[EDGE] expenses-by-category");

/**
 * @see GetExpensesBetweenDatesRequest
 * @see GetExpensesByCategoryResponse
 * @remarks Expense amount is always positive here
 * (does not matter if you paid it or someone else did you still spent that amount)
 */
Deno.serve(async (req) => {
    if (req.method !== "POST") {
        return new Response(
            JSON.stringify({ message: "Method not allowed" }),
            { status: STATUS_CODE.MethodNotAllowed },
        );
    }
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const body = await req.json() as GetExpensesBetweenDatesRequest;
    logPayload(body);
    const { start_date, end_date, currency } = body;

    if (!token) {
        return new Response(
            JSON.stringify({ message: "Missing token" }),
            { status: STATUS_CODE.Unauthorized },
        );
    } else if (!start_date?.length || !end_date?.length || !currency?.length) {
        return new Response(
            JSON.stringify({ message: "Missing dates" }),
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
            payments!inner (
                expense_id, 
                user_id, 
                amount
            )
        )`)
        .eq("groups_profiles.user_id", data.user.id)
        .eq("expenses.payments.user_id", data.user.id)
        .gte("expenses.payments.created_at", start_date)
        .lte("expenses.payments.created_at", end_date)
        .eq("currency", currency);

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

    const groupData = groups.data as unknown as GroupDetailsWithExpenses[];

    const expensesByCategory = Object.values(ExpenseCategory).map(
        (value) => {
            const expenses = groupData.flatMap((group) =>
                group?.expenses.filter((expense) => expense.category === value)
            );

            return {
                category: value,
                total_amount: expenses.reduce(
                    (acc, cur) => acc + Math.abs(cur.amount),
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
