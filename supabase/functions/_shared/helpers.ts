export const logPayload = (payload: any) => {
    console.info(`[Request body]:\n${JSON.stringify(payload, null, 2)}`);
};
