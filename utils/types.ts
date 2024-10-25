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
    user_id: string;
    amount: number;
    state: string;
}
