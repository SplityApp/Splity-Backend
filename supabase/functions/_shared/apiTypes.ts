import { User } from "jsr:@supabase/supabase-js@2";

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
    expenses: {
        id: string;
        description: string;
        category: string;
        amount: number;
        paid_by: string;
        state: string;
    }[];
};
