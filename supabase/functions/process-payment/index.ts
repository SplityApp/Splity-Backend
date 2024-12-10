import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";
import type { Payment } from "../_shared/dbTypes.ts";
import { logPayload } from "../_shared/helpers.ts";
import { ProcessPaymentRequest } from "../_shared/apiTypes.ts";

console.info("[EDGE] process-payment");

/**
 * @see ProcessPaymentRequest
 * There is no response body for this endpoint.
 */
Deno.serve(async (req) => {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");

    if (!token) {
        return new Response(
            JSON.stringify({ message: "Missing token" }),
            { status: STATUS_CODE.Unauthorized },
        );
    }

    const supabaseService = new SupabaseService(token);

    const { data: userData, error: userDataError } = await supabaseService
        .getUser(
            token,
        );
    if (userDataError) {
        return new Response(
            JSON.stringify({ message: userDataError.message }),
            { status: STATUS_CODE.Unauthorized },
        );
    }

    const body = await req.json() as ProcessPaymentRequest;
    logPayload(body);
    const { receiver_id: receiverId, amount, group_id: groupId } = body;
    if (!receiverId || !amount || !groupId) {
        return new Response(
            JSON.stringify({ message: "Missing data" }),
            { status: STATUS_CODE.BadRequest },
        );
    }

    // insert to transactions
    const { error: transactionError } = await supabaseService
        .supabase
        .from("transactions")
        .insert({
            user_id: userData.user.id,
            receiver_id: receiverId,
            amount,
        });

    if (transactionError) {
        return new Response(
            JSON.stringify({ message: transactionError.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    }

    try {
        // Get existing balance between users (in both directions)
        const { data: existingBalances, error: balanceCheckError } =
            await supabaseService
                .supabase
                .from("user_group_balances")
                .select("*")
                .eq("group_id", groupId)
                .or(`and(from_user.eq.${userData.user.id},to_user.eq.${receiverId}),and(from_user.eq.${receiverId},to_user.eq.${userData.user.id})`);

        if (balanceCheckError) {
            throw balanceCheckError;
        }

        let finalFromUser: string = userData.user.id;
        let finalToUser: string = receiverId;
        let finalAmount: number = amount;

        if (existingBalances && existingBalances.length > 0) {
            const balance = existingBalances[0];

            if (
                balance.from_user === userData.user.id &&
                balance.to_user === receiverId
            ) {
                // Existing debt in same direction
                finalFromUser = userData.user.id;
                finalToUser = receiverId;
                finalAmount = Number(balance.amount) - Number(amount);
            } else if (
                balance.from_user === receiverId &&
                balance.to_user === userData.user.id
            ) {
                // Existing debt in opposite direction
                if (Number(balance.amount) > Number(amount)) {
                    // Keep same direction, reduce amount
                    finalFromUser = receiverId;
                    finalToUser = userData.user.id;
                    finalAmount = Number(balance.amount) - Number(amount);
                } else {
                    // Switch direction
                    finalFromUser = userData.user.id;
                    finalToUser = receiverId;
                    finalAmount = Number(amount) - Number(balance.amount);
                }
            }

            // Delete existing balance
            const { error: deleteError } = await supabaseService
                .supabase
                .from("user_group_balances")
                .delete()
                .eq("group_id", groupId)
                .or(`and(from_user.eq.${userData.user.id},to_user.eq.${receiverId}),and(from_user.eq.${receiverId},to_user.eq.${userData.user.id})`);

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
                    group_id: groupId,
                    from_user: finalFromUser,
                    to_user: finalToUser,
                    amount: finalAmount,
                });

            if (insertError) {
                throw insertError;
            }
        }

        return new Response(
            null,
            {
                headers: { "Content-Type": "application/json" },
                status: STATUS_CODE.Created,
            },
        );
    } catch (error: any) {
        return new Response(
            JSON.stringify({ message: error.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    }
});
