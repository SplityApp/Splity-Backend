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

    const { data: _, error: getUserError } = await supabaseService.getUser(
        token,
    );
    if (getUserError) {
        return new Response(
            JSON.stringify({ message: getUserError.message }),
            { status: STATUS_CODE.Unauthorized },
        );
    }

    const body = await req.json() as ProcessPaymentRequest;
    logPayload(body);
    const { expense_id: expenseId, payer_id: payerId } = body;
    if (!expenseId || !payerId) {
        return new Response(
            JSON.stringify({ message: "Missing data" }),
            { status: STATUS_CODE.BadRequest },
        );
    }

    //TODO: trzeba napisac na nowo

    return new Response(
        null,
        {
            headers: { "Content-Type": "application/json" },
            status: STATUS_CODE.Created,
        },
    );
});
