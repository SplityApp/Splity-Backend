import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";
import type { Expense, Group, Payment } from "../_shared/types.ts";

console.log("[EDGE] user-groups");

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

    const groupsIds = groups.data.map((group: Group) => group.id);
    const myId = data.user.id;

    const expensesWithinGroups = await Promise.all(
        groupsIds.map(async (groupId: string) => {
            const expensesPopulatedWithPayments = await supabaseService.supabase
                .from("expenses")
                .select(
                    `description, paid_by, amount, payments ( expense_id, user_id, amount, state)`,
                )
                .eq("group_id", groupId);
            return {
                groupId,
                data: expensesPopulatedWithPayments.data,
            };
        }),
    );

    const groupsWithMyBalances = groups.data.map((group: Group) => (
        {
            ...group,
            myBalance: 0,
        }
    ));

    for (
        const { data: expensesWithinOneGroup, groupId } of expensesWithinGroups
    ) {
        console.log(`\nGroup: ${groupId}`);
        let allPaidByMeInGroup = 0;
        let moneyOwedToMeInGroup = 0;
        let moneyIHaveToPayInGroup = 0;

        if (!expensesWithinOneGroup) {
            console.error("No expenses found");
            continue;
        }

        for (const expense of expensesWithinOneGroup) {
            console.log(
                `Expense: ${expense.description}, amount: ${expense.amount}`,
            );
            console.log(JSON.stringify(expense, null, 2));
            if (expense.paid_by === myId) {
                allPaidByMeInGroup += expense.amount;
            }

            for (const payment of expense.payments) {
                if (expense.paid_by == myId && payment.state === "pending") {
                    moneyOwedToMeInGroup += payment.amount;
                } else if (
                    payment.user_id == myId && payment.state === "pending"
                ) {
                    moneyIHaveToPayInGroup += payment.amount;
                }
            }
        }

        console.log(`Total paid by me in group: ${allPaidByMeInGroup}`);
        console.log(`Total owed to me in group: ${moneyOwedToMeInGroup}`);
        console.log(`Total I have to pay in group: ${moneyIHaveToPayInGroup}`);
        const myMoneyBalanceInGroup = moneyOwedToMeInGroup -
            moneyIHaveToPayInGroup;
        console.log(`My balance in group: ${myMoneyBalanceInGroup}`);
        groupsWithMyBalances.find((group) => group.id === groupId)!.myBalance =
            myMoneyBalanceInGroup;
    }

    return new Response(
        JSON.stringify({
            groups: groupsWithMyBalances,
        }),
        {
            headers: { "Content-Type": "application/json" },
            status: STATUS_CODE.OK,
        },
    );
});
