import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";

console.info("[EDGE] user-currencies");

/**
 * No request body is required for this endpoint.
 * @see string[]
 */

Deno.serve(async (req) => {
    if (req.method !== "GET") {
        return new Response(
            JSON.stringify({ message: "Method not allowed" }),
            { status: STATUS_CODE.MethodNotAllowed },
        );
    }
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");

    if (!token) {
        return new Response(
            JSON.stringify({ message: "Missing token" }),
            { status: STATUS_CODE.Unauthorized },
        );
    }

    const supabaseService = new SupabaseService(token);

    const { data, error } = await supabaseService.getUser(token);

    if (error) {
        return new Response(
            JSON.stringify({ message: error.message }),
            { status: STATUS_CODE.Unauthorized },
        );
    }

    const groupsCurrencies = await supabaseService.supabase
        .from("groups")
        .select(`
        currency, 
        groups_profiles!inner (
            user_id, 
            group_id
        )
    `)
        .eq("groups_profiles.user_id", data.user.id);

    if (groupsCurrencies.error) {
        return new Response(
            JSON.stringify({ message: groupsCurrencies.error.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    } else if (!groupsCurrencies.data.length) {
        return new Response(
            JSON.stringify([]),
            { status: STATUS_CODE.OK },
        );
    }

    const uniqueCurrencies = new Set<string>();
    for (const group of groupsCurrencies.data) {
        uniqueCurrencies.add(group.currency);
    }

    return new Response(
        JSON.stringify(Array.from(uniqueCurrencies)),
        {
            headers: { "Content-Type": "application/json" },
            status: STATUS_CODE.OK,
        },
    );
});
