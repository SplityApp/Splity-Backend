import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";
import type { GroupDetails } from "../_shared/dbTypes.ts";
import {
    type GetExpensesBetweenDatesRequest,
    type GetGroupExpensesResponse,
} from "../_shared/apiTypes.ts";

console.info("[EDGE] expenses-between-dates");

/**
 * @see GetExpensesBetweenDatesRequest
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
    const { start_date, end_date }: GetExpensesBetweenDatesRequest = await req
        .json();

    if (!token) {
        return new Response(
            JSON.stringify({ message: "Missing token" }),
            { status: STATUS_CODE.Unauthorized },
        );
    } else if (!start_date?.length || !end_date?.length) {
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
            payer:profiles!paid_by (
                user_name
            ),
            payments!inner (
                expense_id, 
                user_id, 
                amount, 
                state,
                created_at
            )
        )`)
        .eq("groups_profiles.user_id", data.user.id)
        .gte("expenses.payments.created_at", new Date(start_date).toISOString())
        .lte("expenses.payments.created_at", new Date(end_date).toISOString())
        .eq("expenses.payments.user_id", data.user.id);

    if (groups.error) {
        return new Response(
            JSON.stringify({ message: groups.error.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    } else if (!groups.data.length) {
        return new Response(
            JSON.stringify([] as GetGroupExpensesResponse),
            { status: STATUS_CODE.NotFound },
        );
    }

    const groupData = groups.data as unknown as GroupDetails[];
    if (groupData.some((group) => !group?.expenses?.length)) {
        return new Response(
            JSON.stringify([] as GetGroupExpensesResponse),
            { status: STATUS_CODE.NotFound },
        );
    }
    const expenses = groupData.map((group) => {
        return group.expenses.map((expense) => {
            return {
                id: expense.id,
                description: expense.description,
                category: expense.category,
                amount: expense.amount,
                paid_by: expense.payer.user_name,
                created_at: expense.created_at,
                state: expense.payments.some(
                        (payment) =>
                            payment.state === "pending" &&
                            (payment.user_id === data.user.id ||
                                expense.paid_by === data.user.id),
                    )
                    ? "pending"
                    : "fulfilled",
            };
        });
    });

    return new Response(
        JSON.stringify(
            expenses as unknown as GetGroupExpensesResponse,
        ),
        {
            headers: { "Content-Type": "application/json" },
            status: STATUS_CODE.Created,
        },
    );
});
