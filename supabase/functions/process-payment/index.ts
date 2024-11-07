import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";
import type { Payment } from "../_shared/dbTypes.ts";

console.info("[EDGE] process-payment");

/**
 * @see ProcessPaymentRequest
 * @see ProcessPaymentResponse
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

    const { data, error: getUserError } = await supabaseService.getUser(token);
    if (getUserError) {
        return new Response(
            JSON.stringify({ message: getUserError.message }),
            { status: STATUS_CODE.Unauthorized },
        );
    }

    const { expense_id: expenseId, payer_id: payerId } = await req.json();
    if (!expenseId || !payerId) {
        return new Response(
            JSON.stringify({ message: "Missing data" }),
            { status: STATUS_CODE.BadRequest },
        );
    }

    const payment = await supabaseService.supabase
        .from("payments")
        .select("expense_id, user_id, amount, state")
        .eq(
            "expense_id",
            expenseId,
        )
        .eq("user_id", payerId)
        .single();

    if (payment.error) {
        return new Response(
            JSON.stringify({ message: payment.error.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    }
    if (!payment.data) {
        return new Response(
            JSON.stringify({ message: "Payment not found" }),
            { status: STATUS_CODE.NotFound },
        );
    }
    const paymentData = payment.data as Payment;
    if (paymentData.state == "fulfilled") {
        return new Response(
            JSON.stringify({ message: "Payment already paid" }),
            { status: STATUS_CODE.BadRequest },
        );
    }

    const { data: _, error: updatePaymentError } = await supabaseService
        .supabase
        .from("payments")
        .update({ state: "fulfilled" })
        .eq("expense_id", expenseId)
        .eq("user_id", payerId)
        .single();

    if (updatePaymentError) {
        return new Response(
            JSON.stringify({ message: updatePaymentError.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    }

    return new Response(
        null,
        {
            headers: { "Content-Type": "application/json" },
            status: STATUS_CODE.Created,
        },
    );
});
