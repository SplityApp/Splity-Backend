import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { HTTP_STATUS_CODES as status } from "@develiott/http-status-codes";
import { SupabaseService } from "../../../utils/SupabaseService.ts";

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
            { status: status.CONFLICT },
        );
    }

    return new Response(
        JSON.stringify(data),
        {
            headers: { "Content-Type": "application/json" },
            status: status.CREATED,
        },
    );
});
