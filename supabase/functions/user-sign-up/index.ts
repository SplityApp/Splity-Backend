import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";
import { UserSignUpRequest, UserSignUpResponse } from "../_shared/apiTypes.ts";

console.info("[EDGE] User-sign-up");
/**
 * @see UserSignUpRequest
 * @see UserSignUpResponse
 */
Deno.serve(async (req) => {
    const {
        password,
        email,
        username,
        phone_number: phoneNumber,
    }: UserSignUpRequest = await req.json();

    const supabaseService = new SupabaseService();

    const { data, error } = await supabaseService.supabase.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                username: username,
                phoneNumber: phoneNumber,
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
