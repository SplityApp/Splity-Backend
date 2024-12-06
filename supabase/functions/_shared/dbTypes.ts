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
    id: string;
    group_id: string;
    description: string;
    category: string;
    amount: number;
    paid_by: string;
    created_at: string;
}

export interface Payment {
    expense_id: string;
    user_id: string;
    amount: number;
}

export interface GroupDetailsExpense {
    id: string;
    description: string;
    category: string;
    amount: number;
    paid_by: string;
    created_at: string;
    payer: {
        username: string;
    };
    payments: Payment[];
}

export interface GroupDetailsWithExpenses extends Group {
    invite_code: string;
    expenses: GroupDetailsExpense[];
}

export interface GroupDetails extends Group {
    invite_code: string;
    profiles: Profile[];
}

export interface Profile {
    id: string;
    username: string;
    email: string;
    phone_number: string;
    char_image: string;
    allowed_notifications: boolean;
}
