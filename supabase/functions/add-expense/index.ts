import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { AddExpenseRequest } from "../_shared/apiTypes.ts";
import { SupabaseService } from "../_shared/SupabaseService.ts";
import { STATUS_CODE } from "jsr:@std/http/status";

console.info("[EDGE] add-expense");

Deno.serve(async (req) => {
    const { group_id, description, category, amount, splits }:
        AddExpenseRequest = await req.json();
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");

    if (!token) {
        return new Response(
            JSON.stringify({ message: "Missing token" }),
            { status: STATUS_CODE.Unauthorized },
        );
    }

    if (
        !group_id ||
        !description ||
        !category ||
        !amount ||
        !splits?.length
    ) {
        return new Response(
            JSON.stringify({ message: "Missing required fields" }),
            { status: STATUS_CODE.BadRequest },
        );
    }

    splits.forEach((split) => {
        if (!split.user_id || !split.amount) {
            return new Response(
                JSON.stringify({ message: "Invalid splits" }),
                { status: STATUS_CODE.BadRequest },
            );
        }
    });

    const supabaseService = new SupabaseService(token);
    const { data: userData, error: userError } = await supabaseService.getUser(
        token,
    );

    if (userError) {
        return new Response(
            JSON.stringify({ message: userError.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    }

    const { data: expenseData, error: expenseError } = await supabaseService
        .supabase
        .from("expenses")
        .insert({
            group_id,
            description,
            category,
            amount,
            paid_by: userData.user.id,
        })
        .select("id")
        .single();

    if (expenseError) {
        return new Response(
            JSON.stringify({ message: expenseError.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    }

    for (const split of splits) {
        const { error: debtorPaymentError } = await supabaseService
            .supabase
            .from("payments")
            .insert({
                expense_id: expenseData.id,
                user_id: split.user_id,
                amount: split.amount,
                state: split.user_id === userData.user.id
                    ? "fulfilled"
                    : "pending",
            });

        if (debtorPaymentError) {
            await supabaseService
                .supabase
                .from("expenses")
                .delete()
                .eq("id", expenseData.id);

            await supabaseService
                .supabase
                .from("payments")
                .delete()
                .eq("expense_id", expenseData.id);

            return new Response(
                JSON.stringify({ message: debtorPaymentError.message }),
                { status: STATUS_CODE.InternalServerError },
            );
        }
    }

    return new Response(null, {
        status: STATUS_CODE.Created,
        headers: { "Content-Type": "application/json" },
    });
});
