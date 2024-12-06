import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";
import type { Group } from "../_shared/dbTypes.ts";
import { GetUserGroupsResponse } from "../_shared/apiTypes.ts";

console.info("[EDGE] user-groups");

/**
 * No request body is needed for this endpoint.
 * @see GetUserGroupsResponse
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

    const { data, error } = await supabaseService.getUser(token);

    if (error) {
        return new Response(
            JSON.stringify({ message: error.message }),
            { status: STATUS_CODE.Unauthorized },
        );
    }

    const groups = await supabaseService.supabase
        .from("groups")
        .select(
            `id, name, currency, created_at, groups_profiles!inner ( user_id, group_id )`,
        )
        .eq("groups_profiles.user_id", data.user.id);

    if (groups.error) {
        return new Response(
            JSON.stringify({ message: groups.error.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    }

    const myId = data.user.id;

    const groupsWithMyBalances = await Promise.all(
        groups.data.map(async (group: Group) => {
            const {
                data: balancesWithinGroup,
                error: balancesWithinGroupError,
            } = await supabaseService.supabase
                .from("user_group_balances")
                .select("from_user, to_user, amount")
                .eq("group_id", group.id);

            if (balancesWithinGroupError) {
                console.error(
                    JSON.stringify(balancesWithinGroupError, null, 2),
                );
                throw balancesWithinGroupError;
            }

            if (balancesWithinGroup) {
                const moneyOwedToMeInGroup = balancesWithinGroup
                    .filter((balance) => balance.to_user === myId)
                    .reduce((acc, balance) => acc + balance.amount, 0);

                const moneyIHaveToPayInGroup = balancesWithinGroup
                    .filter((balance) => balance.from_user === myId)
                    .reduce((acc, balance) => acc + balance.amount, 0);

                const myMoneyBalanceInGroup = moneyOwedToMeInGroup -
                    moneyIHaveToPayInGroup;

                return {
                    ...group,
                    my_balance: myMoneyBalanceInGroup,
                };
            }

            return {
                ...group,
                my_balance: 0,
            };
        }),
    );

    return new Response(
        JSON.stringify({
            groups: groupsWithMyBalances as GetUserGroupsResponse,
        }),
        {
            headers: { "Content-Type": "application/json" },
            status: STATUS_CODE.OK,
        },
    );
});
