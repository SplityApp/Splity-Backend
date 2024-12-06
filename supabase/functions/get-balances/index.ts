import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";
import type { GroupProfiles } from "../_shared/dbTypes.ts";
import { logPayload } from "../_shared/helpers.ts";
import { GetBalancesRequest } from "../_shared/apiTypes.ts";

console.log("[EDGE] Get-balances");

/**
 * @see GetBalancesRequest
 * @see GetBalancesResponse
 */
Deno.serve(async (req) => {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");

    if (!token) {
        return new Response(
            JSON.stringify({ message: "Missing token" }),
            { status: STATUS_CODE.Unauthorized },
        );
    }

    const body = await req.json() as GetBalancesRequest;
    logPayload(body);
    const { group_id: groupId } = body;

    if (!groupId) {
        return new Response(
            JSON.stringify({ message: "Missing groupId" }),
            { status: STATUS_CODE.BadRequest },
        );
    }

    const supabaseService = new SupabaseService(token);

    const { data: userData, error: userError } = await supabaseService.getUser(
        token,
    );
    if (userError) {
        return new Response(
            JSON.stringify({ message: userError.message }),
            { status: STATUS_CODE.Unauthorized },
        );
    }
    const requestUserID = userData.user.id;

    const { data: groupData, error: groupDataError } = await supabaseService
        .supabase
        .from("groups")
        .select(
            `groups_profiles!inner ( user_id,
                                    group_id,
                                    profiles!inner ( username ) )`,
        ).eq("id", groupId)
        .single();

    if (groupDataError) {
        return new Response(
            JSON.stringify({ message: groupDataError.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    }

    if (
        !groupData.groups_profiles.flatMap((profile: GroupProfiles) =>
            profile.user_id
        )
            .includes(requestUserID)
    ) {
        return new Response(
            JSON.stringify({ message: "User not in group" }),
            { status: STATUS_CODE.Unauthorized },
        );
    }

    const usersWithinGroup = groupData.groups_profiles.map((group) => (
        {
            id: group.user_id,
            balance: 0,
            name: (group.profiles as any).username, // SDK says its array but its object
        }
    ));

    for (const user of usersWithinGroup) {
        const {
            data: balancesWithinGroup,
            error: balancesWithinGroupError,
        } = await supabaseService.supabase
            .from("user_group_balances")
            .select("from_user, to_user, amount")
            .eq("group_id", groupId);

        if (balancesWithinGroupError) {
            console.error(
                JSON.stringify(balancesWithinGroupError, null, 2),
            );
            throw balancesWithinGroupError;
        }

        if (balancesWithinGroup) {
            const moneyOwedToMeInGroup = balancesWithinGroup
                .filter((balance) => balance.to_user === user.id)
                .reduce((acc, balance) => acc + Number(balance.amount), 0);

            const moneyIHaveToPayInGroup = balancesWithinGroup
                .filter((balance) => balance.from_user === user.id)
                .reduce((acc, balance) => acc + Number(balance.amount), 0);

            const myMoneyBalanceInGroup = moneyOwedToMeInGroup -
                moneyIHaveToPayInGroup;

            user.balance = myMoneyBalanceInGroup;
        }
    }

    try {
        const requestUser = usersWithinGroup.find((user) =>
            user.id === requestUserID
        );

        if (!requestUser) {
            return new Response(
                JSON.stringify({ message: "User not found" }),
                { status: STATUS_CODE.NotFound },
            );
        }

        const filteredUsers = usersWithinGroup.filter((user) =>
            user.id !== requestUserID
        );

        const response = {
            request_user: requestUser,
            users: filteredUsers,
        };

        return new Response(JSON.stringify(response), {
            status: STATUS_CODE.OK,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error: any) {
        return new Response(
            JSON.stringify({ message: error.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    }
});
