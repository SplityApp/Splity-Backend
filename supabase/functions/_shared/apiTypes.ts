import { Session, User } from "jsr:@supabase/supabase-js@2";
import { GroupProfiles } from "./dbTypes.ts";

// Request types

export type AddUserToGroupRequest = {
    invite_code: string;
};

export type CreateGroupRequest = {
    name: string;
    currency: string;
};

export type GetGroupDetailsRequest = {
    group_id: string;
};

export type ProcessPaymentRequest = {
    payer_id: string;
    expense_id: string;
};

export type UserSignInRequest = {
    email: string;
    password: string;
};

export type UserSignUpRequest = {
    email: string;
    password: string;
    username: string;
    phone_number: string;
};

export type GetBalancesRequest = {
    group_id: string;
};

export type AddExpenseRequest = {
    group_id: string;
    description: string;
    category: string;
    amount: number;
    splits: {
        user_id: string;
        amount: number;
    }[];
};

// Response types

export type GetUserInfoResponse = {
    user: User;
};

export type GetGroupDetailsResponse = {
    id: string;
    name: string;
    currency: string;
    created_at: string;
    invite_code: string;
};

export type GetGroupExpensesResponse = {
    id: string;
    description: string;
    category: string;
    amount: number;
    paid_by: string;
    state: string;
    created_at: string;
}[];

export type GetUserGroupsResponse = {
    my_balance: number;
    id: string;
    name: string;
    currency: string;
    created_at: string;
    groups_profiles: GroupProfiles[];
}[];

export type UserSignInResponse = {
    token: string;
};

export type UserSignUpResponse = {
    user: User | null;
    session: Session | null;
};

export type GetBalancesResponse = {
    users: UserBalance[];
    request_user: UserBalance;
};

export type UserBalance = {
    id: string;
    balance: number;
    name: string;
};
