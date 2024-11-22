import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";
import type { GroupProfiles } from "../_shared/dbTypes.ts";

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

    const groupData: { group_id: string } = await req.json();

    if (!groupData.group_id) {
        return new Response(
            JSON.stringify({ message: "Missing groupId" }),
            { status: STATUS_CODE.BadRequest },
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

    const requestUserID = data.user.id;

    const group = await supabaseService.supabase
        .from("groups")
        .select(
            `id, name, created_at, groups_profiles!inner ( user_id, group_id )`,
        ).eq("id", groupData.group_id);

    if (group.error) {
        return new Response(
            JSON.stringify({ message: group.error.message }),
            { status: STATUS_CODE.InternalServerError },
        );
    }

    if (
        !group.data[0].groups_profiles.flatMap((profile: GroupProfiles) =>
            profile.user_id
        )
            .includes(data.user.id)
    ) {
        return new Response(
            JSON.stringify({ message: "User not in group" }),
            { status: STATUS_CODE.Unauthorized },
        );
    }

    const expensesPopulatedWithPayments = await supabaseService.supabase
        .from("expenses")
        .select(
            `description, paid_by, amount, payments ( expense_id, user_id, amount, state)`,
        )
        .eq("group_id", groupData.group_id);

    if (expensesPopulatedWithPayments.error) {
        return new Response(
            JSON.stringify({
                message: expensesPopulatedWithPayments.error.message,
            }),
            { status: STATUS_CODE.InternalServerError },
        );
    }

    const usersWithinGroup = group.data[0].groups_profiles.map((group) => (
        {
            id: group.user_id,
            balance: 0,
        }
    ));

    for (const user of usersWithinGroup) {
        let moneyOwedToMeInGroup = 0;
        let moneyIHaveToPayInGroup = 0;

        for (const expense of expensesPopulatedWithPayments.data) {
            for (const payment of expense.payments) {
                if (expense.paid_by == user.id && payment.state === "pending") {
                    moneyOwedToMeInGroup += payment.amount;
                } else if (
                    payment.user_id == user.id && payment.state === "pending"
                ) {
                    moneyIHaveToPayInGroup += payment.amount;
                }
            }
        }

        const myMoneyBalanceInGroup = moneyOwedToMeInGroup -
            moneyIHaveToPayInGroup;

        user.balance = myMoneyBalanceInGroup;
    }

    try {
        const updatedUsers = await Promise.all(
            usersWithinGroup.map(async (user) => {
                const { data, error } = await supabaseService.supabase
                    .from("profiles")
                    .select("username")
                    .eq("id", user.id)
                    .single();

                if (error) {
                    throw new Error(error.message);
                }

                return {
                    ...user,
                    name: data.username,
                };
            }),
        );

        const requestUser = updatedUsers.find((user) =>
            user.id === requestUserID
        );

        if (!requestUser) {
            return new Response(
                JSON.stringify({ message: "User not found" }),
                { status: STATUS_CODE.NotFound },
            );
        }

        const filteredUsers = updatedUsers.filter((user) =>
            user.id !== requestUserID
        );

        const response = {
            request_user: requestUser,
            users: filteredUsers,
        };

        return new Response(JSON.stringify(response), {
            status: STATUS_CODE.OK,
        });
    } catch (error) {
        return new Response(
            JSON.stringify({ message: (error as Error).message }),
            { status: STATUS_CODE.InternalServerError },
        );
    }
});
