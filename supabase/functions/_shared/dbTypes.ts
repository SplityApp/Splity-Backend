export interface Group {
    id: string;
    name: string;
    currency: string;
    created_at: string;
    groups_profiles: GroupProfiles[];
}

export interface GroupProfiles {
    user_id: string;
    group_id: string;
}

export interface Expense {
    description: string;
    payments: Payment[];
}

export interface Payment {
    expense_id: string;
    user_id: string;
    amount: number;
    state: "pending" | "fulfilled";
}

export interface GroupDetailsExpense {
    id: string;
    description: string;
    category: string;
    amount: number;
    paid_by: string;
    payer: {
        user_name: string;
    };
    payments: Payment[];
}

export interface GroupDetails extends Group {
    invite_code: string;
    expenses: GroupDetailsExpense[];
}
