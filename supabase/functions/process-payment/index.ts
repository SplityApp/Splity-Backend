import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";
import type { Payment } from "../_shared/dbTypes.ts";
import { logPayload } from "../_shared/helpers.ts";
import { ProcessPaymentRequest } from "../_shared/apiTypes.ts";

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
    const { receiver_id: receiverId, amount } = body;
    if (!receiverId || !amount) {
        return new Response(
            JSON.stringify({ message: "Missing data" }),
            { status: STATUS_CODE.BadRequest },
        );
    }

    // insert to transactions
    const { data: paymentData, error: paymentError } = await supabaseService
        .supabase
        .from("transactions")
        .insert({
            id: userData.user.id,
            receiver_id: receiverId,
            amount,
        });

    if (paymentError) {
        return new Response(
            JSON.stringify({ message: paymentError.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    }

    // HERE: Regulate the balance of the sender and receiver

    return new Response(
        null,
        {
            headers: { "Content-Type": "application/json" },
            status: STATUS_CODE.Created,
        },
    );
});
