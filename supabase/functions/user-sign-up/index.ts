import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";

console.log("[EDGE] User-sign-up");

Deno.serve(async (req) => {
    const { password, email, username, phoneNumber } = await req.json();

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
        JSON.stringify(data),
        {
            headers: { "Content-Type": "application/json" },
            status: STATUS_CODE.Created,
        },
    );
});
