import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js";
import { HTTP_STATUS_CODES as status } from "@develiott/http-status-codes";

console.log("Hello from Functions!");

Deno.serve(async (req) => {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({ message: "Missing SUPABASE_URL or SUPABASE_ANON_KEY" }),
      { status: status.INTERNAL_SERVER_ERROR },
    );
  }

  if (!token) {
    return new Response(
      JSON.stringify({ message: "Missing token" }),
      { status: 400 },
    );
  }

  const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey,
  );

  const { data, error } = await supabase.auth.getUser(token);

  return new Response(
    JSON.stringify(data),
    { headers: { "Content-Type": "application/json" } },
  );
});
