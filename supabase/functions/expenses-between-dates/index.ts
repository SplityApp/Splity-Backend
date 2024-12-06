import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";
import type { GroupDetailsWithExpenses } from "../_shared/dbTypes.ts";
import {
    type GetExpensesBetweenDatesRequest,
    type GetExpensesBetweenDatesResponse,
    type GetGroupExpensesResponse,
} from "../_shared/apiTypes.ts";
import { logPayload } from "../_shared/helpers.ts";

console.info("[EDGE] expenses-between-dates");

/**
 * @see GetExpensesBetweenDatesRequest
 * @see GetExpensesBetweenDatesResponse
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
    const { start_date, end_date } = body;

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

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

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
            payments!inner (
                expense_id, 
                user_id, 
                amount, 
                created_at
            )
        )`)
        .eq("groups_profiles.user_id", data.user.id)
        .gte("expenses.payments.created_at", startDate.toISOString())
        .lte("expenses.payments.created_at", endDate.toISOString())
        .eq("expenses.payments.user_id", data.user.id);

    if (groups.error) {
        return new Response(
            JSON.stringify({ message: groups.error.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    } else if (!groups.data.length) {
        return new Response(
            JSON.stringify([] as GetExpensesBetweenDatesResponse),
            { status: STATUS_CODE.NotFound },
        );
    }

    const groupData = groups.data as unknown as GroupDetailsWithExpenses[];
    if (groupData.some((group) => !group?.expenses?.length)) {
        return new Response(
            JSON.stringify([] as GetExpensesBetweenDatesResponse),
            { status: STATUS_CODE.NotFound },
        );
    }

    const startMonth = startDate.getMonth();
    const startYear = startDate.getFullYear();
    const endMonth = endDate.getMonth();
    const endYear = endDate.getFullYear();

    const datesBetweenExpenseMap = new Map<string, GetGroupExpensesResponse>();
    const datesBetweenExpenseAmountMap = new Map<string, number>();
    for (let i = startYear; i <= endYear; i++) {
        for (
            let j = i === startYear ? startMonth : 1;
            j <= (i === endYear ? endMonth : 12);
            j++
        ) {
            datesBetweenExpenseMap.set(`${i}/${j}`, []);
            datesBetweenExpenseAmountMap.set(`${i}/${j}`, 0);
        }
    }

    groupData.forEach((group) => {
        group.expenses.forEach((expense) => {
            const date = new Date(expense.created_at);
            const key = `${date.getFullYear()}/${date.getMonth()}`;
            datesBetweenExpenseMap.get(key)?.push({
                id: expense.id,
                description: expense.description,
                category: expense.category,
                amount: Math.abs(expense.amount),
                paid_by: expense.payer.username,
                created_at: expense.created_at,
            });
            datesBetweenExpenseAmountMap.set(
                key,
                datesBetweenExpenseAmountMap.get(key) ??
                    0 + Math.abs(expense.amount),
            );
        });
    });

    const response = Array.from(datesBetweenExpenseMap.entries()).map(
        ([key, expenses]) => ({
            date: key,
            total_amount: datesBetweenExpenseAmountMap.get(key) ?? 0,
            expenses,
        }),
    );

    return new Response(
        JSON.stringify(
            response as GetExpensesBetweenDatesResponse,
        ),
        {
            headers: { "Content-Type": "application/json" },
            status: STATUS_CODE.OK,
        },
    );
});
