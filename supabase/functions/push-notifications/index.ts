import { JWT } from "npm:google-auth-library@9";
import type { GetNotificationsRequest } from "../_shared/apiTypes.ts";
import { STATUS_CODE } from "jsr:@std/http/status";
import { SupabaseService } from "../_shared/SupabaseService.ts";
import serviceAccount from "../fcm_service.json" with { type: "json" };

console.info("[EDGE] push-notifications");

/**
 * No request body is required for this endpoint.
 * @see GetNotificationsRequest
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

    const { data: userData, error: userError } = await supabaseService.supabase
        .auth.getUser(token);

    if (userError) {
        return new Response(
            JSON.stringify({ message: userError.message }),
            { status: STATUS_CODE.Unauthorized },
        );
    }

    const payload: GetNotificationsRequest = await req.json();

    if (!payload.user_id) {
        return new Response(
            JSON.stringify({ message: "Missing target user id" }),
            { status: STATUS_CODE.BadRequest },
        );
    }

    const { data, error } = await supabaseService.supabase
        .from("profiles")
        .select("fcm_token")
        .eq("id", payload.user_id)
        .single();

    if (error) {
        return new Response(
            JSON.stringify({ message: error.message }),
            { status: STATUS_CODE.BadRequest },
        );
    }

    const fcmToken = data!.fcm_token as string;

    const accessToken = await getAccessToken({
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
    });

    console.log("Access token:", accessToken);

    const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                message: {
                    token: fcmToken,
                    notification: {
                        title: payload.title,
                        body: payload.description,
                    },
                },
            }),
        },
    );

    const resData = await res.json();
    if (res.status < 200 || 299 < res.status) {
        throw resData;
    }

    return new Response(null, {
        headers: { "Content-Type": "application/json" },
    });
});

const getAccessToken = ({
    clientEmail,
    privateKey,
}: {
    clientEmail: string;
    privateKey: string;
}): Promise<string> => {
    return new Promise((resolve, reject) => {
        const jwtClient = new JWT({
            email: clientEmail,
            key: privateKey,
            scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
        });
        jwtClient.authorize((err, tokens) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(tokens!.access_token!);
        });
    });
};
