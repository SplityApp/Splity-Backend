import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { HTTP_STATUS_CODES as status } from "@develiott/http-status-codes";
import { SupabaseService } from "../../../utils/SupabaseService.ts";

console.log("Hello from Functions!");

Deno.serve(async (req) => {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return new Response(
      JSON.stringify({ message: "Missing token" }),
      { status: status.UNAUTHORIZED },
    );
  }

  const supabaseService = new SupabaseService(token);

  const { data, error } = await supabaseService.getUser(token);

  if (error) {
    return new Response(
      JSON.stringify({ message: error.message }),
      { status: status.UNAUTHORIZED },
    );
  }

  const groups = await supabaseService.supabase.from("groups_profiles").select(
    "*",
  ).eq("user_id", data.user.id);

  console.log(groups);

  return new Response(
    JSON.stringify(data),
    { headers: { "Content-Type": "application/json" } },
  );
});
