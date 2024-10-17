import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js";

Deno.serve(async (req) => {
  const { password, email, username, phoneNumber } = await req.json();

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({ message: "Missing SUPABASE_URL or SUPABASE_ANON_KEY" }),
      { status: 500 },
    );
  }

  const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey,
  );

  const { data, error } = await supabase.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        username: username,
        phoneNumber: phoneNumber,
      },
    },
  });

  if (error) {
    return new Response(
      JSON.stringify({ message: error.message }),
      { status: 500 },
    );
  }

  return new Response(
    JSON.stringify(data),
    { headers: { "Content-Type": "application/json" }, status: 201 },
  );
});
