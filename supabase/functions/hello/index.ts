import "jsr:@supabase/functions-js/edge-runtime.d.ts";

console.info("Hello from Functions!");

Deno.serve((_req) => {
    const data = {
        message: `Hello!`,
    };

    return new Response(
        JSON.stringify(data),
        { headers: { "Content-Type": "application/json" } },
    );
});
