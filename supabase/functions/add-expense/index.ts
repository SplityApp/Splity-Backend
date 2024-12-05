import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { AddExpenseRequest } from "../_shared/apiTypes.ts";
import { SupabaseService } from "../_shared/SupabaseService.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { ExpenseCategory } from "../_shared/enums.ts";

console.info("[EDGE] add-expense");

Deno.serve(async (req) => {
    const { group_id, description, category, amount, splits, paid_by }:
        AddExpenseRequest = await req.json();
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");

    if (!token) {
        return new Response(
            JSON.stringify({ message: "Missing token" }),
            { status: STATUS_CODE.Unauthorized },
        );
    } else if (
        !Object.values(ExpenseCategory).includes(category as ExpenseCategory)
    ) {
        return new Response(
            JSON.stringify({ message: "Invalid category" }),
            { status: STATUS_CODE.BadRequest },
        );
    }

    if (
        !paid_by ||
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
            paid_by,
        })
        .select("id")
        .single();

    if (expenseError) {
        return new Response(
            JSON.stringify({ message: expenseError.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    }

    try {
        // Insert expense
        const { data: expenseData, error: expenseError } = await supabaseService
            .supabase
            .from("expenses")
            .insert({
                group_id,
                description,
                category,
                amount,
                paid_by,
            })
            .select("id")
            .single();

        if (expenseError) {
            throw expenseError;
        }

        // Insert payments
        for (const split of splits) {
            const { error: debtorPaymentError } = await supabaseService
                .supabase
                .from("payments")
                .insert({
                    expense_id: expenseData.id,
                    user_id: split.user_id,
                    amount: split.amount,
                    state: split.user_id === paid_by ? "fulfilled" : "pending",
                });

            if (debtorPaymentError) {
                throw debtorPaymentError;
            }

            // Get existing balance between users (in both directions)
            const { data: existingBalances, error: balanceCheckError } =
                await supabaseService
                    .supabase
                    .from("user_group_balances")
                    .select("*")
                    .eq("group_id", group_id)
                    .or(`and(from_user.eq.${split.user_id},to_user.eq.${paid_by}),and(from_user.eq.${paid_by},to_user.eq.${split.user_id})`);

            if (balanceCheckError) {
                throw balanceCheckError;
            }

            if (split.user_id !== paid_by) { // Skip self-payments
                let finalFromUser: string = split.user_id; // Initialize with default values
                let finalToUser: string = paid_by;
                let finalAmount: number = split.amount;

                if (existingBalances && existingBalances.length > 0) {
                    const balance = existingBalances[0];
                    if (
                        balance.from_user === split.user_id &&
                        balance.to_user === paid_by
                    ) {
                        // Existing debt in same direction
                        finalFromUser = split.user_id;
                        finalToUser = paid_by;
                        finalAmount = Number(balance.amount) +
                            Number(split.amount);
                    } else if (
                        balance.from_user === paid_by &&
                        balance.to_user === split.user_id
                    ) {
                        // Existing debt in opposite direction
                        if (Number(balance.amount) > Number(split.amount)) {
                            // Keep same direction, reduce amount
                            finalFromUser = paid_by;
                            finalToUser = split.user_id;
                            finalAmount = Number(balance.amount) -
                                Number(split.amount);
                        } else {
                            // Switch direction
                            finalFromUser = split.user_id;
                            finalToUser = paid_by;
                            finalAmount = Number(split.amount) -
                                Number(balance.amount);
                        }
                    }

                    // Delete existing balance if exists
                    const { error: deleteError } = await supabaseService
                        .supabase
                        .from("user_group_balances")
                        .delete()
                        .eq("group_id", group_id)
                        .or(`and(from_user.eq.${split.user_id},to_user.eq.${paid_by}),and(from_user.eq.${paid_by},to_user.eq.${split.user_id})`);

                    if (deleteError) {
                        throw deleteError;
                    }
                }

                // Only insert if there's a non-zero balance
                if (finalAmount > 0) {
                    const { error: insertError } = await supabaseService
                        .supabase
                        .from("user_group_balances")
                        .insert({
                            group_id,
                            from_user: finalFromUser,
                            to_user: finalToUser,
                            amount: finalAmount,
                        });

                    if (insertError) {
                        throw insertError;
                    }
                }
            }
        }

        return new Response(null, {
            status: STATUS_CODE.Created,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error: any) {
        // Rollback: delete the expense and related records if any error occurs
        if (expenseData?.id) {
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
        }

        return new Response(
            JSON.stringify({ message: error.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    }
});
