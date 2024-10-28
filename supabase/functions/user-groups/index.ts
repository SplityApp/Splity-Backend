import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { HTTP_STATUS_CODES as status } from "@develiott/http-status-codes";
import { SupabaseService } from "../../../utils/SupabaseService.ts";
import type { Expense, Group, Payment } from "../../../utils/types.ts";

console.log("[EDGE] user-groups");

Deno.serve(async (req) => {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");

    if (!token) {
        return new Response(
            JSON.stringify({ message: "Missing token" }),
            { status: status.UNAUTHORIZED },
        );
    }

    const supabaseService = new SupabaseService(token);

    const { data, error } = await supabaseService.getUser(token);

    if (error) {
        return new Response(
            JSON.stringify({ message: error.message }),
            { status: status.UNAUTHORIZED },
        );
    }

    const groups = await supabaseService.supabase.from("groups").select(
        `id,
    name,
    currency,
    created_at,
    groups_profiles ( user_id, group_id )`,
    ).eq("groups_profiles.user_id", data.user.id);

    if (groups.error) {
        return new Response(
            JSON.stringify({ message: groups.error.message }),
            { status: status.INTERNAL_SERVER_ERROR },
        );
    }

    const groupsIds = groups.data.map((group: Group) => group.id);

    const userPayments = await Promise.allSettled(
        groupsIds.map(async (groupId: string) => {
            return await supabaseService.supabase.from("expenses").select(
                `description,
        payments ( user_id, amount, state)`,
            ).eq("group_id", groupId).eq("payments.user_id", data.user.id);
        }),
    );

    const groupSums = groupsIds.reduce(
        (acc: Record<string, number>, groupId: string, index: number) => {
            const result = userPayments[index];

            if (
                result.status === "fulfilled" && !result.value.error
            ) {
                const sum = result.value.data.reduce(
                    (total: number, expense: Expense) => {
                        const payments = expense.payments.filter((payment) =>
                            payment.state === "pending"
                        ) || [];
                        return total +
                            payments.reduce(
                                (paymentTotal: number, payment: Payment) =>
                                    paymentTotal + (payment.amount || 0),
                                0,
                            );
                    },
                    0,
                );

                acc[groupId] = sum;
            } else {
                acc[groupId] = 0;
            }

            return acc;
        },
        {},
    );

    const groupsWithSums = groups.data.map((group: Group) => ({
        ...group,
        totalAmount: groupSums[group.id] || 0,
    }));

    return new Response(
        JSON.stringify({
            groups: groupsWithSums,
        }),
        { headers: { "Content-Type": "application/json" }, status: status.OK },
    );
});
