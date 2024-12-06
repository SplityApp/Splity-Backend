import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";
import type { GroupDetailsWithExpenses } from "../_shared/dbTypes.ts";
import {
    type GetExpensesInCategoryRequest,
    type GetGroupExpensesResponse,
} from "../_shared/apiTypes.ts";
import { ExpenseCategory } from "../_shared/enums.ts";

console.info("[EDGE] expenses-in-category");

/**
 * @see GetExpensesInCategoryRequest
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
    const { category }: GetExpensesInCategoryRequest = await req.json();

    if (!token) {
        return new Response(
            JSON.stringify({ message: "Missing token" }),
            { status: STATUS_CODE.Unauthorized },
        );
    } else if (!category?.length) {
        return new Response(
            JSON.stringify({ message: "Missing category" }),
            { status: STATUS_CODE.BadRequest },
        );
    } else if (
        !Object.values(ExpenseCategory).includes(category as ExpenseCategory)
    ) {
        return new Response(
            JSON.stringify({ message: "Invalid category" }),
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
        expenses!inner (
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
                amount
            )
        )`)
        .eq("groups_profiles.user_id", data.user.id)
        .eq("expenses.category", category)
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

    const groupData = groups.data as unknown as GroupDetailsWithExpenses[];
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
                paid_by: expense.payer.username,
                created_at: expense.created_at,
            };
        });
    });

    return new Response(
        JSON.stringify(
            expenses as GetGroupExpensesResponse[],
        ),
        {
            headers: { "Content-Type": "application/json" },
            status: STATUS_CODE.OK,
        },
    );
});
