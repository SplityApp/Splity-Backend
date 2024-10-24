import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js";
import { HTTP_STATUS_CODES as status } from "@develiott/http-status-codes";

console.log("[EDGE] User-sign-in");

Deno.serve(async (req) => {
  const { password, email } = await req.json();

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({ message: "Missing SUPABASE_URL or SUPABASE_ANON_KEY" }),
      { status: status.INTERNAL_SERVER_ERROR },
    );
  }

  const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey,
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });

  if (error) {
    return new Response(
      JSON.stringify({ message: error.message }),
      { status: status.UNAUTHORIZED },
    );
  }

  return new Response(
    JSON.stringify({
      token: data.session.access_token,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
