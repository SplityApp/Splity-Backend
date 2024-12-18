import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";
import { UserSignUpRequest, UserSignUpResponse } from "../_shared/apiTypes.ts";
import { logPayload } from "../_shared/helpers.ts";

console.info("[EDGE] User-sign-up");
/**
 * @see UserSignUpRequest
 * @see UserSignUpResponse
 */
Deno.serve(async (req) => {
    const body = await req.json() as UserSignUpRequest;
    logPayload(body);
    const {
        password,
        email,
        username,
        phone_number: phoneNumber,
    } = body;

    if (!email || !password || !username || !phoneNumber) {
        return new Response(
            JSON.stringify({ message: "Missing required fields" }),
            { status: STATUS_CODE.BadRequest },
        );
    } else if (
        !email.trim().length || !password.trim().length ||
        !username.trim().length || !phoneNumber.trim().length
    ) {
        return new Response(
            JSON.stringify({ message: "Invalid input" }),
            { status: STATUS_CODE.BadRequest },
        );
    } else if (!phoneNumber.trim().match(/^\d{9}$/)) {
        return new Response(
            JSON.stringify({ message: "Invalid phone number" }),
            { status: STATUS_CODE.BadRequest },
        );
    }

    const supabaseService = new SupabaseService();

    const { data, error } = await supabaseService.supabase.auth.signUp({
        email: email.trim(),
        phone: phoneNumber.trim(),
        password: password.trim(),
        options: {
            data: {
                username: username.trim(),
                phoneNumber: phoneNumber.trim(),
                charImage: username.trim().charAt(0).toUpperCase(),
            },
        },
    });

    if (error) {
        return new Response(
            JSON.stringify({ message: error.message }),
            { status: STATUS_CODE.Conflict },
        );
    }

    return new Response(
        JSON.stringify(data as UserSignUpResponse),
        {
            headers: { "Content-Type": "application/json" },
            status: STATUS_CODE.Created,
        },
    );
});
